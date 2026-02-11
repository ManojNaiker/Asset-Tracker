import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Enums ===
export const userRoles = ["admin", "verifier", "employee"] as const;
export const assetStatuses = ["Available", "Allocated", "Returned", "Damaged", "Lost", "Scrapped"] as const;
export const allocationStatuses = ["Active", "Returned"] as const;
export const verificationStatuses = ["Pending", "Approved", "Rejected"] as const;

// === Tables ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("employee"),
  isLocked: boolean("is_locked").default(false),
  failedAttempts: integer("failed_attempts").default(0),
  mustChangePassword: boolean("must_change_password").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  empId: text("emp_id").notNull().unique(),
  name: text("name").notNull(),
  branch: text("branch"),
  department: text("department"),
  designation: text("designation"),
  mobile: text("mobile"),
  email: text("email").notNull(),
  status: text("status").default("Active"),
  dateOfJoining: date("date_of_joining"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assetTypes = pgTable("asset_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  schema: jsonb("schema").default([]), // Array of field definitions { name, type, required, options }
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetTypeId: integer("asset_type_id").notNull(),
  serialNumber: text("serial_number").notNull().unique(),
  status: text("status", { enum: assetStatuses }).notNull().default("Available"),
  specifications: jsonb("specifications").default({}), // Dynamic fields data
  images: text("images").array(), // Array of image URLs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  allocatedAt: timestamp("allocated_at").defaultNow(),
  returnDate: timestamp("return_date"),
  status: text("status", { enum: allocationStatuses }).default("Active"),
  returnReason: text("return_reason"),
  pdfUrl: text("pdf_url"),
});

export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  verifierId: integer("verifier_id").notNull(),
  verifiedAt: timestamp("verified_at").defaultNow(),
  status: text("status", { enum: verificationStatuses }).default("Pending"),
  remarks: text("remarks"),
  images: text("images").array(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const emailSettings = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  secure: boolean("secure").default(true),
  user: text("user").notNull(),
  password: text("password").notNull(),
  fromEmail: text("from_email").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({ id: true, updatedAt: true });
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;

// === Relations ===
export const assetsRelations = relations(assets, ({ one, many }) => ({
  type: one(assetTypes, {
    fields: [assets.assetTypeId],
    references: [assetTypes.id],
  }),
  allocations: many(allocations),
  verifications: many(verifications),
}));

export const allocationsRelations = relations(allocations, ({ one }) => ({
  asset: one(assets, {
    fields: [allocations.assetId],
    references: [assets.id],
  }),
  employee: one(employees, {
    fields: [allocations.employeeId],
    references: [employees.id],
  }),
}));

// === Insert Schemas ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, isLocked: true, failedAttempts: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertAssetTypeSchema = createInsertSchema(assetTypes).omit({ id: true, createdAt: true });
export type InsertAssetType = z.infer<typeof insertAssetTypeSchema>;
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAllocationSchema = createInsertSchema(allocations).omit({ id: true, allocatedAt: true });
export const insertVerificationSchema = createInsertSchema(verifications).omit({ id: true, verifiedAt: true });

// === Types ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type AssetType = typeof assetTypes.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Allocation = typeof allocations.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Verification = typeof verifications.$inferSelect;
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Request Types
export type LoginRequest = { username: string; password: string };
export type ChangePasswordRequest = { currentPassword?: string; newPassword: string };
