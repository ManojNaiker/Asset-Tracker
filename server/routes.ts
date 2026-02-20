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
import { User, auditLogs, users, emailSettings, insertAssetSchema, insertAssetTypeSchema, insertAllocationSchema, ssoSettings as ssoSettingsTable } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Strategy as MultiSamlStrategy } from "@node-saml/passport-saml";

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

  app.use(session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
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
  const setupSso = async () => {
    try {
      const ssoSettings = await storage.getSsoSettings();
      if (ssoSettings?.isEnabled) {
        const samlStrategy = new (MultiSamlStrategy as any)(
          {
            callbackUrl: `${process.env.APP_URL || ""}/api/auth/saml/callback`,
            issuer: ssoSettings.spEntityId,
            getSamlOptions: async (req: any, done: any) => {
              try {
                const settings = await storage.getSsoSettings();
                if (!settings) return done(new Error("SSO not configured"));
                return done(null, {
                  callbackUrl: settings.isEnabled ? `${req.protocol}://${req.get("host")}/api/auth/saml/callback` : "http://localhost/api/auth/saml/callback",
                  path: "/api/auth/saml/callback",
                  entryPoint: settings.entryPoint,
                  issuer: settings.spEntityId,
                  idpIssuer: settings.idpEntityId,
                  cert: settings.publicKey,
                  logoutUrl: settings.logoutUrl || undefined,
                } as any);
              } catch (err) {
                return done(err as Error);
              }
            }
          } as any,
          (async (profile: any, done: any) => {
            try {
              let user = await storage.getUserByUsername(profile.nameID);
              if (!user && ssoSettings.jitProvisioning) {
                user = await storage.createUser({
                  username: profile.nameID,
                  password: await bcrypt.hash(Math.random().toString(36), 10),
                  role: "employee",
                });
              }
              return done(null, user);
            } catch (err) {
              return done(err);
            }
          }) as any,
          ((profile: any, done: any) => {
            done(null, profile);
          }) as any
        );
        passport.use("saml", samlStrategy as any);
      }
    } catch (err) {
      // console.error("Failed to initialize SSO:", err);
    }
  };
  await setupSso();

  // === SSO Routes ===
  app.get("/api/auth/saml/login", (req, res, next) => {
    passport.authenticate("saml", { failureRedirect: "/auth", failureFlash: true })(req, res, next);
  });

  app.post("/api/auth/saml/callback", 
    passport.authenticate("saml", { failureRedirect: "/auth", failureFlash: true }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/auth/saml/metadata", async (req, res) => {
    try {
      const settings = await storage.getSsoSettings();
      if (!settings?.isEnabled) return res.status(404).send("SSO not enabled");
      
      const strategy = new MultiSamlStrategy(
        {
          callbackUrl: `${req.protocol}://${req.get("host")}/api/auth/saml/callback`,
          issuer: settings.spEntityId,
          getSamlOptions: (req: any, done: any) => {
            done(null, {
              callbackUrl: `${req.protocol}://${req.get("host")}/api/auth/saml/callback`,
              path: "/api/auth/saml/callback",
              entryPoint: settings.entryPoint,
              issuer: settings.spEntityId,
              idpIssuer: settings.idpEntityId,
              cert: settings.publicKey,
            } as any);
          }
        } as any,
        ((profile: any, done: any) => {
          done(null, profile);
        }) as any,
        ((profile: any, done: any) => {
          done(null, profile);
        }) as any
      );

      res.type("application/xml");
      const xml = strategy.generateServiceProviderMetadata(settings.publicKey);
      res.status(200).send(xml);
    } catch (err) {
      console.error("Metadata generation error:", err);
      res.status(500).send("Internal Server Error");
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
  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    const user = req.user as User;
    if (user.isLocked) {
        req.logout(() => {});
        return res.status(423).json({ message: "Account is locked." });
    }
    res.json(user);
  });

  app.post(api.auth.logout.path, (req, res) => {
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
    res.json({ message: "Password updated successfully" });
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
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Create Employee", entityType: "Employee", entityId: employee.id });
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
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Update Employee", entityType: "Employee", entityId: employee.id });
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
    res.status(201).json(asset);
  });

  app.put(api.assets.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const asset = await storage.updateAsset(id, req.body);
    res.json(asset);
  });

  app.get(api.assetTypes.list.path, requireAuth, async (req, res) => {
    const types = await storage.getAssetTypes();
    res.json(types);
  });

  app.post(api.assetTypes.create.path, requireAdmin, async (req, res) => {
    const input = insertAssetTypeSchema.parse(req.body);
    const type = await storage.createAssetType(input);
    res.status(201).json(type);
  });

  app.put(api.assetTypes.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const type = await storage.updateAssetType(id, req.body);
    res.json(type);
  });

  app.get(api.allocations.list.path, requireAuth, async (req, res) => {
    const allocations = await storage.getAllocations();
    res.json(allocations);
  });

  app.post(api.allocations.create.path, requireAdmin, async (req, res) => {
    const input = insertAllocationSchema.parse(req.body);
    const allocation = await storage.createAllocation(input);
    await storage.updateAsset(input.assetId, { status: "Allocated" });
    res.status(201).json(allocation);
  });

  app.get(api.stats.dashboard.path, requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/audit/logs", requireAdmin, async (req, res) => {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
    res.json(logs);
  });

  return httpServer;
}
