import FtpSrv from "ftp-srv";
import { db } from "./db";
import { ftpUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { log } from "./index";
import { BACKUPS_DIR } from "./backup-scheduler";

let ftpServer: any = null;

async function getPublicIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=text");
    return (await res.text()).trim();
  } catch {
    return "127.0.0.1";
  }
}

export async function startFtpServer() {
  const ftpPort = parseInt(process.env.FTP_PORT || "2121", 10);

  // Get actual public IP for passive mode
  const publicIp = process.env.FTP_PASV_HOST || await getPublicIp();

  try {
    ftpServer = new FtpSrv({
      url: `ftp://0.0.0.0:${ftpPort}`,
      pasv_url: publicIp,
      pasv_min: 4000,
      pasv_max: 4004,
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

    await ftpServer.listen();
    log(`FTP server ready on port ${ftpPort} | PASV IP: ${publicIp} | Backups: ${BACKUPS_DIR}`, "ftp");
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
