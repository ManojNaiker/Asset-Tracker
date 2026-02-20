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
import { User, auditLogs, users, emailSettings, insertAssetSchema, insertAssetTypeSchema } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";
import nodemailer from "nodemailer";

const PgSession = connectPgSimple(session);

import multer from "multer";
import path from "path";
import fs from "fs";

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

import { Strategy as MultiSamlStrategy } from "@node-saml/passport-saml";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === SSO Setup ===
  const ssoSettings = await storage.getSsoSettings();
  if (ssoSettings?.isEnabled) {
    passport.use(new MultiSamlStrategy(
      {
        getSamlOptions: async (req, done) => {
          const settings = await storage.getSsoSettings();
          if (!settings) return done(new Error("SSO not configured"));
          return done(null, {
            path: "/api/auth/saml/callback",
            entryPoint: settings.entryPoint,
            issuer: settings.spEntityId,
            idpIssuer: settings.idpEntityId,
            cert: settings.publicKey,
            logoutUrl: settings.logoutUrl || undefined,
          });
        }
      },
      async (profile: any, done: any) => {
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
      }
    ));
  }

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
        // Increment failed attempts
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
    const settings = await storage.getSsoSettings();
    if (!settings?.isEnabled) return res.status(404).send("SSO not enabled");
    
    const samlStrategy = passport._strategy("saml") as any;
    if (!samlStrategy) return res.status(500).send("SAML strategy not initialized");

    res.type("application/xml");
    res.status(200).send(samlStrategy.generateServiceProviderMetadata(settings.publicKey));
  });

  app.get("/api/settings/sso", requireAdmin, async (req, res) => {
    const settings = await storage.getSsoSettings();
    res.json(settings || {});
  });

  app.put("/api/settings/sso", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateSsoSettings(req.body);
      // Re-initialize passport strategy if needed or just restart
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to update SSO settings" });
    }
  });

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
      // Reset admin password and ensure unlocked
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
    // Session is established by passport.authenticate
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

  // Template routes
  app.get("/api/templates/employees", requireAdmin, (req, res) => {
    res.json([
      {
        "empId": "EMP001",
        "name": "John Doe",
        "branch": "Main Branch",
        "department": "IT",
        "designation": "Software Engineer",
        "mobile": "9876543210",
        "email": "john.doe@example.com",
        "status": "Active",
        "dateOfJoining": "2023-01-01"
      }
    ]);
  });

  app.get("/api/templates/assets", requireAdmin, async (req, res) => {
    const types = await storage.getAssetTypes();
    const template: any[] = [];
    
    types.forEach(type => {
      const row: any = {
        "assetTypeName": type.name,
        "serialNumber": `SN-${type.name.toUpperCase()}-001`,
        "status": "Available"
      };
      
      // Add dynamic fields from schema
      if (Array.isArray(type.schema)) {
        type.schema.forEach((field: any) => {
          row[field.name] = field.type === "number" ? 0 : "Value";
        });
      }
      template.push(row);
    });
    
    res.json(template.length > 0 ? template : [
      {
        "assetTypeName": "Laptop",
        "serialNumber": "SN123456",
        "status": "Available",
        "Brand": "Dell",
        "Model": "Latitude"
      }
    ]);
  });

  app.get("/api/templates/allocations", requireAdmin, async (req, res) => {
    const assets = await storage.getAssets({ status: "Available" });
    const employees = await storage.getEmployees();
    
    // Template 1: Basic Allocation (using IDs)
    const basicTemplate = [
      {
        "employeeId": employees[0]?.id || 1,
        "assetId": assets[0]?.id || 1,
        "status": "Active",
        "remarks": "Sample Allocation"
      }
    ];

    // Template 2: Auto-Create Allocation (using names/serials)
    const autoCreateTemplate = [
      {
        "empId": "EMP001",
        "name": "New Employee",
        "email": "new.employee@example.com",
        "branch": "Main",
        "department": "IT",
        "designation": "Staff",
        "mobile": "1234567890",
        "serialNumber": "SN-NEW-001",
        "assetTypeName": "Laptop",
        "status": "Active",
        "remarks": "Auto-create sample"
      }
    ];

    res.json({ basic: basicTemplate, autoCreate: autoCreateTemplate });
  });

  app.post("/api/allocations/bulk-import", requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ message: "Invalid data format" });
      
      let count = 0;
      for (const item of data) {
        try {
          // Normalizing keys to handle different case/spacing in Excel
          const getItemValue = (keys: string[]) => {
            for (const key of keys) {
              if (item[key] !== undefined) return item[key];
              // Case-insensitive search
              const lowerKey = key.toLowerCase();
              const foundKey = Object.keys(item).find(k => k.toLowerCase() === lowerKey);
              if (foundKey) return item[foundKey];
            }
            return undefined;
          };

          let empId = getItemValue(["empId", "Employee ID", "employeeEmpId"]);
          let name = getItemValue(["name", "Full Name", "Employee Name"]);
          let email = getItemValue(["email", "Email Address"]);
          let branch = getItemValue(["branch", "Branch Name"]);
          let department = getItemValue(["department", "Department Name"]);
          let designation = getItemValue(["designation"]);
          let mobile = getItemValue(["mobile", "Contact", "Phone"]);
          let serialNumber = getItemValue(["serialNumber", "Serial Number", "assetSerialNumber"]);
          let assetTypeName = getItemValue(["assetTypeName", "Asset Type", "Asset Type Name"]);
          let status = getItemValue(["status", "Allocation Status"]);
          let remarks = getItemValue(["remarks", "Note"]);
          
          let employeeId = item.employeeId;
          let assetId = item.assetId;
          
          // Auto-creation logic for employee
          if (!employeeId && empId) {
            const existing = await storage.getEmployeeByEmpId(String(empId));
            if (existing) {
              employeeId = existing.id;
            } else if (name) {
              const newEmp = await storage.createEmployee({
                empId: String(empId), 
                name: String(name), 
                email: String(email || ""), 
                branch: String(branch || ""), 
                department: String(department || ""), 
                designation: String(designation || ""), 
                mobile: String(mobile || ""), 
                status: "Active"
              });
              employeeId = newEmp.id;
              await storage.createAuditLog({ userId: (req.user as User).id, action: "Auto Create Employee (Bulk)", entityType: "Employee", entityId: employeeId });
            }
          }

          // Auto-creation logic for asset
          if (!assetId && serialNumber) {
            const existing = await storage.getAssetBySerial(String(serialNumber));
            if (existing) {
              assetId = existing.id;
            } else if (assetTypeName) {
              const types = await storage.getAssetTypes();
              let type = types.find(t => t.name.toLowerCase() === String(assetTypeName).toLowerCase());
              
              if (!type) {
                // Auto-create asset type if it doesn't exist
                type = await storage.createAssetType({
                  name: String(assetTypeName),
                  description: `Auto-created during bulk allocation`,
                  schema: []
                });
                await storage.createAuditLog({ 
                  userId: (req.user as User).id, 
                  action: "Auto Create Asset Type (Bulk)", 
                  entityType: "AssetType", 
                  entityId: type.id 
                });
              }

              const newAsset = await storage.createAsset({
                serialNumber: String(serialNumber).toUpperCase(),
                assetTypeId: type.id,
                status: "Available",
                specifications: {},
                images: []
              });
              assetId = newAsset.id;
              await storage.createAuditLog({ userId: (req.user as User).id, action: "Auto Create Asset (Bulk)", entityType: "Asset", entityId: assetId });
            }
          }

          if (assetId && employeeId) {
            const allocation = await storage.createAllocation({
              assetId: Number(assetId),
              employeeId: Number(employeeId),
              status: status || "Active",
              pdfUrl: "",
              returnReason: "",
            });
            
            await storage.updateAsset(Number(assetId), { status: (status === "Returned" ? "Available" : "Allocated") });
            
            await storage.createAuditLog({ 
              userId: (req.user as User).id, 
              action: "Allocate Asset (Bulk)", 
              entityType: "Allocation", 
              entityId: allocation.id,
              details: { remarks } 
            });
            count++;
          }
        } catch (e) {
          console.error("Failed to import allocation row", item, e);
        }
      }
      
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Bulk allocation import failed" });
    }
  });

  // Assets bulk import with type resolution
  app.post("/api/assets/bulk-import", requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ message: "Invalid data format" });
      
      const types = await storage.getAssetTypes();
      const typeMap = new Map(types.map(t => [t.name.toLowerCase(), t.id]));
      
      let count = 0;
      for (const item of data) {
        const { assetTypeName, serialNumber, status, ...specifications } = item;
        const assetTypeId = typeMap.get(assetTypeName?.toLowerCase());
        
        if (assetTypeId && serialNumber) {
          try {
            await storage.createAsset({
              assetTypeId,
              serialNumber,
              status: status || "Available",
              specifications,
              images: []
            });
            count++;
          } catch (e) {
            console.error("Failed to import asset row", item, e);
          }
        }
      }
      
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Bulk Import Assets", details: { count } });
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Bulk import failed" });
    }
  });

  // Asset Types
  app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  app.get(api.assetTypes.list.path, requireAuth, async (req, res) => {
    const types = await storage.getAssetTypes();
    res.json(types);
  });

  app.post(api.assetTypes.create.path, requireAdmin, async (req, res) => {
    const input = api.assetTypes.create.input.parse(req.body);
    const type = await storage.createAssetType(input);
    res.status(201).json(type);
  });

  app.put(api.assetTypes.update.path, requireAdmin, async (req, res) => {
      const id = parseInt(req.params.id as string);
      const input = api.assetTypes.update.input.parse(req.body);
      const type = await storage.updateAssetType(id, input);
      res.json(type);
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

  app.post("/api/assets/import", requireAdmin, async (req, res) => {
    try {
      const input = z.array(insertAssetSchema).parse(req.body);
      let count = 0;
      for (const asset of input) {
        try {
          await storage.createAsset(asset);
          count++;
        } catch (e) {
          console.error("Failed to import asset", asset, e);
        }
      }
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Import Assets", details: { count } });
      res.json({ count });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(err.errors);
      res.status(500).json({ message: "Failed to import assets" });
    }
  });

  app.post("/api/asset-types/import", requireAdmin, async (req, res) => {
    try {
      const input = z.array(insertAssetTypeSchema).parse(req.body);
      let count = 0;
      for (const type of input) {
        try {
          await storage.createAssetType(type);
          count++;
        } catch (e) {
          console.error("Failed to import asset type", type, e);
        }
      }
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Import Asset Types", details: { count } });
      res.json({ count });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(err.errors);
      res.status(500).json({ message: "Failed to import asset types" });
    }
  });

  app.post("/api/allocations/import", requireAdmin, async (req, res) => {
    try {
      const input = z.array(z.object({
        employeeEmpId: z.string(),
        assetSerialNumber: z.string(),
        status: z.string().optional(),
        returnReason: z.string().optional()
      })).parse(req.body);

      let count = 0;
      for (const item of input) {
        try {
          const employee = await storage.getEmployeeByEmpId(item.employeeEmpId);
          const asset = await storage.getAssetBySerial(item.assetSerialNumber);

          if (employee && asset) {
            await storage.createAllocation({
              assetId: asset.id,
              employeeId: employee.id,
              status: (item.status as any) || "Active",
              returnReason: item.returnReason || ""
            });
            await storage.updateAsset(asset.id, { status: (item.status === "Returned" ? "Available" : "Allocated") });
            count++;
          }
        } catch (e) {
          console.error("Failed to import allocation", item, e);
        }
      }
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Import Allocations", details: { count } });
      res.json({ count });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(err.errors);
      res.status(500).json({ message: "Failed to import allocations" });
    }
  });

  app.post("/api/settings/email/test", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      if (!settings) return res.status(400).json({ message: "Email settings not configured" });

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure ?? true,
        auth: {
          user: settings.user,
          pass: settings.password,
        },
      });

      await transporter.sendMail({
        from: settings.fromEmail,
        to: settings.fromEmail,
        subject: "Test Email from Asset Management System",
        text: "This is a test email to verify your email configuration.",
      });

      res.json({ message: "Test email sent successfully to " + settings.fromEmail });
    } catch (err: any) {
      console.error("Email test failed:", err);
      res.status(500).json({ message: "Failed to send test email: " + err.message });
    }
  });

  app.post(api.assets.create.path, requireAdmin, async (req, res) => {
    const input = api.assets.create.input.parse(req.body);
    const asset = await storage.createAsset(input);
    await storage.createAuditLog({ userId: (req.user as User).id, action: "Create Asset", entityType: "Asset", entityId: asset.id });
    res.status(201).json(asset);
  });

  app.put(api.assets.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const input = api.assets.update.input.parse(req.body);
    const asset = await storage.updateAsset(id, input);
    await storage.createAuditLog({ userId: (req.user as User).id, action: "Update Asset", entityType: "Asset", entityId: asset.id });
    res.json(asset);
  });

  app.delete(api.assets.delete.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    await storage.deleteAsset(id);
    await storage.createAuditLog({ userId: (req.user as User).id, action: "Delete Asset", entityType: "Asset", entityId: id });
    res.status(204).send();
  });

  // Allocations
  app.get(api.allocations.list.path, requireAuth, async (req, res) => {
    const allocations = await storage.getAllocations();
    res.json(allocations);
  });

  app.post(api.allocations.create.path, requireAdmin, async (req, res) => {
    let { assetId, employeeId, employeeData, assetData, status, pdfUrl, returnReason, remarks, details } = req.body;
    
    // Auto-creation logic
    if (!employeeId && employeeData) {
      const existing = await storage.getEmployeeByEmpId(employeeData.empId);
      if (existing) {
        employeeId = existing.id;
      } else {
        const newEmp = await storage.createEmployee(employeeData);
        employeeId = newEmp.id;
        await storage.createAuditLog({ userId: (req.user as User).id, action: "Auto Create Employee", entityType: "Employee", entityId: employeeId });
      }
    }

    if (!assetId && assetData) {
      const existing = await storage.getAssetBySerial(assetData.serialNumber);
      if (existing) {
        assetId = existing.id;
      } else {
        // Ensure asset type exists if providing type name in assetData
        if (assetData.assetTypeName && !assetData.assetTypeId) {
          const types = await storage.getAssetTypes();
          let type = types.find(t => t.name.toLowerCase() === assetData.assetTypeName.toLowerCase());
          if (!type) {
            type = await storage.createAssetType({
              name: assetData.assetTypeName,
              description: `Auto-created during allocation`,
              schema: []
            });
          }
          assetData.assetTypeId = type.id;
        }
        
        const newAsset = await storage.createAsset(assetData);
        assetId = newAsset.id;
        await storage.createAuditLog({ userId: (req.user as User).id, action: "Auto Create Asset", entityType: "Asset", entityId: assetId });
      }
    }

    if (!assetId || !employeeId) {
      return res.status(400).json({ message: "Asset and Employee are required" });
    }

    const allocation = await storage.createAllocation({
      assetId,
      employeeId,
      status: status || "Active",
      pdfUrl: pdfUrl || "",
      returnReason: returnReason || "",
    });
    
    // Update asset status
    await storage.updateAsset(assetId, { status: "Allocated" });
    
    // Send email notification
    sendAllocationEmail(employeeId, assetId);
    
    await storage.createAuditLog({ 
      userId: (req.user as User).id, 
      action: "Allocate Asset", 
      entityType: "Allocation", 
      entityId: allocation.id,
      details: { ...details, remarks } 
    });
    res.status(201).json(allocation);
  });

  app.post(api.allocations.return.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    const { returnReason, status, details } = req.body;
    
    const allocation = await storage.updateAllocation(id, { 
        status: "Returned", 
        returnDate: new Date(), 
        returnReason 
    });
    
    // Update asset status
    await storage.updateAsset(allocation.assetId, { status: status }); 
    
    await storage.createAuditLog({ 
      userId: (req.user as User).id, 
      action: "Return Asset", 
      entityType: "Allocation", 
      entityId: allocation.id,
      details: JSON.stringify({ returnReason, status, ...details })
    });
    res.json(allocation);
  });

  // Verifications
  app.get(api.verifications.list.path, requireAuth, async (req, res) => {
    const verifications = await storage.getVerifications();
    res.json(verifications);
  });

  app.post(api.verifications.create.path, requireAuth, async (req, res) => {
      const input = api.verifications.create.input.parse(req.body);
      const verification = await storage.createVerification({ ...input, verifierId: (req.user as User).id });
      await storage.createAuditLog({ userId: (req.user as User).id, action: "Verify Asset", entityType: "Verification", entityId: verification.id });
      res.status(201).json(verification);
  });

  // Audit Logs
  app.get("/api/audit-logs", requireAdmin, async (req, res) => {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
    res.json(logs);
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, role } = req.body;
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: role || "employee",
        mustChangePassword: false
      });
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const { password, ...updates } = req.body;
      if (password) {
        updates.password = await bcrypt.hash(password, 10);
      }
      const user = await storage.updateUser(id, updates);
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const currentUser = req.user as User;
      if (currentUser.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Email Settings Routes
  app.get("/api/settings/email", requireAdmin, async (req, res) => {
    const settings = await storage.getEmailSettings();
    res.json(settings || {});
  });

  app.post("/api/settings/email", requireAdmin, async (req, res) => {
    const settings = await storage.updateEmailSettings(req.body);
    res.json(settings);
  });

  // Helper to send email
  async function sendAllocationEmail(employeeId: number, assetId: number) {
    try {
      const settings = await storage.getEmailSettings();
      if (!settings) return;

      const employee = await storage.getEmployee(employeeId);
      const asset = await storage.getAsset(assetId);
      if (!employee || !asset) return;

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure ?? true,
        auth: {
          user: settings.user,
          pass: settings.password,
        },
      });

      await transporter.sendMail({
        from: settings.fromEmail,
        to: employee.email,
        subject: "Asset Allocated: " + asset.serialNumber,
        text: `Hello ${employee.name},\n\nA new asset has been allocated to you.\n\nAsset: ${asset.type.name}\nSerial Number: ${asset.serialNumber}\n\nPlease log in to the system to acknowledge.\n\nBest regards,\nAsset Management Team`,
      });
    } catch (err) {
      console.error("Failed to send email:", err);
    }
  }

  // Stats
  app.get(api.stats.dashboard.path, requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  return httpServer;
}
