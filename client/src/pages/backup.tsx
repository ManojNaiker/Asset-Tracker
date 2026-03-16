import { useState, useRef } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, ShieldAlert, CheckCircle2, Loader2, FileJson, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function BackupPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/backup/export", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Your full database backup has been saved." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
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

  const handleImportConfirm = () => {
    if (!importFile) return;
    setConfirmOpen(true);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setConfirmOpen(false);
    try {
      const text = await importFile.text();
      const json = JSON.parse(text);

      const res = await apiRequest("POST", "/api/backup/import", json);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
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

  return (
    <LayoutShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backup &amp; Restore</h1>
          <p className="text-muted-foreground mt-1">
            Export your full application data as a backup file, or restore it from a previously saved backup.
          </p>
        </div>

        {/* Export Card */}
        <Card data-testid="card-backup-export">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Export Backup</CardTitle>
                <CardDescription>Download all application data as a JSON file</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will export <strong>all data</strong> including employees, assets, allocations, verifications, users, settings, and audit logs into a single backup file. Store it safely — you can use it to restore the application at any time.
            </p>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              data-testid="button-export-backup"
              className="gap-2"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? "Exporting..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card data-testid="card-backup-import">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle>Restore from Backup</CardTitle>
                <CardDescription>Replace all current data with a backup file</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Warning — This will overwrite all data</AlertTitle>
              <AlertDescription>
                Restoring a backup will <strong>permanently delete</strong> all current data and replace it with the data from the backup file. This cannot be undone. Take a fresh export first if needed.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Select backup file (.json)</label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-accent/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-import-backup"
              >
                <FileJson className="w-10 h-10 text-muted-foreground" />
                {importFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB — Ready to restore</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Click to choose a backup file</p>
                    <p className="text-xs text-muted-foreground">Only .json backup files are accepted</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-import-file"
              />
            </div>

            {importSuccess && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400">Restore complete</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-300">
                  All data has been restored successfully from the backup file.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleImportConfirm}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirm Restore
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to restore from <strong>{importFile?.name}</strong>.<br /><br />
              This will <strong>permanently delete all existing data</strong> and replace it with the backup. This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-restore">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-restore"
            >
              Yes, Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LayoutShell>
  );
}
