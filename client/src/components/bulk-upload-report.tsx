import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface BulkUploadReport {
  id: number;
  uploadType: string;
  totalRows: number;
  createdCount: number;
  failedCount: number;
  pendingCount: number;
  createdAt: string;
}

export function BulkUploadReport() {
  const [reports, setReports] = useState<BulkUploadReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/allocations/bulk-uploads", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadDetailedReport = async (reportId: number) => {
    try {
      const res = await fetch(`/api/allocations/bulk-uploads/${reportId}`, { credentials: "include" });
      if (res.ok) {
        const log = await res.json();
        
        const data = [
          {
            "Batch ID": reportId,
            "Upload Type": log.uploadType,
            "Total Rows": log.totalRows,
            "Created": log.createdCount,
            "Failed": log.failedCount,
            "Pending": log.pendingCount,
            "Upload Date": new Date(log.createdAt).toLocaleString(),
          }
        ];

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
        
        if (log.createdData?.length > 0) {
          const createdSheet = XLSX.utils.json_to_sheet(log.createdData);
          XLSX.utils.book_append_sheet(workbook, createdSheet, "Created");
        }
        
        if (log.failedData?.length > 0) {
          const failedSheet = XLSX.utils.json_to_sheet(log.failedData);
          XLSX.utils.book_append_sheet(workbook, failedSheet, "Failed");
        }

        XLSX.writeFile(workbook, `bulk_upload_report_${reportId}_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
    } catch (err) {
      console.error("Failed to download report:", err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (reports.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No bulk uploads yet</div>;
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="text-foreground">Batch ID</TableHead>
            <TableHead className="text-foreground">Type</TableHead>
            <TableHead className="text-center text-foreground">Total</TableHead>
            <TableHead className="text-center text-green-600 dark:text-green-400">Created</TableHead>
            <TableHead className="text-center text-red-600 dark:text-red-400">Failed</TableHead>
            <TableHead className="text-center text-blue-600 dark:text-blue-400">Pending</TableHead>
            <TableHead className="text-foreground">Date</TableHead>
            <TableHead className="text-right text-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono text-foreground">{report.id}</TableCell>
              <TableCell className="text-foreground">{report.uploadType}</TableCell>
              <TableCell className="text-center text-foreground">{report.totalRows}</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                  {report.createdCount}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                  {report.failedCount}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  {report.pendingCount}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(report.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => downloadDetailedReport(report.id)}
                  className="text-primary hover:text-primary/80"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
