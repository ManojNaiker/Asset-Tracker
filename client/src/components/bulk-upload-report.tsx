import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/allocations/bulk-uploads", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const sorted = Array.isArray(data) ? data.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ) : [];
        setReports(sorted);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (reportId: number) => {
    try {
      const res = await fetch(`/api/allocations/bulk-uploads/${reportId}`, { credentials: "include" });
      if (res.ok) {
        const log = await res.json();
        setSelectedDetails(log);
        setDetailsOpen(true);
      } else {
        console.error("Failed to fetch details:", res.statusText);
      }
    } catch (err) {
      console.error("Failed to fetch details:", err);
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
              <TableCell className="text-right space-x-2">
                <Dialog open={detailsOpen && selectedDetails?.id === report.id} onOpenChange={setDetailsOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => viewDetails(report.id)}
                      className="text-primary hover:text-primary/80"
                      title="View Details"
                      data-testid="button-view-bulk-details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  {selectedDetails && selectedDetails.id === report.id && (
                    <DialogContent className="max-w-6xl max-h-[80vh]">
                      <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle>Bulk Upload Details - Batch {selectedDetails.id}</DialogTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadDetailedReport(report.id)}
                          className="text-primary"
                          title="Export to Excel"
                          data-testid="button-export-bulk-details"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </DialogHeader>
                      <div className="space-y-6 p-4 overflow-y-auto max-h-[calc(80vh-100px)]">
                          <div className="grid grid-cols-2 gap-4">
                            <div><span className="font-semibold">Upload Type:</span> {selectedDetails.uploadType}</div>
                            <div><span className="font-semibold">Total Rows:</span> {selectedDetails.totalRows}</div>
                            <div><span className="font-semibold">Created:</span> {selectedDetails.createdCount}</div>
                            <div><span className="font-semibold">Failed:</span> {selectedDetails.failedCount}</div>
                            <div><span className="font-semibold">Pending:</span> {selectedDetails.pendingCount}</div>
                            <div><span className="font-semibold">Date:</span> {new Date(selectedDetails.createdAt).toLocaleString()}</div>
                          </div>
                          
                          {selectedDetails.createdData?.length > 0 && (
                            <div>
                              <h3 className="font-semibold mb-2">Successfully Created ({selectedDetails.createdData.length})</h3>
                              <div className="border rounded w-full overflow-x-auto">
                                <table className="text-sm border-collapse">
                                  <thead className="bg-muted">
                                    <tr>
                                      {Object.keys(selectedDetails.createdData[0] || {}).map(key => (
                                        <th key={key} className="px-3 py-2 text-left border-b border-border whitespace-nowrap">{key}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedDetails.createdData.map((row: any, idx: number) => (
                                      <tr key={idx} className="border-b border-border hover:bg-muted/50">
                                        {Object.keys(selectedDetails.createdData[0] || {}).map(key => (
                                          <td key={key} className="px-3 py-2 whitespace-nowrap">{String(row[key] ?? '')}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          
                          {selectedDetails.failedData?.length > 0 && (
                            <div>
                              <h3 className="font-semibold mb-2">Failed ({selectedDetails.failedData.length})</h3>
                              <div className="border rounded bg-red-50 dark:bg-red-900/20 w-full overflow-x-auto">
                                <table className="text-sm border-collapse">
                                  <thead className="bg-red-100 dark:bg-red-900/40">
                                    <tr>
                                      {Object.keys(selectedDetails.failedData[0] || {}).map(key => (
                                        <th key={key} className="px-3 py-2 text-left border-b border-red-200 dark:border-red-800 whitespace-nowrap">{key}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedDetails.failedData.map((row: any, idx: number) => (
                                      <tr key={idx} className="border-b border-red-200 dark:border-red-800 hover:bg-red-100/50 dark:hover:bg-red-900/30">
                                        {Object.keys(selectedDetails.failedData[0] || {}).map(key => (
                                          <td key={key} className="px-3 py-2 whitespace-nowrap">{String(row[key] ?? '')}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                    </DialogContent>
                  )}
                </Dialog>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => downloadDetailedReport(report.id)}
                  className="text-primary hover:text-primary/80"
                  title="Download Report"
                  data-testid="button-download-bulk-report"
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
