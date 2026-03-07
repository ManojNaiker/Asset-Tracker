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
import { User, auditLogs, users, emailSettings, insertAssetSchema, insertAssetTypeSchema, insertAllocationSchema, insertDepartmentSchema, insertDesignationSchema, insertEmployeeSchema, allocations, ssoSettings as ssoSettingsTable, pageSettings } from "@shared/schema";
import crypto from "node:crypto";
import { db } from "./db";
import { desc } from "drizzle-orm";
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
    res.json(settings || { companyName: "AssetAlloc", logoUrl: "/images/logo.png" });
  });

  app.put("/api/settings/page", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updatePageSettings(req.body);
      res.json(settings);
    } catch (err) {
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

      const results = [];
      for (const userData of usersData) {
        try {
          const { username, password, role, fullName, employeeCode, designation, department } = userData;
          if (!username || !password) continue;

          const existingUser = await storage.getUserByUsername(username);
          if (existingUser) continue;

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
          results.push(user);
        } catch (e) {
          console.error("Failed to import user", userData, e);
        }
      }
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Users", details: { count: results.length } });
      res.status(201).json({ count: results.length });
    } catch (err) {
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

  app.post("/api/allocations/:id/return", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { returnReason, status } = req.body;
      const allocation = await storage.updateAllocation(id, { 
        status: "Returned", 
        returnDate: new Date(),
        returnReason 
      });
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
          reason: returnReason
        }
      });

      res.json(allocation);
    } catch (err) {
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
      
      let count = 0;
      for (const e of employees) {
        try {
          await storage.createEmployee(e);
          count++;
        } catch (err) {}
      }
      
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Employees", details: { count } });
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

  return httpServer;
}
