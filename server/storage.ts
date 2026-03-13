import { 
  User, InsertUser, Employee, InsertEmployee, AssetType, Asset, InsertAsset, 
  Allocation, InsertAllocation, Verification, InsertVerification, AuditLog,
  Department, InsertDepartment, Designation, InsertDesignation,
  CustomField, InsertCustomField,
  users, employees, assetTypes, assets, allocations, verifications, auditLogs,
  departments, designations, customFields,
  EmailSettings, InsertEmailSettings, emailSettings,
  SsoSettings, InsertSsoSettings, ssoSettings,
  PageSettings, InsertPageSettings, pageSettings,
  ProfileUpdateRequest, profileUpdateRequests
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
  getAllocationByToken(token: string): Promise<(Allocation & { asset: Asset & { type: AssetType }, employee: Employee }) | undefined>;
  createAllocation(allocation: InsertAllocation): Promise<Allocation>;
  createAllocationsBulk(allocations: InsertAllocation[]): Promise<Allocation[]>;
  updateAllocation(id: number, updates: Partial<Allocation>): Promise<Allocation>;
  
  // Verifications
  getVerifications(): Promise<Verification[]>;
  getVerificationWithDetails(id: number): Promise<any>;
  createVerification(verification: InsertVerification): Promise<Verification>;
  
  // Departments
  getDepartments(): Promise<Department[]>;
  createDepartment(dept: InsertDepartment): Promise<Department>;
  createDepartmentsBulk(depts: InsertDepartment[]): Promise<Department[]>;
  deleteDepartment(id: number): Promise<void>;

  // Designations
  getDesignations(): Promise<Designation[]>;
  createDesignation(desig: InsertDesignation): Promise<Designation>;
  createDesignationsBulk(desigs: InsertDesignation[]): Promise<Designation[]>;
  deleteDesignation(id: number): Promise<void>;

  // Custom Fields
  getCustomFields(entity?: string): Promise<CustomField[]>;
  getCustomField(id: number): Promise<CustomField | undefined>;
  createCustomField(field: InsertCustomField): Promise<CustomField>;
  updateCustomField(id: number, updates: Partial<CustomField>): Promise<CustomField>;
  deleteCustomField(id: number): Promise<void>;

  // Audit Logs
  createAuditLog(log: Partial<AuditLog>): Promise<AuditLog>;

  // Email Settings
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;

  // SSO Settings
  getSsoSettings(): Promise<SsoSettings | undefined>;
  updateSsoSettings(settings: InsertSsoSettings): Promise<SsoSettings>;

  // Page Settings
  getPageSettings(): Promise<PageSettings | undefined>;
  updatePageSettings(settings: InsertPageSettings): Promise<PageSettings>;
  
  // Profile Update Requests
  getProfileUpdateRequests(status?: string): Promise<(ProfileUpdateRequest & { user: User })[]>;
  getProfileUpdateRequest(id: number): Promise<ProfileUpdateRequest | undefined>;
  getPendingProfileUpdateRequestByUser(userId: number): Promise<ProfileUpdateRequest | undefined>;
  createProfileUpdateRequest(userId: number, requestedData: Record<string, any>): Promise<ProfileUpdateRequest>;
  updateProfileUpdateRequest(id: number, updates: Partial<ProfileUpdateRequest>): Promise<ProfileUpdateRequest>;
  getAdminUsers(): Promise<User[]>;

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
    const result = await pool.query(
      `UPDATE asset_types SET name = COALESCE($1, name), description = $2, "schema" = $3::jsonb WHERE id = $4 RETURNING *`,
      [
        updates.name ?? null,
        updates.description ?? null,
        JSON.stringify(updates.schema ?? []),
        id,
      ]
    );
    return result.rows[0];
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
  async getAllocations(): Promise<(Allocation & { asset: Asset & { type: AssetType }, employee: Employee })[]> {
    const result = await db.select({
      allocation: allocations,
      asset: assets,
      type: assetTypes,
      employee: employees
    })
    .from(allocations)
    .innerJoin(assets, eq(allocations.assetId, assets.id))
    .innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .innerJoin(employees, eq(allocations.employeeId, employees.id))
    .orderBy(desc(allocations.allocatedAt));

    return result.map(r => ({ ...r.allocation, asset: { ...r.asset, type: r.type }, employee: r.employee }));
  }

  async getAllocation(id: number): Promise<Allocation | undefined> {
    const [allocation] = await db.select().from(allocations).where(eq(allocations.id, id));
    return allocation;
  }

  async getAllocationByToken(token: string): Promise<(Allocation & { asset: Asset & { type: AssetType }, employee: Employee }) | undefined> {
    const [result] = await db.select({
      allocation: allocations,
      asset: assets,
      type: assetTypes,
      employee: employees
    })
    .from(allocations)
    .innerJoin(assets, eq(allocations.assetId, assets.id))
    .innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
    .innerJoin(employees, eq(allocations.employeeId, employees.id))
    .where(eq(allocations.verificationToken, token));

    if (!result) return undefined;
    return { ...result.allocation, asset: { ...result.asset, type: result.type }, employee: result.employee };
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

  async getVerificationWithDetails(id: number): Promise<any> {
    const [result] = await db
      .select({
        id: verifications.id,
        status: verifications.status,
        verifiedAt: verifications.verifiedAt,
        remarks: verifications.remarks,
        assetName: assetTypes.name,
        serialNumber: assets.serialNumber
      })
      .from(verifications)
      .innerJoin(assets, eq(verifications.assetId, assets.id))
      .innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id))
      .where(eq(verifications.id, id));
    return result;
  }

  async createVerification(verification: InsertVerification): Promise<Verification> {
    const [newVerification] = await db.insert(verifications).values(verification).returning();
    
    // Update the associated allocation's verification status
    const [allocation] = await db.select().from(allocations).where(eq(allocations.assetId, verification.assetId)).limit(1);
    if (allocation) {
      await db.update(allocations).set({ verificationStatus: verification.status }).where(eq(allocations.id, allocation.id));
    }
    
    return newVerification;
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [newDept] = await db.insert(departments).values(dept).returning();
    return newDept;
  }

  async createDepartmentsBulk(depts: InsertDepartment[]): Promise<Department[]> {
    const newDepts = await db.insert(departments).values(depts).returning();
    return newDepts;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // Designations
  async getDesignations(): Promise<Designation[]> {
    return db.select().from(designations).orderBy(designations.name);
  }

  async createDesignation(desig: InsertDesignation): Promise<Designation> {
    const [newDesig] = await db.insert(designations).values(desig).returning();
    return newDesig;
  }

  async createDesignationsBulk(desigs: InsertDesignation[]): Promise<Designation[]> {
    const newDesigs = await db.insert(designations).values(desigs).returning();
    return newDesigs;
  }

  async deleteDesignation(id: number): Promise<void> {
    await db.delete(designations).where(eq(designations.id, id));
  }

  // Custom Fields
  async getCustomFields(entity?: string): Promise<CustomField[]> {
    if (entity) {
      return db.select().from(customFields).where(eq(customFields.entity, entity)).orderBy(customFields.sortOrder);
    }
    return db.select().from(customFields).orderBy(customFields.sortOrder);
  }

  async getCustomField(id: number): Promise<CustomField | undefined> {
    const [field] = await db.select().from(customFields).where(eq(customFields.id, id));
    return field;
  }

  async createCustomField(field: InsertCustomField): Promise<CustomField> {
    const [created] = await db.insert(customFields).values(field).returning();
    return created;
  }

  async updateCustomField(id: number, updates: Partial<CustomField>): Promise<CustomField> {
    const [updated] = await db.update(customFields).set(updates).where(eq(customFields.id, id)).returning();
    return updated;
  }

  async deleteCustomField(id: number): Promise<void> {
    await db.delete(customFields).where(eq(customFields.id, id));
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

  // Page Settings
  async getPageSettings(): Promise<PageSettings | undefined> {
    const [settings] = await db.select().from(pageSettings).limit(1);
    return settings;
  }

  async updatePageSettings(settings: InsertPageSettings): Promise<PageSettings> {
    const [existing] = await db.select().from(pageSettings).limit(1);
    if (existing) {
      const [updated] = await db.update(pageSettings).set(settings).where(eq(pageSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [newSettings] = await db.insert(pageSettings).values(settings).returning();
      return newSettings;
    }
  }

  // Profile Update Requests
  async getProfileUpdateRequests(status?: string): Promise<(ProfileUpdateRequest & { user: User })[]> {
    const rows = await db.select().from(profileUpdateRequests).orderBy(desc(profileUpdateRequests.requestedAt));
    const result = [];
    for (const row of rows) {
      if (status && row.status !== status) continue;
      const [user] = await db.select().from(users).where(eq(users.id, row.userId));
      if (user) result.push({ ...row, user });
    }
    return result;
  }

  async getProfileUpdateRequest(id: number): Promise<ProfileUpdateRequest | undefined> {
    const [row] = await db.select().from(profileUpdateRequests).where(eq(profileUpdateRequests.id, id));
    return row;
  }

  async getPendingProfileUpdateRequestByUser(userId: number): Promise<ProfileUpdateRequest | undefined> {
    const [row] = await db.select().from(profileUpdateRequests)
      .where(and(eq(profileUpdateRequests.userId, userId), eq(profileUpdateRequests.status, "Pending")));
    return row;
  }

  async createProfileUpdateRequest(userId: number, requestedData: Record<string, any>): Promise<ProfileUpdateRequest> {
    const [row] = await db.insert(profileUpdateRequests).values({ userId, requestedData, status: "Pending" }).returning();
    return row;
  }

  async updateProfileUpdateRequest(id: number, updates: Partial<ProfileUpdateRequest>): Promise<ProfileUpdateRequest> {
    const [row] = await db.update(profileUpdateRequests).set(updates).where(eq(profileUpdateRequests.id, id)).returning();
    return row;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "admin"));
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
