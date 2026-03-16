import cron from "node-cron";
import fs from "fs";
import path from "path";
import { db } from "./db";
import * as schema from "@shared/schema";
import { log } from "./index";

export const BACKUPS_DIR = path.join(process.cwd(), "backups");

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export async function createBackupFile(label?: string): Promise<string> {
  const [
    usersData,
    employeesData,
    assetTypesData,
    assetsData,
    allocationsData,
    verificationsData,
    departmentsData,
    designationsData,
    emailSettingsData,
    ssoSettingsData,
    pageSettingsData,
    auditLogsData,
    customFieldsData,
    bulkUploadLogsData,
    profileUpdateRequestsData,
  ] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.employees),
    db.select().from(schema.assetTypes),
    db.select().from(schema.assets),
    db.select().from(schema.allocations),
    db.select().from(schema.verifications),
    db.select().from(schema.departments),
    db.select().from(schema.designations),
    db.select().from(schema.emailSettings),
    db.select().from(schema.ssoSettings),
    db.select().from(schema.pageSettings),
    db.select().from(schema.auditLogs),
    db.select().from(schema.customFields),
    db.select().from(schema.bulkUploadLogs),
    db.select().from(schema.profileUpdateRequests),
  ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    label: label || "auto",
    data: {
      users: usersData,
      employees: employeesData,
      assetTypes: assetTypesData,
      assets: assetsData,
      allocations: allocationsData,
      verifications: verificationsData,
      departments: departmentsData,
      designations: designationsData,
      emailSettings: emailSettingsData,
      ssoSettings: ssoSettingsData,
      pageSettings: pageSettingsData,
      auditLogs: auditLogsData,
      customFields: customFieldsData,
      bulkUploadLogs: bulkUploadLogsData,
      profileUpdateRequests: profileUpdateRequestsData,
    },
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const tag = label ? `-${label}` : "-auto";
  const filename = `backup-${dateStr}${tag}.json`;
  const filepath = path.join(BACKUPS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), "utf-8");
  return filename;
}

export function listBackupFiles(): { filename: string; sizeKB: number; createdAt: string; label: string }[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(filename => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, filename));
      const match = filename.match(/backup-(\d{4}-\d{2}-\d{2})(?:-(.+))?\.json/);
      return {
        filename,
        sizeKB: Math.round(stat.size / 1024 * 10) / 10,
        createdAt: stat.mtime.toISOString(),
        label: match?.[2] || "auto",
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return files;
}

export function startBackupScheduler() {
  // Run at midnight (00:00) every day IST = UTC+5:30, so 18:30 UTC = 00:00 IST
  // Using "30 18 * * *" for IST midnight, or keep simple "0 0 * * *" for server midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      log("Running scheduled midnight backup...", "backup");
      const filename = await createBackupFile("auto");
      log(`Scheduled backup created: ${filename}`, "backup");

      // Keep only the last 30 backup files to save disk space
      const files = listBackupFiles();
      if (files.length > 30) {
        const toDelete = files.slice(30);
        toDelete.forEach(f => {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, f.filename));
            log(`Old backup deleted: ${f.filename}`, "backup");
          } catch {}
        });
      }
    } catch (err) {
      log(`Scheduled backup failed: ${err}`, "backup");
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  log("Backup scheduler started — daily backup at 12:00 AM IST", "backup");
}
