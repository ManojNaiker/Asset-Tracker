import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import bcrypt from "bcryptjs";
import { User, auditLogs, users, emailSettings, insertAssetSchema, insertAssetTypeSchema, insertAllocationSchema, insertDepartmentSchema, insertDesignationSchema, insertEmployeeSchema, insertCustomFieldSchema, allocations, ssoSettings as ssoSettingsTable, pageSettings, insertPageSettingsSchema, bulkUploadLogs, insertBulkUploadLogSchema } from "@shared/schema";
import crypto from "node:crypto";
import { db } from "./db";
import { desc, eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import { SAML } from "@node-saml/node-saml";

const PgSession = connectPgSimple(session);

// Configure multer for image uploads
const storage_multer = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), "client/public/uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage_multer });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.set("trust proxy", 1);
  const isSecureEnv = process.env.NODE_ENV === "production" || !!(process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS);
  app.use(session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: isSecureEnv,
      httpOnly: true,
      sameSite: isSecureEnv ? 'none' : 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // === Middleware ===
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && (req.user as User).role === 'admin') return next();
    res.status(403).json({ message: "Forbidden: Admins only" });
  };

  // === SSO Setup ===
  const getSsoBaseUrl = (spEntityId?: string): string => {
    if (process.env.APP_URL) return process.env.APP_URL;
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
    if (replitDomain) return "https://" + replitDomain;
    if (spEntityId && /^https?:\/\//.test(spEntityId)) return spEntityId;
    console.warn("SSO Warning: Could not determine a valid base URL. Set APP_URL environment variable.");
    return "https://localhost";
  };

  const normalizeCert = (cert: string): string => {
    let normalized = cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, '')
      .replace(/\s/g, '')
      .trim();
    return normalized;
  };

  const setupSso = async () => {
    try {
      const settings = await storage.getSsoSettings();
      console.log("Initializing SSO strategy. Enabled:", settings?.isEnabled);
      
      if (!settings || !settings.isEnabled || !settings.entryPoint || !settings.publicKey) {
        console.log("SSO not fully configured, skipping SAML strategy registration");
        try { passport.unuse("saml"); } catch {}
        return;
      }

      const baseUrl = getSsoBaseUrl(settings.spEntityId);
      const callbackUrl = baseUrl + "/api/auth/saml/callback";
      const idpCert = normalizeCert(settings.publicKey);

      console.log("SAML Config: Issuer=" + settings.spEntityId + ", CallbackUrl=" + callbackUrl);
      console.log("IdP Certificate length:", idpCert.length, "chars");

      const samlStrategy = new SamlStrategy(
        {
          callbackUrl,
          entryPoint: settings.entryPoint,
          issuer: settings.spEntityId,
          idpIssuer: settings.idpEntityId,
          idpCert: idpCert,
          logoutUrl: settings.logoutUrl || undefined,
          signatureAlgorithm: 'sha256' as const,
          digestAlgorithm: 'sha256' as const,
          disableRequestedAuthnContext: true,
          wantAssertionsSigned: false,
          wantAuthnResponseSigned: false,
        } as any,
        async (profile: any, done: any) => {
          try {
            console.log("SAML Profile received:", JSON.stringify(profile, null, 2));
            const username = profile?.nameID || profile?.email || profile?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
            
            if (!username) {
              console.error("SAML Profile is missing identification fields:", profile);
              return done(new Error("SAML Profile is missing identification fields"));
            }
            
            let user = await storage.getUserByUsername(username);
            if (!user) {
              const currentSettings = await storage.getSsoSettings();
              console.log("User not found. JIT enabled:", currentSettings?.jitProvisioning);
              
              if (currentSettings?.jitProvisioning) {
                console.log("JIT Provisioning user:", username);
                user = await storage.createUser({
                  username: username,
                  password: await bcrypt.hash(Math.random().toString(36), 10),
                  role: "employee",
                });
              } else {
                return done(null, false, { message: "User not found and JIT provisioning is disabled" });
              }
            }
            return done(null, user);
          } catch (err) {
            console.error("SAML Strategy error:", err);
            return done(err);
          }
        },
        (profile: any, done: any) => done(null, profile)
      );
      
      passport.use("saml", samlStrategy as any);
      console.log("SAML strategy registered with passport");
    } catch (err) {
      console.error("Failed to initialize SSO:", err);
    }
  };
  setupSso();

  // === SSO Routes ===
  app.get("/api/auth/saml/login", async (req, res, next) => {
    const settings = await storage.getSsoSettings();
    if (!settings?.isEnabled) {
      return res.status(400).json({ message: "SSO is not enabled. Please configure SSO in the admin settings first." });
    }
    if (!settings.entryPoint) {
      return res.status(400).json({ message: "SSO is not fully configured. The Identity Provider Entry Point URL is missing. Please complete the SSO configuration in admin settings." });
    }
    if (!settings.publicKey) {
      return res.status(400).json({ message: "SSO is not fully configured. The Identity Provider Certificate is missing. Please complete the SSO configuration in admin settings." });
    }
    console.log("Initiating SAML Login redirect");
    passport.authenticate("saml", { 
      failureRedirect: "/auth",
      failureFlash: true 
    })(req, res, next);
  });

  app.post("/api/auth/saml/callback", (req, res, next) => {
    console.log("SAML callback received. Body keys:", Object.keys(req.body || {}));
    passport.authenticate("saml", (err: any, user: any, info: any) => {
      if (err) {
        console.error("SAML callback authentication error:", err.message || err);
        if (err.stack) console.error("Stack:", err.stack);
        return res.redirect("/auth?error=sso_error");
      }
      if (!user) {
        console.error("SAML callback: No user returned.", info?.message || "");
        return res.redirect("/auth?error=sso_no_user");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("SAML callback: Login error:", loginErr.message || loginErr);
          return res.redirect("/auth?error=sso_login_error");
        }
        console.log("SAML login successful for user:", (user as User).username);
        
        req.session.save((err) => {
          if (err) {
            console.error("SAML callback: Session save error:", err);
          }
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Cache-Control", "no-store");
          res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head><body><p>Redirecting...</p><script>window.location.href="/";</script></body></html>`);
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/saml/metadata", async (req, res) => {
    try {
      const settings = await storage.getSsoSettings();
      if (!settings?.isEnabled) return res.status(404).send("SSO not enabled");
      
      const baseUrl = getSsoBaseUrl(settings.spEntityId);
      const callbackUrl = baseUrl + "/api/auth/saml/callback";

      const saml = new SAML({
        callbackUrl,
        entryPoint: settings.entryPoint || "http://placeholder",
        issuer: settings.spEntityId,
        idpIssuer: settings.idpEntityId || "http://placeholder",
        idpCert: settings.publicKey || "placeholder",
      } as any);

      res.type("application/xml");
      const xml = saml.generateServiceProviderMetadata(null, settings.publicKey || null);
      res.status(200).send(xml);
    } catch (err) {
      console.error("Metadata generation error:", err);
      res.status(500).send("Internal Server Error: " + (err as Error).message);
    }
  });

  app.get("/api/settings/sso", requireAdmin, async (req, res) => {
    const settings = await storage.getSsoSettings();
    res.json(settings || {});
  });

  app.put("/api/settings/sso", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateSsoSettings(req.body);
      await setupSso(); // Re-initialize strategy with new settings
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to update SSO settings" });
    }
  });

  // Page Settings
  app.get("/api/settings/page", async (req, res) => {
    const settings = await storage.getPageSettings();
    res.json(settings || { softwareName: "AssetAlloc", companyName: "Light Finance", logoUrl: "/images/logo.png" });
  });

  app.put("/api/settings/page", requireAdmin, async (req, res) => {
    try {
      const validated = insertPageSettingsSchema.parse(req.body);
      const settings = await storage.updatePageSettings(validated);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid page settings", errors: err.errors });
      }
      res.status(500).json({ message: "Failed to update page settings" });
    }
  });

  // === Authentication Setup ===
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return done(null, false, { message: "Incorrect username." });
      }
      if (user.isLocked) {
        return done(null, false, { message: "Account is locked due to too many failed attempts." });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        const attempts = (user.failedAttempts || 0) + 1;
        const updates: Partial<User> = { failedAttempts: attempts };
        if (attempts >= 5) {
          updates.isLocked = true;
        }
        await storage.updateUser(user.id, updates);
        return done(null, false, { message: "Incorrect password." });
      }

      await storage.updateUser(user.id, { failedAttempts: 0 });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // === Seed Admin ===
  async function seedAdmin() {
    const existingAdmin = await storage.getUserByUsername("admin@lightmf.com");
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await storage.createUser({
        username: "admin@lightmf.com",
        password: hashedPassword,
        role: "admin",
        mustChangePassword: true
      });
      console.log("Seeded default admin user.");
    } else {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await storage.updateUser(existingAdmin.id, { 
        password: hashedPassword,
        isLocked: false,
        failedAttempts: 0
      });
      console.log("Reset admin password and unlocked account.");
    }
  }
  seedAdmin();

  // === Routes ===

  // Auth Routes
  app.post(api.auth.login.path, passport.authenticate("local"), async (req, res) => {
    const user = req.user as User;
    if (user.isLocked) {
        req.logout(() => {});
        return res.status(423).json({ message: "Account is locked." });
    }
    
    await storage.createAuditLog({
      userId: user.id,
      action: "Login",
      entityType: "User",
      entityId: user.id,
      details: { username: user.username, ip: req.ip }
    });

    res.json(user);
  });

  app.post(api.auth.logout.path, async (req, res) => {
    const user = req.user as User;
    if (user) {
      await storage.createAuditLog({
        userId: user.id,
        action: "Logout",
        entityType: "User",
        entityId: user.id
      });
    }
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  app.post(api.auth.changePassword.path, requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    const user = req.user as User;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(user.id, { 
      password: hashedPassword,
      mustChangePassword: false 
    });

    await storage.createAuditLog({
      userId: user.id,
      action: "Change Password",
      entityType: "User",
      entityId: user.id
    });

    res.json({ message: "Password updated successfully" });
  });

  // Users
  app.get("/api/users", requireAdmin, async (req, res) => {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json(allUsers);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, role, fullName, employeeCode, designation, department } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: role || "employee",
        fullName,
        employeeCode,
        designation,
        department,
        mustChangePassword: true
      });

      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Create User", 
        entityType: "User", 
        entityId: user.id,
        details: { username: user.username, role: user.role }
      });

      // Send welcome email to user
      try {
        const settings = await storage.getEmailSettings();
        if (settings && settings.host) {
          const transporter = nodemailer.createTransport({
            host: settings.host,
            port: settings.port || 587,
            secure: settings.secure,
            auth: {
              user: settings.user,
              pass: settings.password,
            },
          });

          const baseUrl = getSsoBaseUrl();
          await transporter.sendMail({
            from: settings.fromEmail || settings.user,
            to: user.username,
            subject: "Welcome to Asset Management System",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #1e293b; margin-bottom: 16px;">Welcome to AssetAlloc</h2>
                <p style="color: #475569; font-size: 16px;">Hello ${user.fullName || user.username},</p>
                <p style="color: #475569; font-size: 16px; line-height: 1.5;">
                  Your account has been created successfully. You can now log in to the Asset Management System to view your allocated assets and manage verifications.
                </p>
                <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 24px 0;">
                  <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Username:</strong> ${user.username}</p>
                  <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;"><strong>Role:</strong> ${user.role}</p>
                </div>
                <div style="margin: 32px 0;">
                  <a href="${baseUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">Login to Portal</a>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                  If you have any questions, please contact your administrator.
                </p>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
      }

      res.status(201).json(user);
    } catch (err) {
      console.error("Error creating user:", err);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, role, password, isLocked, fullName, employeeCode, designation, department } = req.body;
      const updates: any = {};
      
      if (username) updates.username = username;
      if (role) updates.role = role;
      if (password) updates.password = await bcrypt.hash(password, 10);
      if (typeof isLocked === 'boolean') updates.isLocked = isLocked;
      if (fullName !== undefined) updates.fullName = fullName;
      if (employeeCode !== undefined) updates.employeeCode = employeeCode;
      if (designation !== undefined) updates.designation = designation;
      if (department !== undefined) updates.department = department;

      const user = await storage.updateUser(id, updates);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Update User", 
        entityType: "User", 
        entityId: user.id,
        details: updates
      });

      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userToDelete = await storage.getUser(id);
      await storage.deleteUser(id);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Delete User", 
        entityType: "User", 
        entityId: id,
        details: { 
          deletedUsername: userToDelete?.username,
          deletedRole: userToDelete?.role
        }
      });

      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/users/bulk", requireAdmin, async (req, res) => {
    try {
      const usersData = req.body;
      if (!Array.isArray(usersData)) {
        return res.status(400).json({ message: "Expected an array of users" });
      }

      const created = [];
      const existing = [];
      const failed = [];

      for (const userData of usersData) {
        try {
          const { username, password, role, fullName, employeeCode, designation, department } = userData;
          if (!username || !password) {
            failed.push({ ...userData, error: "Missing username or password" });
            continue;
          }

          // Auto-create departments if they don't exist
          if (department) {
            const depts = await storage.getDepartments();
            if (!depts.find(d => d.name === department)) {
              await storage.createDepartment({ name: department });
              console.log(`Created department: ${department}`);
            }
          }

          // Auto-create designations if they don't exist
          if (designation) {
            const desigs = await storage.getDesignations();
            if (!desigs.find(d => d.name === designation)) {
              await storage.createDesignation({ name: designation });
              console.log(`Created designation: ${designation}`);
            }
          }

          const existingUser = await storage.getUserByUsername(username);
          if (existingUser) {
            // Update existing user with new department/designation
            const updateData: any = {};
            if (fullName) updateData.fullName = fullName;
            if (employeeCode) updateData.employeeCode = employeeCode;
            if (designation) updateData.designation = designation;
            if (department) updateData.department = department;
            if (role) updateData.role = role;
            
            if (Object.keys(updateData).length > 0) {
              const updatedUser = await storage.updateUser(existingUser.id, updateData);
              existing.push({ 
                ...userData, 
                userId: existingUser.id, 
                previousData: existingUser,
                updatedData: updatedUser,
                message: "User updated with new details" 
              });
            } else {
              existing.push({ 
                ...userData, 
                userId: existingUser.id, 
                currentData: existingUser,
                message: "User already exists - no changes needed" 
              });
            }
            continue;
          }

          const hashedPassword = await bcrypt.hash(password, 10);
          const user = await storage.createUser({
            username,
            password: hashedPassword,
            role: role || "employee",
            fullName,
            employeeCode,
            designation,
            department,
            mustChangePassword: true
          });
          created.push(user);
        } catch (e: any) {
          console.error("Failed to import user", userData, e);
          failed.push({ ...userData, error: e.message });
        }
      }

      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Bulk Import Users", 
        details: { 
          createdCount: created.length,
          existingCount: existing.length,
          failedCount: failed.length,
          createdData: created,
          existingData: existing,
          failedData: failed
        } 
      });

      res.status(201).json({ 
        created, 
        existing, 
        failed, 
        createdCount: created.length,
        existingCount: existing.length,
        failedCount: failed.length
      });
    } catch (err) {
      console.error("Bulk create users error:", err);
      res.status(500).json({ message: "Failed to bulk create users" });
    }
  });

  app.get("/api/verifications", requireAuth, async (req, res) => {
    const verifications = await storage.getVerifications();
    res.json(verifications);
  });

  app.post("/api/verifications", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { assetId, status, remarks } = req.body;
      
      const verification = await storage.createVerification({
        assetId: parseInt(assetId),
        status,
        remarks,
        verifierId: user.id
      });

      const asset = await storage.getAsset(assetId);
      await storage.createAuditLog({
        userId: user.id,
        action: "Asset " + status,
        entityType: "Verification",
        entityId: verification.id,
        details: { assetSerial: asset?.serialNumber, status, remarks }
      });

      res.status(201).json(verification);
    } catch (err) {
      res.status(400).json({ message: "Failed to create verification" });
    }
  });

  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const safePath = "/uploads/" + req.file.filename;
    res.json({ url: safePath });
  });

  app.post("/api/settings/email/test", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      if (!settings || !settings.host) {
        return res.status(400).json({ message: "Email settings not configured" });
      }

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port || 587,
        secure: settings.secure,
        auth: {
          user: settings.user,
          pass: settings.password,
        },
      });

      await transporter.sendMail({
        from: settings.fromEmail || settings.user,
        to: req.body.to || settings.fromEmail || settings.user,
        subject: "Test Email from Asset Management System",
        text: "This is a test email to verify your SMTP settings.",
      });

      res.json({ message: "Test email sent successfully" });
    } catch (err) {
      console.error("Email test failed:", err);
      res.status(500).json({ message: "Failed to send test email: " + (err as Error).message });
    }
  });

  app.get("/api/verifications/token/:token", async (req, res) => {
    try {
      const allocation = await storage.getAllocationByToken(req.params.token);
      if (!allocation) return res.status(404).json({ message: "Invalid or expired verification link" });
      res.json(allocation);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/verifications/external", async (req, res) => {
    try {
      const { token, status, remarks } = req.body;
      const allocation = await storage.getAllocationByToken(token);
      if (!allocation) return res.status(404).json({ message: "Invalid or expired verification link" });

      const verification = await storage.createVerification({
        assetId: allocation.assetId,
        status,
        remarks,
        verifierId: 0 // System/External verifier
      });

      // We no longer clear the token so the link remains valid for the employee to see their selection
      // await storage.updateAllocation(allocation.id, { verificationToken: null });

      await storage.createAuditLog({
        action: "External Asset " + status,
        entityType: "Verification",
        entityId: verification.id,
        details: { assetSerial: allocation.asset.serialNumber, status, remarks, employee: allocation.employee.name }
      });

      res.status(201).json(verification);
    } catch (err) {
      res.status(400).json({ message: "Failed to submit verification" });
    }
  });

  app.get("/api/verifications/public/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const verification = await storage.getVerificationWithDetails(id);
      if (!verification) return res.status(404).json({ message: "Verification not found" });
      res.json(verification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/allocations/:id/send-verification", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allocation = await storage.getAllocations().then(list => list.find(a => a.id === id));
      if (!allocation) return res.status(404).json({ message: "Allocation not found" });

      const token = crypto.randomBytes(32).toString('hex');
      await storage.updateAllocation(id, { verificationToken: token });

      const settings = await storage.getEmailSettings();
      if (!settings || !settings.host) {
        return res.status(400).json({ message: "Email settings not configured" });
      }

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port || 587,
        secure: settings.secure,
        auth: {
          user: settings.user,
          pass: settings.password,
        },
      });

      const baseUrl = getSsoBaseUrl();
      const verificationUrl = `${baseUrl}/verify/${token}`;

      // Get asset details for the email
      const assetDetails = allocation.asset;
      const assetType = assetDetails.type.name;
      const assetSerial = assetDetails.serialNumber;
      
      // Extract dynamic fields if any
      const dynamicFields = assetDetails.fields as Record<string, any> || {};
      const fieldsHtml = Object.entries(dynamicFields)
        .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
        .join('');

      await transporter.sendMail({
        from: settings.fromEmail || settings.user,
        to: allocation.employee.email,
        subject: `Action Required: Asset Allocation Verification - ${assetType}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2e7d32; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Asset Allocation Summary</h1>
              <p style="color: #e8f5e9; margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Light Microfinance Pvt. Ltd.</p>
            </div>
            
            <div style="padding: 32px 24px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Asset Allocation Summary</h2>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #666666; font-size: 13px; text-transform: uppercase;">Asset</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0; color: #666666; font-size: 13px; text-transform: uppercase;">Serial Number</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 16px 12px; border-bottom: 1px solid #eeeeee; color: #333333; font-size: 15px;">${assetType}</td>
                    <td style="padding: 16px 12px; border-bottom: 1px solid #eeeeee; color: #2e7d32; font-weight: 600; text-align: right; font-size: 15px;">${assetSerial}</td>
                  </tr>
                </tbody>
              </table>

              <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #edf2f7; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #4a5568; font-size: 14px; text-transform: uppercase;">Additional Details</h3>
                <ul style="list-style: none; padding: 0; margin: 0; color: #4a5568; font-size: 14px;">
                  ${fieldsHtml}
                </ul>
              </div>

              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
                A new asset has been allocated to you. Please click the button below to verify the asset details and complete the acknowledgement process.
              </p>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${verificationUrl}" style="background-color: #2e7d32; color: #ffffff; padding: 14px 32px; border-radius: 4px; text-decoration: none; font-weight: 600; display: inline-block;">Verify Asset Now</a>
              </div>
            </div>
            
            <div style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                This is an automated notification. Please do not reply to this email.<br>
                Portal: <a href="${baseUrl}" style="color: #2e7d32; text-decoration: none;">${baseUrl}</a>
              </p>
            </div>
          </div>
        `,
      });

      res.json({ message: "Verification email sent successfully" });
    } catch (err) {
      console.error("Email send failed:", err);
      res.status(500).json({ message: "Failed to send email: " + (err as Error).message });
    }
  });

  // Assets
  app.get(api.assets.list.path, requireAuth, async (req, res) => {
    const query = req.query as { search?: string, typeId?: string, status?: string };
    const assets = await storage.getAssets({
      ...query,
      typeId: query.typeId ? parseInt(query.typeId) : undefined
    });
    res.json(assets);
  });

  app.post(api.assets.create.path, requireAdmin, async (req, res) => {
    const input = insertAssetSchema.parse(req.body);
    const asset = await storage.createAsset(input);
    
    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "Create Asset",
      entityType: "Asset",
      entityId: asset.id,
      details: { serialNumber: asset.serialNumber }
    });

    res.status(201).json(asset);
  });

  app.post("/api/assets/import", requireAdmin, async (req, res) => {
    try {
      const assetsData = req.body;
      if (!Array.isArray(assetsData)) {
        return res.status(400).json({ message: "Expected an array of assets" });
      }

      const results = await storage.createAssetsBulk(assetsData);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Bulk Import Assets", 
        details: { count: results.length } 
      });
      
      res.status(201).json({ count: results.length, assets: results });
    } catch (err) {
      console.error("Asset import error:", err);
      res.status(500).json({ message: "Failed to import assets" });
    }
  });

  app.put(api.assets.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const asset = await storage.updateAsset(id, req.body);
    
    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "Update Asset",
      entityType: "Asset",
      entityId: id,
      details: req.body
    });

    res.json(asset);
  });

  app.get(api.assetTypes.list.path, requireAuth, async (req, res) => {
    const types = await storage.getAssetTypes();
    res.json(types);
  });

  app.post(api.assetTypes.create.path, requireAdmin, async (req, res) => {
    const input = insertAssetTypeSchema.parse(req.body);
    const type = await storage.createAssetType(input);
    
    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "Create Asset Type",
      entityType: "AssetType",
      entityId: type.id,
      details: { name: type.name }
    });

    res.status(201).json(type);
  });

  app.put(api.assetTypes.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const type = await storage.updateAssetType(id, req.body);
    
    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "Update Asset Type",
      entityType: "AssetType",
      entityId: id,
      details: req.body
    });

    res.json(type);
  });

  app.get(api.allocations.list.path, requireAuth, async (req, res) => {
    const allocations = await storage.getAllocations();
    res.json(allocations);
  });

  app.post(api.allocations.create.path, requireAdmin, async (req, res) => {
    try {
      const { assetId, employeeId, employeeData, assetData, status, remarks, details } = req.body;
      
      let finalAssetId = assetId;
      let finalEmployeeId = employeeId;

      if (employeeData) {
        // Automatically create department/designation if they don't exist
        if (employeeData.department) {
          const depts = await storage.getDepartments();
          if (!depts.find(d => d.name === employeeData.department)) {
            await storage.createDepartment({ name: employeeData.department });
          }
        }
        if (employeeData.designation) {
          const desigs = await storage.getDesignations();
          if (!desigs.find(d => d.name === employeeData.designation)) {
            await storage.createDesignation({ name: employeeData.designation });
          }
        }

        const employee = await storage.createEmployee(employeeData);
        finalEmployeeId = employee.id;
      }

      if (assetData) {
        if (assetData.assetTypeName) {
          const types = await storage.getAssetTypes();
          let type = types.find(t => t.name === assetData.assetTypeName);
          if (!type) {
            type = await storage.createAssetType({ name: assetData.assetTypeName, schema: [] });
          }
          assetData.assetTypeId = type.id;
          delete assetData.assetTypeName;
        }
        const asset = await storage.createAsset(assetData);
        finalAssetId = asset.id;
      }

      // Check if asset already has active allocation - if yes, mark it as Returned
      const existingAllocations = await db.select().from(allocations).where(
        and(
          eq(allocations.assetId, finalAssetId),
          eq(allocations.status, "Active")
        )
      );

      if (existingAllocations.length > 0) {
        for (const existingAlloc of existingAllocations) {
          await db.update(allocations)
            .set({
              status: "Returned",
              returnDate: new Date()
            })
            .where(eq(allocations.id, existingAlloc.id));
          console.log(`Marked allocation ${existingAlloc.id} as Returned for asset ${finalAssetId}`);
        }
      }

      // Generate a verification token for the new allocation
      const token = crypto.randomBytes(32).toString('hex');

      const allocation = await storage.createAllocation({
        assetId: finalAssetId,
        employeeId: finalEmployeeId,
        status: status || "Active",
        remarks,
        imageUrl: details?.imageUrl,
        verificationToken: token
      });

      // Update asset status
      await storage.updateAsset(finalAssetId, { status: "Allocated" });

      // Send email notification
      const emailSettings = await storage.getEmailSettings();
      const employee = await storage.getEmployee(finalEmployeeId);
      const asset = await storage.getAsset(finalAssetId);

      if (emailSettings && employee && employee.email) {
        try {
          const transporter = nodemailer.createTransport({
            host: emailSettings.host,
            port: emailSettings.port,
            secure: emailSettings.secure,
            auth: {
              user: emailSettings.user,
              pass: emailSettings.password,
            },
          });

          const appUrl = getSsoBaseUrl();
          const verificationUrl = `${appUrl}/verify/${token}`;

          // Get asset details for the email
          const assetDetails = asset as any;
          const assetType = assetDetails.type?.name || "Asset";
          const assetSerial = assetDetails.serialNumber;
          
          // Extract dynamic fields if any
          const dynamicFields = assetDetails.specifications as Record<string, any> || {};
          const fieldsHtml = Object.entries(dynamicFields)
            .map(([key, value]) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #edf2f7; color: #718096; font-size: 14px; width: 40%;">${key}</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #edf2f7; color: #2d3748; font-size: 14px; font-weight: 500;">${value}</td>
              </tr>`)
            .join('');

          await transporter.sendMail({
            from: emailSettings.fromEmail,
            to: employee.email,
            subject: `Asset Allocation Confirmation - ${assetType}`,
            html: `
              <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <!-- Header -->
                <div style="background-color: #22c55e; padding: 24px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">ALLOCATED ASSET VERIFICATION</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0 0; font-size: 12px;">Lighthouse | Digital Lending</p>
                </div>

                <!-- Body -->
                <div style="padding: 32px 24px;">
                  <h2 style="color: #1a202c; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Asset Allocation Summary</h2>
                  
                  <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    Dear <strong>${employee.name}</strong>,<br><br>
                    The following asset has been allocated to you. Please review the details below and confirm receipt by clicking the verification button.
                  </p>

                  <!-- Asset Table -->
                  <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 32px;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
                      <thead>
                        <tr style="background-color: #edf2f7;">
                          <th style="text-align: left; padding: 12px 16px; color: #4a5568; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Field</th>
                          <th style="text-align: left; padding: 12px 16px; color: #4a5568; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #718096; font-size: 14px;">Asset Type</td>
                          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #2d3748; font-size: 14px; font-weight: 600;">${assetType}</td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #718096; font-size: 14px;">Serial Number</td>
                          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #2d3748; font-size: 14px; font-weight: 600;">${assetSerial}</td>
                        </tr>
                        ${fieldsHtml}
                      </tbody>
                    </table>
                  </div>

                  <!-- Action -->
                  <div style="text-align: center; margin-bottom: 32px;">
                    <a href="${verificationUrl}" style="background-color: #22c55e; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.2);">
                      Verify Asset Receipt
                    </a>
                  </div>

                  <p style="color: #718096; font-size: 13px; line-height: 1.5; margin: 0; border-top: 1px solid #edf2f7; padding-top: 24px;">
                    This is an automated notification from the Asset Management System.<br>
                    Portal Access: <a href="${appUrl}" style="color: #22c55e; text-decoration: none;">${appUrl}</a>
                  </p>
                </div>
              </div>`
          });
          console.log("Allocation email sent to " + employee.email);
        } catch (emailErr) {
          console.error("Failed to send allocation email:", emailErr);
        }
      }

      await storage.createAuditLog({
        userId: (req.user as User).id,
        action: "Create Allocation",
        entityType: "Allocation",
        entityId: allocation.id,
        details: { 
          assetId: finalAssetId, 
          employeeId: finalEmployeeId,
          assetSerial: asset?.serialNumber,
          employeeName: employee?.name,
          status: allocation.status,
          remarks: allocation.remarks
        }
      });

      res.status(201).json(allocation);
    } catch (err) {
      console.error("Allocation error:", err);
      res.status(500).json({ message: "Failed to create allocation" });
    }
  });

  app.post("/api/allocations/bulk-import", requireAdmin, async (req, res) => {
    try {
      const allocationsData = req.body;
      if (!Array.isArray(allocationsData)) {
        return res.status(400).json({ message: "Expected an array of allocations" });
      }

      const created = [];
      const failed = [];
      const pending = [];

      for (const row of allocationsData) {
        try {
          let finalAssetId: number | null = null;
          let finalEmployeeId: number | null = null;
          let error = null;

          // Handle Basic template: Asset ID and Employee ID directly
          if (row["Asset ID"] && row["Employee ID"]) {
            finalAssetId = parseInt(row["Asset ID"]);
            finalEmployeeId = parseInt(row["Employee ID"]);
          }
          // Handle Auto-Create template: Serial Number and Employee Name
          else if (row["Asset Serial Number"] || row["Asset Type"] || row["Employee Name"]) {
            // Find or create asset by serial number
            if (row["Asset Serial Number"]) {
              try {
                const assets = await storage.getAssets();
                let asset = assets.find(a => a.serialNumber === row["Asset Serial Number"]);
                
                if (!asset && row["Asset Type"]) {
                  const types = await storage.getAssetTypes();
                  let type = types.find(t => t.name === row["Asset Type"]);
                  if (!type) {
                    type = await storage.createAssetType({ name: row["Asset Type"], schema: [] });
                  }
                  try {
                    asset = await storage.createAsset({
                      serialNumber: row["Asset Serial Number"],
                      assetTypeId: type.id,
                      status: "Available"
                    });
                  } catch (assetErr: any) {
                    if (assetErr.message?.includes("duplicate key")) {
                      const existingAsset = assets.find(a => a.serialNumber === row["Asset Serial Number"]);
                      if (existingAsset) asset = existingAsset;
                      else throw assetErr;
                    } else {
                      throw assetErr;
                    }
                  }
                }
                if (asset) finalAssetId = asset.id;
              } catch (assetError: any) {
                error = `Asset error: ${assetError.message}`;
                failed.push({ ...row, error });
                continue;
              }
            }

            // Find or create employee
            if (row["Employee Name"] || row["Employee Email"]) {
              try {
                // Auto-create departments if they don't exist
                if (row["Department"]) {
                  const depts = await storage.getDepartments();
                  if (!depts.find(d => d.name === row["Department"])) {
                    await storage.createDepartment({ name: row["Department"] });
                  }
                }

                // Auto-create designations if they don't exist
                if (row["Designation"]) {
                  const desigs = await storage.getDesignations();
                  if (!desigs.find(d => d.name === row["Designation"])) {
                    await storage.createDesignation({ name: row["Designation"] });
                  }
                }

                const employees = await storage.getEmployees();
                let employee = employees.find(e => 
                  e.name === row["Employee Name"] || 
                  (row["Employee Email"] && e.email === row["Employee Email"])
                );

                if (!employee) {
                  employee = await storage.createEmployee({
                    name: row["Employee Name"] || "Unnamed",
                    email: row["Employee Email"] || "",
                    empId: row["Employee ID"] || `EMP-${Date.now()}`,
                    department: row["Department"] || undefined,
                    designation: row["Designation"] || undefined,
                    branch: row["Branch"] || undefined,
                    mobile: row["Mobile"] || undefined,
                    status: "Active"
                  });
                } else {
                  // Employee exists - mark for update
                  created.push({ ...row, status: "existing", employeeId: employee.id, message: "Employee already exists - admin confirmation needed for update" });
                }
                if (employee) finalEmployeeId = employee.id;
              } catch (empError: any) {
                error = `Employee error: ${empError.message}`;
                failed.push({ ...row, error });
                continue;
              }
            }
          }

          if (!finalAssetId || !finalEmployeeId) {
            error = "Missing asset or employee data";
            failed.push({ ...row, error });
            continue;
          }

          try {
            // Check if asset already has active allocation - if yes, mark it as Returned
            const existingAllocations = await db.select().from(allocations).where(
              and(
                eq(allocations.assetId, finalAssetId),
                eq(allocations.status, "Active")
              )
            );

            if (existingAllocations.length > 0) {
              for (const existingAlloc of existingAllocations) {
                await db.update(allocations)
                  .set({
                    status: "Returned",
                    returnDate: new Date(),
                    verificationStatus: (existingAlloc.verificationStatus === "Pending" || existingAlloc.verificationStatus === "Rejected") ? "Revoked" : existingAlloc.verificationStatus,
                    verificationToken: (existingAlloc.verificationStatus === "Pending" || existingAlloc.verificationStatus === "Rejected") ? null : existingAlloc.verificationToken
                  })
                  .where(eq(allocations.id, existingAlloc.id));
                console.log(`Bulk: Marked allocation ${existingAlloc.id} as Returned for asset ${finalAssetId}`);
              }
            }

            const token = crypto.randomBytes(32).toString('hex');
            const allocation = await storage.createAllocation({
              assetId: finalAssetId,
              employeeId: finalEmployeeId,
              status: row["Status"] || "Active",
              remarks: row["Remarks"] || null,
              verificationToken: token
            });

            const allAssets = await storage.getAssets();
            const assetToUpdate = allAssets.find(a => a.id === finalAssetId);
            if (assetToUpdate && assetToUpdate.status !== "Allocated") {
              await storage.updateAsset(finalAssetId, { status: "Allocated" });
            }
            
            created.push({ ...row, status: "success", allocationId: allocation.id });
          } catch (allocErr: any) {
            error = `Allocation error: ${allocErr.message}`;
            failed.push({ ...row, error });
          }
        } catch (e: any) {
          failed.push({ ...row, error: e.message || "Unknown error" });
        }
      }

      // Save upload log
      try {
        const uploadLog = await db.insert(bulkUploadLogs).values({
          userId: (req.user as User).id,
          uploadType: "allocations",
          totalRows: allocationsData.length,
          createdCount: created.length,
          failedCount: failed.length,
          pendingCount: pending.length,
          createdData: created,
          failedData: failed,
          pendingData: pending,
        }).returning();

        await storage.createAuditLog({ 
          userId: (req.user as User).id, 
          action: "Bulk Import Allocations", 
          details: { 
            createdCount: created.length, 
            failedCount: failed.length, 
            totalCount: allocationsData.length,
            createdData: created,
            failedData: failed,
            departmentsCreated: true,
            designationsCreated: true
          } 
        });
        
        res.status(201).json({ 
          uploadLogId: uploadLog[0]?.id,
          total: allocationsData.length,
          created: created.length, 
          failed: failed.length, 
          pending: pending.length,
          createdData: created,
          failedData: failed
        });
      } catch (logErr: any) {
        res.status(201).json({ 
          total: allocationsData.length,
          created: created.length, 
          failed: failed.length, 
          pending: pending.length,
          createdData: created,
          failedData: failed,
          warning: "Partial success: allocations created but log save failed"
        });
      }
    } catch (err) {
      console.error("Bulk allocation import error:", err);
      res.status(500).json({ message: "Failed to import allocations" });
    }
  });

  app.get("/api/allocations/bulk-uploads", requireAdmin, async (req, res) => {
    try {
      const logs = await db.select().from(bulkUploadLogs).orderBy(desc(bulkUploadLogs.createdAt));
      res.json(logs);
    } catch (err) {
      console.error("Bulk upload logs error:", err);
      res.status(500).json({ message: "Failed to fetch upload logs" });
    }
  });

  app.get("/api/allocations/bulk-uploads/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid upload ID" });
      }
      const log = await db.select().from(bulkUploadLogs).where(eq(bulkUploadLogs.id, id));
      if (!log.length) {
        return res.status(404).json({ message: "Upload log not found" });
      }
      res.json(log[0]);
    } catch (err) {
      console.error("Bulk upload detail error:", err);
      res.status(500).json({ message: "Failed to fetch upload log" });
    }
  });

  app.post("/api/allocations/:id/return", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { returnReason, status } = req.body;
      const updateData: any = { 
        status: "Returned", 
        returnDate: new Date(),
        returnReason 
      };
      
      // If verification link not approved and asset returned, mark as Revoked and expire the token
      const currentAllocation = await storage.getAllocation(id);
      if (currentAllocation?.verificationStatus === "Pending" || currentAllocation?.verificationStatus === "Rejected") {
        updateData.verificationStatus = "Revoked";
        updateData.verificationToken = null; // Expire the verification link
      }
      
      const allocation = await storage.updateAllocation(id, updateData);
      await storage.updateAsset(allocation.assetId, { status: status as any });

      const asset = await storage.getAsset(allocation.assetId);
      const employee = await storage.getEmployee(allocation.employeeId);

      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Return Asset", 
        entityType: "Allocation", 
        entityId: id,
        details: { 
          assetSerial: asset?.serialNumber,
          employeeName: employee?.name,
          reason: returnReason,
          verificationRevoked: currentAllocation?.verificationStatus === "Pending"
        }
      });

      res.json(allocation);
    } catch (err) {
      console.error("Return asset error:", err);
      res.status(400).json({ message: "Failed to return asset" });
    }
  });

  app.get(api.stats.dashboard.path, requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/audit/logs", requireAdmin, async (req, res) => {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
    res.json(logs);
  });

  // Departments
  app.get("/api/departments", requireAuth, async (req, res) => {
    const depts = await storage.getDepartments();
    res.json(depts);
  });

  app.post("/api/departments", requireAdmin, async (req, res) => {
    try {
      const input = insertDepartmentSchema.parse(req.body);
      const dept = await storage.createDepartment(input);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Create Department", 
        entityType: "Department", 
        entityId: dept.id,
        details: { name: dept.name }
      });
      
      res.status(201).json(dept);
    } catch (err) {
      res.status(400).json({ message: "Failed to create department" });
    }
  });

  app.delete("/api/departments/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDepartment(id);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Delete Department", 
        entityType: "Department", 
        entityId: id
      });
      
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  app.post("/api/departments/bulk", requireAdmin, async (req, res) => {
    try {
      const depts = req.body;
      if (!Array.isArray(depts)) return res.status(400).json({ message: "Expected array" });
      
      let count = 0;
      for (const d of depts) {
        try {
          await storage.createDepartment({ name: d.name });
          count++;
        } catch (e) {}
      }
      
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Departments", details: { count } });
      res.status(201).json({ count });
    } catch (err) {
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  // Designations
  app.get("/api/designations", requireAuth, async (req, res) => {
    const desigs = await storage.getDesignations();
    res.json(desigs);
  });

  app.post("/api/designations", requireAdmin, async (req, res) => {
    try {
      const input = insertDesignationSchema.parse(req.body);
      const desig = await storage.createDesignation(input);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Create Designation", 
        entityType: "Designation", 
        entityId: desig.id,
        details: { name: desig.name }
      });
      
      res.status(201).json(desig);
    } catch (err) {
      res.status(400).json({ message: "Failed to create designation" });
    }
  });

  app.delete("/api/designations/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDesignation(id);
      
      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Delete Designation", 
        entityType: "Designation", 
        entityId: id
      });
      
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Failed to delete designation" });
    }
  });

  app.post("/api/designations/bulk", requireAdmin, async (req, res) => {
    try {
      const desigs = req.body;
      if (!Array.isArray(desigs)) return res.status(400).json({ message: "Expected array" });
      
      let count = 0;
      for (const d of desigs) {
        try {
          await storage.createDesignation({ name: d.name });
          count++;
        } catch (e) {}
      }
      
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Designations", details: { count } });
      res.status(201).json({ count });
    } catch (err) {
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  // Custom Fields
  app.get("/api/custom-fields", requireAuth, async (req, res) => {
    const entity = req.query.entity as string | undefined;
    const fields = await storage.getCustomFields(entity);
    res.json(fields);
  });

  app.post("/api/custom-fields", requireAdmin, async (req, res) => {
    try {
      const input = insertCustomFieldSchema.parse(req.body);
      const field = await storage.createCustomField(input);
      res.status(201).json(field);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Invalid field data", errors: err.errors });
      }
      if (err.code === "23505") {
        return res.status(409).json({ message: "A field with this key already exists for this entity" });
      }
      res.status(500).json({ message: err.message || "Failed to create custom field" });
    }
  });

  app.patch("/api/custom-fields/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCustomField(id);
      if (!existing) return res.status(404).json({ message: "Custom field not found" });
      const partial = insertCustomFieldSchema.partial().parse(req.body);
      const field = await storage.updateCustomField(id, partial);
      res.json(field);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Invalid field data", errors: err.errors });
      }
      if (err.code === "23505") {
        return res.status(409).json({ message: "A field with this key already exists for this entity" });
      }
      res.status(500).json({ message: err.message || "Failed to update custom field" });
    }
  });

  app.delete("/api/custom-fields/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCustomField(id);
      if (!existing) return res.status(404).json({ message: "Custom field not found" });
      await storage.deleteCustomField(id);
      res.json({ message: "Field deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete custom field" });
    }
  });

  app.get("/api/custom-fields/dropdown-sources", requireAdmin, async (req, res) => {
    res.json([
      { value: "departments", label: "Departments" },
      { value: "designations", label: "Designations" },
      { value: "employees", label: "Employees" },
      { value: "asset_types", label: "Asset Types" },
      { value: "assets", label: "Assets" },
    ]);
  });

  // Employees
  app.get(api.employees.list.path, requireAuth, async (req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post(api.employees.create.path, requireAdmin, async (req, res) => {
    const input = insertEmployeeSchema.parse(req.body);
    const employee = await storage.createEmployee(input);
    
    await storage.createAuditLog({
      userId: (req.user as User).id,
      action: "Create Employee",
      entityType: "Employee",
      entityId: employee.id,
      details: { empId: employee.empId, name: employee.name }
    });

    res.status(201).json(employee);
  });

  app.post("/api/employees/bulk", requireAdmin, async (req, res) => {
    try {
      const employees = req.body;
      if (!Array.isArray(employees)) return res.status(400).json({ message: "Expected array" });
      
      const created = [];
      const existing = [];
      const failed = [];

      for (const e of employees) {
        try {
          // Auto-create departments if they don't exist
          if (e.department) {
            const depts = await storage.getDepartments();
            if (!depts.find(d => d.name === e.department)) {
              await storage.createDepartment({ name: e.department });
            }
          }

          // Auto-create designations if they don't exist
          if (e.designation) {
            const desigs = await storage.getDesignations();
            if (!desigs.find(d => d.name === e.designation)) {
              await storage.createDesignation({ name: e.designation });
            }
          }

          // Check if employee already exists
          const allEmployees = await storage.getEmployees();
          const existingEmp = allEmployees.find(emp => emp.email === e.email || emp.empId === e.empId);

          if (existingEmp) {
            existing.push({ ...e, employeeId: existingEmp.id, currentData: existingEmp });
          } else {
            const newEmp = await storage.createEmployee(e);
            created.push({ ...e, employeeId: newEmp.id });
          }
        } catch (err: any) {
          failed.push({ ...e, error: err.message });
        }
      }

      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Bulk Import Employees", 
        details: { 
          createdCount: created.length, 
          existingCount: existing.length,
          failedCount: failed.length,
          createdData: created,
          existingData: existing,
          failedData: failed
        } 
      });
      
      res.status(201).json({ created, existing, failed, createdCount: created.length, existingCount: existing.length, failedCount: failed.length });
    } catch (err) {
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  app.post("/api/employees/import", requireAdmin, async (req, res) => {
    try {
      const employees = req.body;
      if (!Array.isArray(employees)) return res.status(400).json({ message: "Expected array" });
      
      let count = 0;
      for (const e of employees) {
        try {
          await storage.createEmployee(e);
          count++;
        } catch (err) {}
      }
      
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Import Employees", details: { count } });
      res.status(201).json({ count });
    } catch (err) {
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  // Email Settings
  app.get("/api/settings/email", requireAdmin, async (req, res) => {
    const settings = await storage.getEmailSettings();
    res.json(settings || {});
  });

  app.post("/api/settings/email", requireAdmin, async (req, res) => {
    try {
      const { id, updatedAt, createdAt, ...updateData } = req.body;
      const settings = await storage.updateEmailSettings(updateData);
      res.json(settings);
    } catch (err) {
      console.error("Failed to update email settings:", err);
      res.status(500).json({ message: "Failed to update email settings" });
    }
  });

  // Bulk Upload Templates
  app.get("/api/templates/allocations", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const employees = await storage.getEmployees();
      const assetTypes = await storage.getAssetTypes();
      
      const basic = [
        {
          "Asset ID": assets[0]?.id || "1",
          "Employee ID": employees[0]?.id || "1",
          "Status": "Active",
          "Remarks": ""
        }
      ];

      const autoCreate = [
        {
          "Asset Serial Number": assets[0]?.serialNumber || "SN001",
          "Asset Type": assetTypes[0]?.name || "Laptop",
          "Employee Name": employees[0]?.name || "John Doe",
          "Employee Email": employees[0]?.email || "john.doe@company.com",
          "Employee ID": employees[0]?.empId || "EMP001",
          "Department": employees[0]?.department || "Engineering",
          "Designation": employees[0]?.designation || "Developer",
          "Branch": employees[0]?.branch || "Main",
          "Mobile": employees[0]?.mobile || "+1234567890",
          "Status": "Active",
          "Remarks": ""
        }
      ];

      res.json({ basic, autoCreate });
    } catch (err) {
      res.status(500).json({ message: "Failed to generate templates" });
    }
  });

  // Report APIs
  app.get("/api/reports/asset-inventory", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          at.name as type,
          COUNT(*) as count,
          SUM(CASE WHEN a.status = 'Available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN a.status = 'Allocated' THEN 1 ELSE 0 END) as allocated,
          SUM(CASE WHEN a.status = 'Damaged' THEN 1 ELSE 0 END) as damaged,
          SUM(CASE WHEN a.status = 'Lost' THEN 1 ELSE 0 END) as lost,
          SUM(CASE WHEN a.status = 'Scrapped' THEN 1 ELSE 0 END) as scrapped
        FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        GROUP BY at.id, at.name
        ORDER BY at.name
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Asset inventory report error:", err);
      res.status(500).json({ message: "Failed to fetch asset inventory report" });
    }
  });

  app.get("/api/reports/employee-assets", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          e.emp_id,
          e.name as employee_name,
          e.department,
          e.designation,
          COUNT(DISTINCT a.id) as total_assets,
          SUM(CASE WHEN alloc.status = 'Active' THEN 1 ELSE 0 END) as active_assets,
          SUM(CASE WHEN alloc.status = 'Returned' THEN 1 ELSE 0 END) as returned_assets
        FROM employees e
        LEFT JOIN allocations alloc ON e.id = alloc.employee_id
        LEFT JOIN assets a ON alloc.asset_id = a.id
        GROUP BY e.id, e.emp_id, e.name, e.department, e.designation
        ORDER BY e.name
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Employee assets report error:", err);
      res.status(500).json({ message: "Failed to fetch employee assets report" });
    }
  });

  app.get("/api/reports/department-assets", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          COALESCE(e.department, 'Unassigned') as department,
          COUNT(DISTINCT a.id) as total_assets,
          SUM(CASE WHEN a.status = 'Available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN a.status = 'Allocated' THEN 1 ELSE 0 END) as allocated,
          SUM(CASE WHEN a.status = 'Damaged' THEN 1 ELSE 0 END) as damaged,
          COUNT(DISTINCT alloc.employee_id) as employee_count
        FROM assets a
        LEFT JOIN allocations alloc ON a.id = alloc.asset_id AND alloc.status = 'Active'
        LEFT JOIN employees e ON alloc.employee_id = e.id
        GROUP BY COALESCE(e.department, 'Unassigned')
        ORDER BY COALESCE(e.department, 'Unassigned')
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Department assets report error:", err);
      res.status(500).json({ message: "Failed to fetch department assets report" });
    }
  });

  app.get("/api/reports/asset-status", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          a.serial_number,
          at.name as asset_type,
          a.status,
          COALESCE(e.name, 'Not Allocated') as employee_name,
          COALESCE(e.emp_id, '-') as employee_id,
          COALESCE(e.department, '-') as department,
          COALESCE(TO_CHAR(alloc.allocated_at, 'YYYY-MM-DD'), '-') as allocated_date,
          COALESCE(TO_CHAR(alloc.return_date, 'YYYY-MM-DD'), '-') as return_date
        FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        LEFT JOIN allocations alloc ON a.id = alloc.asset_id AND alloc.status = 'Active'
        LEFT JOIN employees e ON alloc.employee_id = e.id
        ORDER BY a.serial_number
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Asset status report error:", err);
      res.status(500).json({ message: "Failed to fetch asset status report" });
    }
  });

  app.get("/api/reports/asset-returns", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          a.serial_number,
          at.name as asset_type,
          e.name as employee_name,
          e.emp_id,
          e.department,
          TO_CHAR(alloc.allocated_at, 'YYYY-MM-DD') as allocated_date,
          TO_CHAR(alloc.return_date, 'YYYY-MM-DD') as return_date,
          CASE 
            WHEN alloc.return_date IS NOT NULL THEN 'Returned'
            ELSE CASE WHEN a.status IN ('Damaged', 'Lost', 'Scrapped') THEN a.status ELSE 'N/A' END
          END as final_status,
          alloc.return_reason
        FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        LEFT JOIN allocations alloc ON a.id = alloc.asset_id
        LEFT JOIN employees e ON alloc.employee_id = e.id
        WHERE alloc.return_date IS NOT NULL OR a.status IN ('Damaged', 'Lost', 'Scrapped')
        ORDER BY COALESCE(alloc.return_date, a.updated_at) DESC
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Asset returns report error:", err);
      res.status(500).json({ message: "Failed to fetch asset returns report" });
    }
  });

  app.get("/api/reports/verification-status", requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          a.serial_number,
          at.name as asset_type,
          COALESCE(e.name, 'Not Allocated') as employee_name,
          COALESCE(e.emp_id, '-') as employee_id,
          alloc.verification_status,
          TO_CHAR(alloc.allocated_at, 'YYYY-MM-DD') as allocated_date,
          TO_CHAR(v.verified_at, 'YYYY-MM-DD') as verified_date,
          COALESCE(u.full_name, 'N/A') as verified_by
        FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        LEFT JOIN allocations alloc ON a.id = alloc.asset_id
        LEFT JOIN employees e ON alloc.employee_id = e.id
        LEFT JOIN verifications v ON a.id = v.asset_id
        LEFT JOIN users u ON v.verifier_id = u.id
        WHERE alloc.id IS NOT NULL
        ORDER BY a.serial_number
      `);
      res.json(result.rows || []);
    } catch (err) {
      console.error("Verification status report error:", err);
      res.status(500).json({ message: "Failed to fetch verification status report" });
    }
  });

  return httpServer;
}
