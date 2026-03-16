import FtpSrv from "ftp-srv";
import path from "path";
import { db } from "./db";
import { ftpUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { log } from "./index";
import { BACKUPS_DIR } from "./backup-scheduler";

let ftpServer: any = null;

export function startFtpServer() {
  const ftpPort = parseInt(process.env.FTP_PORT || "2121", 10);
  const host = "0.0.0.0";

  try {
    ftpServer = new FtpSrv({
      url: `ftp://${host}:${ftpPort}`,
      pasv_url: process.env.FTP_PASV_HOST || "127.0.0.1",
      pasv_min: 3000,
      pasv_max: 3009,
      anonymous: false,
      greeting: ["Light Finance Backup FTP Server"],
    });

    ftpServer.on("login", async ({ connection, username, password }: any, resolve: any, reject: any) => {
      try {
        const [user] = await db.select().from(ftpUsers).where(eq(ftpUsers.username, username));
        if (!user || !user.isActive) {
          return reject(new Error("Invalid credentials"));
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return reject(new Error("Invalid credentials"));
        }
        log(`FTP login: ${username}`, "ftp");
        resolve({ root: BACKUPS_DIR });
      } catch (err) {
        reject(new Error("Authentication error"));
      }
    });

    ftpServer.listen().then(() => {
      log(`FTP server started on port ${ftpPort} — backups/ folder accessible`, "ftp");
    });
  } catch (err) {
    log(`FTP server failed to start: ${err}`, "ftp");
  }
}

export function stopFtpServer() {
  if (ftpServer) {
    ftpServer.close();
    ftpServer = null;
  }
}
