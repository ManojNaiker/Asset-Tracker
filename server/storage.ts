import { 
  User, InsertUser, Employee, InsertEmployee, AssetType, Asset, InsertAsset, 
  Allocation, InsertAllocation, Verification, InsertVerification, AuditLog,
  users, employees, assetTypes, assets, allocations, verifications, auditLogs,
  EmailSettings, InsertEmailSettings, emailSettings,
  SsoSettings, InsertSsoSettings, ssoSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, or, sql, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { role?: string, mustChangePassword?: boolean }): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  // Employees
  getEmployees(query?: { search?: string, branch?: string, department?: string }): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByEmpId(empId: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, updates: Partial<Employee>): Promise<Employee>;
  
  // Asset Types
  getAssetTypes(): Promise<AssetType[]>;
  getAssetType(id: number): Promise<AssetType | undefined>;
  createAssetType(type: Partial<AssetType>): Promise<AssetType>;
  updateAssetType(id: number, updates: Partial<AssetType>): Promise<AssetType>;
  
  // Assets
  getAssets(query?: { search?: string, typeId?: number, status?: string }): Promise<(Asset & { type: AssetType })[]>;
  getAsset(id: number): Promise<(Asset & { type: AssetType }) | undefined>;
  getAssetBySerial(serial: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  createAssetsBulk(assets: InsertAsset[]): Promise<Asset[]>;
  updateAsset(id: number, updates: Partial<Asset>): Promise<Asset>;
  deleteAsset(id: number): Promise<void>;
  
  // Allocations
  getAllocations(): Promise<(Allocation & { asset: Asset, employee: Employee })[]>;
  getAllocation(id: number): Promise<Allocation | undefined>;
  createAllocation(allocation: InsertAllocation): Promise<Allocation>;
  createAllocationsBulk(allocations: InsertAllocation[]): Promise<Allocation[]>;
  updateAllocation(id: number, updates: Partial<Allocation>): Promise<Allocation>;
  
  // Verifications
  getVerifications(): Promise<Verification[]>;
  createVerification(verification: InsertVerification): Promise<Verification>;
  
  // Audit Logs
  createAuditLog(log: Partial<AuditLog>): Promise<AuditLog>;

  // Email Settings
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;

  // SSO Settings
  getSsoSettings(): Promise<SsoSettings | undefined>;
  updateSsoSettings(settings: InsertSsoSettings): Promise<SsoSettings>;
  
  // Stats
  getDashboardStats(): Promise<{
    totalAssets: number;
    allocatedAssets: number;
    availableAssets: number;
    totalEmployees: number;
    assetsByStatus: { status: string, count: number }[];
    assetsByType: { name: string, count: number }[];
  }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { role?: string, mustChangePassword?: boolean }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Employees
  async getEmployees(query?: { search?: string, branch?: string, department?: string }): Promise<Employee[]> {
    const conditions = [];
    if (query?.search) {
      conditions.push(or(
        ilike(employees.name, `%${query.search}%`),
        ilike(employees.empId, `%${query.search}%`),
        ilike(employees.email, `%${query.search}%`)
      ));
    }
    if (query?.branch) conditions.push(eq(employees.branch, query.branch));
    if (query?.department) conditions.push(eq(employees.department, query.department));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(employees).where(whereClause);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getEmployeeByEmpId(empId: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.empId, empId));
    return employee;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, updates: Partial<Employee>): Promise<Employee> {
    const [updated] = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return updated;
  }

  // Asset Types
  async getAssetTypes(): Promise<AssetType[]> {
    return db.select().from(assetTypes);
  }

  async getAssetType(id: number): Promise<AssetType | undefined> {
    const [type] = await db.select().from(assetTypes).where(eq(assetTypes.id, id));
    return type;
  }

  async createAssetType(type: Partial<AssetType>): Promise<AssetType> {
    const [newType] = await db.insert(assetTypes).values(type as any).returning();
    return newType;
  }

  async updateAssetType(id: number, updates: Partial<AssetType>): Promise<AssetType> {
    const [updated] = await db.update(assetTypes).set(updates).where(eq(assetTypes.id, id)).returning();
    return updated;
  }

  // Assets
  async getAssets(query?: { search?: string, typeId?: number, status?: string }): Promise<(Asset & { type: AssetType })[]> {
    const conditions = [];
    if (query?.search) {
      conditions.push(or(
        ilike(assets.serialNumber, `%${query.search}%`)
      ));
    }
    if (query?.typeId && !isNaN(query.typeId)) conditions.push(eq(assets.assetTypeId, query.typeId));
    if (query?.status && query.status !== 'undefined') conditions.push(eq(assets.status, query.status as any));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const result = await db.select({
      asset: assets,
      type: assetTypes
    })
    .from(assets)
    .leftJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .where(whereClause);

    return result.map(r => ({ ...r.asset, type: r.type || { id: 0, name: 'Unknown', description: '', schema: [], createdAt: new Date() } }));
  }

  async getAsset(id: number): Promise<(Asset & { type: AssetType }) | undefined> {
    const [result] = await db.select({
      asset: assets,
      type: assetTypes
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .where(eq(assets.id, id));

    if (!result) return undefined;
    return { ...result.asset, type: result.type };
  }

  async getAssetBySerial(serial: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.serialNumber, serial));
    return asset;
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [newAsset] = await db.insert(assets).values(asset).returning();
    return newAsset;
  }

  async createAssetsBulk(assetsList: InsertAsset[]): Promise<Asset[]> {
    const newAssets = await db.insert(assets).values(assetsList).returning();
    return newAssets;
  }

  async updateAsset(id: number, updates: Partial<Asset>): Promise<Asset> {
    const [updated] = await db.update(assets).set(updates).where(eq(assets.id, id)).returning();
    return updated;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  // Allocations
  async getAllocations(): Promise<(Allocation & { asset: Asset, employee: Employee })[]> {
    const result = await db.select({
      allocation: allocations,
      asset: assets,
      employee: employees
    })
    .from(allocations)
    .innerJoin(assets, eq(allocations.assetId, assets.id))
    .innerJoin(employees, eq(allocations.employeeId, employees.id))
    .orderBy(desc(allocations.allocatedAt));

    return result.map(r => ({ ...r.allocation, asset: r.asset, employee: r.employee }));
  }

  async getAllocation(id: number): Promise<Allocation | undefined> {
    const [allocation] = await db.select().from(allocations).where(eq(allocations.id, id));
    return allocation;
  }

  async createAllocation(allocation: InsertAllocation): Promise<Allocation> {
    const [newAllocation] = await db.insert(allocations).values(allocation).returning();
    return newAllocation;
  }

  async createAllocationsBulk(allocationsList: InsertAllocation[]): Promise<Allocation[]> {
    const newAllocations = await db.insert(allocations).values(allocationsList).returning();
    return newAllocations;
  }

  async updateAllocation(id: number, updates: Partial<Allocation>): Promise<Allocation> {
    const [updated] = await db.update(allocations).set(updates).where(eq(allocations.id, id)).returning();
    return updated;
  }

  // Verifications
  async getVerifications(): Promise<Verification[]> {
    return db.select().from(verifications).orderBy(desc(verifications.verifiedAt));
  }

  async createVerification(verification: InsertVerification): Promise<Verification> {
    const [newVerification] = await db.insert(verifications).values(verification).returning();
    return newVerification;
  }

  // Audit Logs
  async createAuditLog(log: Partial<AuditLog>): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log as any).returning();
    return newLog;
  }

  // Email Settings
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).limit(1);
    return settings;
  }

  async updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const [existing] = await db.select().from(emailSettings).limit(1);
    if (existing) {
      const [updated] = await db.update(emailSettings).set(settings).where(eq(emailSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [newSettings] = await db.insert(emailSettings).values(settings).returning();
      return newSettings;
    }
  }

  // SSO Settings
  async getSsoSettings(): Promise<SsoSettings | undefined> {
    const [settings] = await db.select().from(ssoSettings).limit(1);
    return settings;
  }

  async updateSsoSettings(settings: InsertSsoSettings): Promise<SsoSettings> {
    const [existing] = await db.select().from(ssoSettings).limit(1);
    if (existing) {
      const [updated] = await db.update(ssoSettings).set(settings).where(eq(ssoSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [newSettings] = await db.insert(ssoSettings).values(settings).returning();
      return newSettings;
    }
  }

  // Stats
  async getDashboardStats(): Promise<{
    totalAssets: number;
    allocatedAssets: number;
    availableAssets: number;
    totalEmployees: number;
    assetsByStatus: { status: string, count: number }[];
    assetsByType: { name: string, count: number }[];
  }> {
    const [totalAssetsRes] = await db.select({ count: sql<number>`count(*)` }).from(assets);
    const [allocatedAssetsRes] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'Allocated'));
    const [availableAssetsRes] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, 'Available'));
    const [totalEmployeesRes] = await db.select({ count: sql<number>`count(*)` }).from(employees);

    const assetsByStatus = await db.select({
      status: assets.status,
      count: sql<number>`count(*)::int`
    }).from(assets).groupBy(assets.status);

    const assetsByTypeRes = await db.select({
      name: assetTypes.name,
      count: sql<number>`count(*)::int`
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .groupBy(assetTypes.name);

    return {
      totalAssets: Number(totalAssetsRes?.count || 0),
      allocatedAssets: Number(allocatedAssetsRes?.count || 0),
      availableAssets: Number(availableAssetsRes?.count || 0),
      totalEmployees: Number(totalEmployeesRes?.count || 0),
      assetsByStatus: assetsByStatus.map(s => ({ ...s, status: s.status as string })),
      assetsByType: assetsByTypeRes
    };
  }
}

export const storage = new DatabaseStorage();
