import { useState, useRef } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, ShieldAlert, CheckCircle2, Loader2,
  FileJson, AlertTriangle, Clock, DatabaseBackup, Trash2,
  RefreshCw, FolderOpen, CalendarClock
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BackupFile = {
  filename: string;
  sizeKB: number;
  createdAt: string;
  label: string;
};

export default function BackupPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  // Load saved backup files list
  const { data: backupFiles = [], isLoading: isLoadingFiles, refetch: refetchFiles } = useQuery<BackupFile[]>({
    queryKey: ["/api/backup/files"],
  });

  // Manual backup now mutation
  const backupNowMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/now"),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Backup created", description: `File saved: ${data.filename}` });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/files"] });
    },
    onError: () => toast({ title: "Backup failed", variant: "destructive" }),
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: (filename: string) => apiRequest("DELETE", `/api/backup/files/${filename}`),
    onSuccess: () => {
      toast({ title: "Backup deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/files"] });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  // Restore from saved file mutation
  const restoreFromFileMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await fetch(`/api/backup/files/${filename}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch backup");
      const json = await res.json();
      const restoreRes = await apiRequest("POST", "/api/backup/import", json);
      if (!restoreRes.ok) {
        const err = await restoreRes.json();
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      toast({ title: "Restore successful", description: "Data has been restored from the selected backup." });
      setRestoreTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Restore failed", description: err.message, variant: "destructive" });
      setRestoreTarget(null);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/backup/export", { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Full database backup saved to your device." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = async (filename: string) => {
    const res = await fetch(`/api/backup/files/${filename}`, { credentials: "include" });
    if (!res.ok) { toast({ title: "Download failed", variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast({ title: "Invalid file", description: "Please select a .json backup file.", variant: "destructive" });
      return;
    }
    setImportFile(file);
    setImportSuccess(false);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setConfirmOpen(false);
    try {
      const text = await importFile.text();
      const json = JSON.parse(text);
      const res = await apiRequest("POST", "/api/backup/import", json);
      if (!res.ok) throw new Error((await res.json()).message || "Import failed");
      setImportSuccess(true);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Restore successful", description: "All data has been restored from backup." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <LayoutShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DatabaseBackup className="w-6 h-6 text-blue-600" />
            Backup &amp; Restore
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatic backup roz raat 12 baje hota hai. WinSCP se <code className="bg-muted px-1 rounded text-xs">backups/</code> folder access karein aur manually bhi backup le sakte hain.
          </p>
        </div>

        {/* Auto Schedule Info */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Automatic Schedule Active</p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Har roz raat <strong>12:00 AM IST</strong> par automatically backup banta hai aur <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">backups/</code> folder mein save hota hai. Last 30 din ke backups stored rahte hain.
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  <strong>WinSCP se access:</strong> SFTP se connect karke <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/home/runner/workspace/backups/</code> folder mein jao — wahan sab backup files milenge.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved Backup Files */}
        <Card data-testid="card-saved-backups">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Saved Backups</CardTitle>
                  <CardDescription>Server par save backup files — download ya restore karein</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchFiles()} data-testid="button-refresh-backups">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => backupNowMutation.mutate()}
                  disabled={backupNowMutation.isPending}
                  data-testid="button-backup-now"
                  className="gap-1"
                >
                  {backupNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
                  Abhi Backup Lo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingFiles ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : backupFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Abhi tak koi backup nahi hai.</p>
                <p className="text-xs mt-1">Raat 12 baje automatic backup hoga, ya upar se "Abhi Backup Lo" dabao.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backupFiles.map((file) => (
                  <div
                    key={file.filename}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    data-testid={`row-backup-${file.filename}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileJson className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.filename}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(file.createdAt)} • {file.sizeKB} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant={file.label === "auto" ? "secondary" : "outline"} className="text-xs">
                        {file.label === "auto" ? "Auto" : file.label === "manual" ? "Manual" : file.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile(file.filename)}
                        data-testid={`button-download-${file.filename}`}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget(file.filename)}
                        data-testid={`button-restore-${file.filename}`}
                        title="Restore from this backup"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(file.filename)}
                        data-testid={`button-delete-${file.filename}`}
                        title="Delete"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Manual Export */}
        <Card data-testid="card-backup-export">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Direct Download (Export)</CardTitle>
                <CardDescription>Apne computer par directly download karein</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Yeh button dabane se turant poora database JSON file ke roop mein aapke computer par download ho jayega.
            </p>
            <Button onClick={handleExport} disabled={isExporting} data-testid="button-export-backup" className="gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? "Exporting..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>

        {/* Import from file */}
        <Card data-testid="card-backup-import">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle>File se Restore karein</CardTitle>
                <CardDescription>WinSCP se download ki gayi file yahan upload karke restore karein</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Dhyan dein — Sab data replace ho jayega</AlertTitle>
              <AlertDescription>
                Restore karne se <strong>poora existing data delete</strong> hoga aur backup file ka data aa jayega. Pehle ek fresh backup zaroor lein.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Backup file chunein (.json)</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-accent/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-import-backup"
              >
                <FileJson className="w-10 h-10 text-muted-foreground" />
                {importFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB — Restore ke liye taiyaar</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Click karke backup file chunein</p>
                    <p className="text-xs text-muted-foreground">Sirf .json backup files accepted hain</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} data-testid="input-import-file" />
            </div>

            {importSuccess && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400">Restore complete</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-300">
                  Sab data backup se successfully restore ho gaya.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!importFile || isImporting}
              variant="destructive"
              className="gap-2"
              data-testid="button-restore-backup"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isImporting ? "Restoring..." : "Restore Backup"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirm import from file */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Restore Confirm karein
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{importFile?.name}</strong> se restore hoga.<br /><br />
              <strong>Sab existing data permanently delete</strong> hoga aur backup ka data aayega. Kya aap sure hain?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-restore">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-restore"
            >
              Haan, Restore Karo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm restore from saved file */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Restore Confirm karein
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{restoreTarget}</strong> se restore hoga.<br /><br />
              <strong>Sab existing data permanently delete</strong> hoga. Kya aap sure hain?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreTarget && restoreFromFileMutation.mutate(restoreTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restoreFromFileMutation.isPending}
            >
              {restoreFromFileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Haan, Restore Karo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup Delete karein?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget}</strong> permanently delete ho jayega. Yeh wapas nahi aayega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Karo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutShell>
  );
}
