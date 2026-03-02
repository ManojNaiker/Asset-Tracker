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
import { User, auditLogs, users, emailSettings, insertAssetSchema, insertAssetTypeSchema, insertAllocationSchema, insertDepartmentSchema, insertDesignationSchema, ssoSettings as ssoSettingsTable } from "@shared/schema";
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
  app.use(session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: false, // Set to false since we might not be on HTTPS in dev
      httpOnly: true,
      sameSite: 'lax'
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
    if (replitDomain) return `https://${replitDomain}`;
    if (spEntityId && /^https?:\/\//.test(spEntityId)) return spEntityId;
    console.warn("SSO Warning: Could not determine a valid base URL. Set APP_URL environment variable.");
    return "https://localhost";
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
      const callbackUrl = `${baseUrl}/api/auth/saml/callback`;

      console.log(`SAML Config: Issuer=${settings.spEntityId}, CallbackUrl=${callbackUrl}`);

      const samlStrategy = new SamlStrategy(
        {
          callbackUrl,
          entryPoint: settings.entryPoint,
          issuer: settings.spEntityId,
          idpIssuer: settings.idpEntityId,
          idpCert: settings.publicKey,
          logoutUrl: settings.logoutUrl || undefined,
          signatureAlgorithm: 'sha256' as const,
          digestAlgorithm: 'sha256' as const,
          disableRequestedAuthnContext: true,
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
    console.log("SAML callback received");
    passport.authenticate("saml", (err: any, user: any, info: any) => {
      if (err) {
        console.error("SAML callback authentication error:", err.message || err);
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
        
        // Ensure session is saved before redirecting to prevent race conditions where 
        // the subsequent request arrives before the session is persisted.
        req.session.save((err) => {
          if (err) {
            console.error("SAML callback: Session save error:", err);
          }
          return res.redirect("/");
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/saml/metadata", async (req, res) => {
    try {
      const settings = await storage.getSsoSettings();
      if (!settings?.isEnabled) return res.status(404).send("SSO not enabled");
      
      const baseUrl = getSsoBaseUrl(settings.spEntityId);
      const callbackUrl = `${baseUrl}/api/auth/saml/callback`;

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
        action: `Asset ${status}`,
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
    const safePath = `/uploads/${req.file.filename}`;
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
      const input = insertAllocationSchema.parse(req.body);
      const allocation = await storage.createAllocation(input);
      await storage.updateAsset(input.assetId, { status: "Allocated" });

      const asset = await storage.getAsset(input.assetId);
      const employee = await storage.getEmployee(input.employeeId);

      // Send allocation email
      const emailSettings = await storage.getEmailSettings();
      if (emailSettings && emailSettings.host && employee?.email) {
        try {
          const transporter = nodemailer.createTransport({
            host: emailSettings.host,
            port: emailSettings.port || 587,
            secure: emailSettings.secure,
            auth: {
              user: emailSettings.user,
              pass: emailSettings.password,
            },
          });

          const baseUrl = getSsoBaseUrl();
          const verificationUrl = `${baseUrl}/my-assets`;

          await transporter.sendMail({
            from: emailSettings.fromEmail || emailSettings.user,
            to: employee.email,
            subject: `Asset Allocated: ${asset?.type.name} - ${asset?.serialNumber}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
                <h2 style="color: #1e293b;">Asset Allocation Notification</h2>
                <p>Hello ${employee.name},</p>
                <p>A new asset has been allocated to you:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 150px;">Asset Type:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${asset?.type.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Serial Number:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${asset?.serialNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Allocation Date:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${new Date().toLocaleDateString()}</td>
                  </tr>
                </table>
                <p>Please click the button below to view and acknowledge your allocated assets:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    View & Acknowledge Asset
                  </a>
                </div>
                <p style="color: #64748b; font-size: 14px;">If you cannot click the button, copy and paste this link into your browser:<br>${verificationUrl}</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px;">This is an automated message from the Asset Management System.</p>
              </div>
            `,
          });
          console.log(`Allocation email sent to ${employee.email}`);
        } catch (emailErr) {
          console.error("Failed to send allocation email:", emailErr);
        }
      }

      await storage.createAuditLog({ 
        userId: (req.user as User).id, 
        action: "Allocate Asset", 
        entityType: "Allocation", 
        entityId: allocation.id,
        details: { 
          assetSerial: asset?.serialNumber,
          assetType: asset?.type.name,
          employeeName: employee?.name,
          employeeCode: employee?.empId
        }
      });

      res.status(201).json(allocation);
    } catch (err) {
      res.status(400).json({ message: "Failed to create allocation" });
    }
  });

  app.post(api.allocations.return.path, requireAdmin, async (req, res) => {
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
      res.status(400).json({ message: "Invalid department data" });
    }
  });

  app.delete("/api/departments/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteDepartment(id);
    
    await storage.createAuditLog({ 
      userId: (req.user as User).id, 
      action: "Delete Department", 
      entityType: "Department", 
      entityId: id
    });
    
    res.sendStatus(204);
  });

  app.post("/api/departments/bulk", requireAdmin, async (req, res) => {
    try {
      const input = z.array(insertDepartmentSchema).parse(req.body);
      const depts = await storage.createDepartmentsBulk(input);
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Departments", details: { count: depts.length } });
      res.status(201).json(depts);
    } catch (err) {
      res.status(400).json({ message: "Invalid departments data" });
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
      res.status(400).json({ message: "Invalid designation data" });
    }
  });

  app.delete("/api/designations/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteDesignation(id);
    
    await storage.createAuditLog({ 
      userId: (req.user as User).id, 
      action: "Delete Designation", 
      entityType: "Designation", 
      entityId: id
    });
    
    res.sendStatus(204);
  });

  app.post("/api/designations/bulk", requireAdmin, async (req, res) => {
    try {
      const input = z.array(insertDesignationSchema).parse(req.body);
      const desigs = await storage.createDesignationsBulk(input);
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Create Designations", details: { count: desigs.length } });
      res.status(201).json(desigs);
    } catch (err) {
      res.status(400).json({ message: "Invalid designations data" });
    }
  });

  // Employees
  app.get(api.employees.list.path, requireAuth, async (req, res) => {
    const employees = await storage.getEmployees(req.query as { search?: string, branch?: string, department?: string });
    res.json(employees);
  });

  app.post(api.employees.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.employees.create.input.parse(req.body);
      const employee = await storage.createEmployee(input);
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Create Employee", entityType: "Employee", entityId: employee.id, details: input });
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(err.errors);
      throw err;
    }
  });

  app.put(api.employees.update.path, requireAdmin, async (req, res) => {
      const id = parseInt(req.params.id as string);
      const input = api.employees.update.input.parse(req.body);
      const employee = await storage.updateEmployee(id, input);
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Update Employee", entityType: "Employee", entityId: employee.id, details: input });
      res.json(employee);
  });

  app.post(api.employees.import.path, requireAdmin, async (req, res) => {
      const input = api.employees.import.input.parse(req.body);
      let count = 0;
      for (const emp of input) {
        try {
            await storage.createEmployee(emp);
            count++;
        } catch (e) {
            console.error("Failed to import employee", emp, e);
        }
      }
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Import Employees", details: { count } });
      res.json({ count });
  });

  return httpServer;
}
