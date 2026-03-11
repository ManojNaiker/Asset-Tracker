import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { useState } from "react";
import { AuditLog, User } from "@shared/schema";
import { Search, Filter, Loader2, User as UserIcon, Download, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import * as XLSX from "xlsx";

export default function AuditTrailPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [bulkUploadFilter, setBulkUploadFilter] = useState<string>("all");
  const [selectedDetails, setSelectedDetails] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const { data: logs, isLoading } = useQuery<AuditLog[]>({ 
    queryKey: ["/api/audit/logs"] 
  });

  const { data: users } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || 
                         (log.entityType && log.entityType.toLowerCase().includes(search.toLowerCase()));
    const matchesAction = actionFilter === "all" || log.action.includes(actionFilter);
    
    // Filter by bulk upload type
    let matchesBulkUpload = true;
    if (bulkUploadFilter !== "all") {
      if (bulkUploadFilter === "bulk-all") {
        // Show all bulk operations
        matchesBulkUpload = log.action.includes("Bulk");
      } else if (bulkUploadFilter === "bulk-allocations") {
        // Show only bulk allocations
        matchesBulkUpload = log.action.includes("Bulk Import Allocations");
      } else if (bulkUploadFilter === "bulk-users") {
        // Show only bulk users (creation and updates)
        matchesBulkUpload = log.action.includes("Bulk") && (log.action.includes("Users") || log.action.includes("User"));
      }
    }
    
    return matchesSearch && matchesAction && matchesBulkUpload;
  });

  const exportToExcel = () => {
    if (!filteredLogs) return;
    
    const exportData = filteredLogs.map(log => {
      const user = users?.find(u => u.id === log.userId);
      return {
        Timestamp: new Date(log.timestamp!).toLocaleString(),
        User: user?.username || 'System',
        Action: log.action,
        Entity: log.entityType,
        EntityID: log.entityId,
        Details: JSON.stringify(log.details)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
    XLSX.writeFile(workbook, `Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) return <LayoutShell><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" /></LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Audit Trail</h1>
          <p className="text-muted-foreground mt-1">Monitor system activities and user actions.</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2" data-testid="button-export-audit">
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search actions or entities..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/20 border-border focus:bg-background"
                />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <SelectValue placeholder="Action Type" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="Login">Login</SelectItem>
                    <SelectItem value="Logout">Logout</SelectItem>
                    <SelectItem value="Create">Create</SelectItem>
                    <SelectItem value="Update">Update</SelectItem>
                    <SelectItem value="Delete">Delete</SelectItem>
                    <SelectItem value="Allocate">Allocate</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                </SelectContent>
            </Select>
            
            <Select value={bulkUploadFilter} onValueChange={setBulkUploadFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <SelectValue placeholder="Bulk Upload History" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All History</SelectItem>
                    <SelectItem value="bulk-all">All Bulk Uploads</SelectItem>
                    <SelectItem value="bulk-allocations">Bulk Allocations</SelectItem>
                    <SelectItem value="bulk-users">Bulk User Creation</SelectItem>
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <Table className="min-w-[1000px] md:min-w-full">
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-foreground">Timestamp</TableHead>
              <TableHead className="text-foreground">User</TableHead>
              <TableHead className="text-foreground">Action</TableHead>
              <TableHead className="text-foreground">Entity</TableHead>
              <TableHead className="text-foreground">Details</TableHead>
              <TableHead className="text-center text-foreground w-12">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.map((log) => {
              const user = users?.find(u => u.id === log.userId);
              
              // Helper to render details clearly
              const renderDetails = () => {
                if (!log.details) return <span className="text-muted-foreground italic">No extra details</span>;
                
                const d = log.details as any;
                
                if (log.action === "Login") {
                  return `User logged in from ${d?.ip || 'unknown IP'}`;
                }
                if (log.action === "Logout") {
                  return `User logged out`;
                }
                if (log.action === "Change Password") {
                  return `User changed their password`;
                }
                if (log.action === "Allocate Asset") {
                  return `Allocated ${d.assetType} (${d.assetSerial}) to ${d.employeeName} (${d.employeeCode})`;
                }
                if (log.action === "Return Asset") {
                  return `Returned ${d.assetSerial} from ${d.employeeName}. Reason: ${d.reason || 'None'}`;
                }
                if (log.action === "Delete User") {
                  return `Deleted user: ${d.deletedUsername} (Role: ${d.deletedRole})`;
                }
                if (log.action === "Create User") {
                  return `Created user: ${d.username} (Role: ${d.role})`;
                }
                if (log.action === "Update User") {
                  return `Updated fields: ${Object.keys(d).join(', ')}`;
                }
                if (log.action === "Update Employee") {
                  const changes = Object.keys(d || {});
                  return `Updated ${changes.length} field${changes.length !== 1 ? 's' : ''}: ${changes.join(', ')}`;
                }
                if (log.action === "Bulk Import Allocations") {
                  return `Bulk imported allocations - ${d.count || '?'} records`;
                }
                if (log.action === "Bulk Import Users") {
                  const created = d.createdCount || d.created || 0;
                  const updated = d.existingCount || d.existing || 0;
                  const failed = d.failedCount || d.failed || 0;
                  return `${created} users created, ${updated} updated, ${failed} failed`;
                }
                
                return JSON.stringify(d);
              };

              return (
                <TableRow key={log.id} className="hover:bg-muted/50">
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(log.timestamp!).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{user?.username || 'System'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold text-foreground">{log.action}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{log.entityType}</span>
                        <span className="text-xs text-muted-foreground">ID: {log.entityId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-xs text-muted-foreground leading-relaxed py-1">
                        {renderDetails()}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Dialog open={detailsOpen && selectedDetails?.id === log.id} onOpenChange={setDetailsOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedDetails(log)}
                          className="text-primary hover:text-primary/80"
                          title="View Full Details"
                          data-testid="button-view-audit-details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      {selectedDetails && (
                        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle>What Happened - Action Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 p-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase">When</span>
                                <p className="text-sm font-medium">{new Date(selectedDetails.timestamp!).toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Who</span>
                                <p className="text-sm font-medium">{user?.username || 'System'}</p>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Action</span>
                                <p className="text-sm font-semibold text-primary">{selectedDetails.action}</p>
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Type</span>
                                <p className="text-sm font-medium">{selectedDetails.entityType}</p>
                              </div>
                            </div>
                            
                            {selectedDetails.details && (
                              <div className="space-y-3">
                                <span className="text-sm font-semibold text-foreground">Details</span>
                                <div className="space-y-2">
                                  {(() => {
                                    const d = selectedDetails.details as any;
                                    
                                    // Bulk Import
                                    if (selectedDetails.action === "Bulk Import Allocations" || selectedDetails.action?.includes("Bulk")) {
                                      return (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-3 gap-2 pb-3 border-b border-border">
                                            <div className="text-center"><span className="text-xs font-semibold text-green-600">Created</span> <p className="text-2xl font-bold text-green-600">{d.createdCount || d.created || 0}</p></div>
                                            <div className="text-center"><span className="text-xs font-semibold text-red-600">Failed</span> <p className="text-2xl font-bold text-red-600">{d.failedCount || d.failed || 0}</p></div>
                                            <div className="text-center"><span className="text-xs font-semibold text-blue-600">Total</span> <p className="text-2xl font-bold text-blue-600">{d.totalCount || d.total || d.count || 0}</p></div>
                                          </div>
                                          
                                          {d.createdData && d.createdData.length > 0 && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-green-600 mb-3 uppercase flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                                Successfully Created ({d.createdData.length})
                                              </h4>
                                              <div className="max-h-80 overflow-x-auto border rounded-lg bg-green-50/30 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                                                <table className="w-full text-xs">
                                                  <thead className="bg-green-100/40 dark:bg-green-900/30 sticky top-0">
                                                    <tr>
                                                      {Object.keys(d.createdData[0] || {}).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left font-semibold text-foreground border-r border-green-200 dark:border-green-800 last:border-0">{key}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {d.createdData.map((row: any, idx: number) => (
                                                      <tr key={idx} className="border-t border-green-200 dark:border-green-800 hover:bg-green-100/20 dark:hover:bg-green-900/20">
                                                        {Object.values(row).map((val: any, i: number) => (
                                                          <td key={i} className="px-3 py-2 text-foreground border-r border-green-100 dark:border-green-900 last:border-0 truncate" title={String(val)}>{String(val)}</td>
                                                        ))}
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}
                                          
                                          {d.failedData && d.failedData.length > 0 && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-red-600 mb-3 uppercase flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                                                Failed Records ({d.failedData.length})
                                              </h4>
                                              <div className="max-h-80 overflow-x-auto border rounded-lg bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                                                <table className="w-full text-xs">
                                                  <thead className="bg-red-100/40 dark:bg-red-900/30 sticky top-0">
                                                    <tr>
                                                      {Object.keys(d.failedData[0] || {}).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left font-semibold text-foreground border-r border-red-200 dark:border-red-800 last:border-0">{key}</th>
                                                      ))}
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {d.failedData.map((row: any, idx: number) => (
                                                      <tr key={idx} className="border-t border-red-200 dark:border-red-800 hover:bg-red-100/20 dark:hover:bg-red-900/20">
                                                        {Object.values(row).map((val: any, i: number) => (
                                                          <td key={i} className="px-3 py-2 text-foreground border-r border-red-100 dark:border-red-900 last:border-0 truncate" title={String(val)}>{String(val)}</td>
                                                        ))}
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    // Update Employee
                                    if (selectedDetails.action === "Update Employee") {
                                      return (
                                        <div className="space-y-4">
                                          {Object.entries(d).map(([field, change]: [string, any], idx: number) => (
                                            <div key={idx} className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded">
                                              <div className="text-sm font-semibold text-foreground mb-2 capitalize">{field}</div>
                                              <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                  <div className="text-xs text-muted-foreground mb-1">Previous Value:</div>
                                                  <div className="text-sm font-mono bg-red-100/30 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                                                    {change.old === null || change.old === undefined ? '(empty)' : String(change.old)}
                                                  </div>
                                                </div>
                                                <div>
                                                  <div className="text-xs text-muted-foreground mb-1">New Value:</div>
                                                  <div className="text-sm font-mono bg-green-100/30 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                                                    {change.new === null || change.new === undefined ? '(empty)' : String(change.new)}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    }
                                    
                                    // Bulk Import Users
                                    if (selectedDetails.action === "Bulk Import Users") {
                                      return (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-3 gap-2 pb-3 border-b border-border">
                                            <div className="text-center"><span className="text-xs font-semibold text-green-600">Created</span> <p className="text-2xl font-bold text-green-600">{d.createdCount || d.created || 0}</p></div>
                                            <div className="text-center"><span className="text-xs font-semibold text-blue-600">Updated</span> <p className="text-2xl font-bold text-blue-600">{d.existingCount || d.existing || 0}</p></div>
                                            <div className="text-center"><span className="text-xs font-semibold text-red-600">Failed</span> <p className="text-2xl font-bold text-red-600">{d.failedCount || d.failed || 0}</p></div>
                                          </div>
                                          
                                          {d.createdData && d.createdData.length > 0 && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-green-600 mb-3 uppercase flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                                NAI USERS BANAI GAYI ({d.createdData.length})
                                              </h4>
                                              <div className="space-y-2">
                                                {d.createdData.map((user: any, idx: number) => (
                                                  <div key={idx} className="p-3 bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded">
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                      <div><span className="text-muted-foreground">Username:</span> <span className="font-semibold">{user.username}</span></div>
                                                      <div><span className="text-muted-foreground">Full Name:</span> <span className="font-semibold">{user.fullName}</span></div>
                                                      <div><span className="text-muted-foreground">Employee Code:</span> <span className="font-mono text-xs">{user.employeeCode}</span></div>
                                                      <div><span className="text-muted-foreground">Role:</span> <span className="font-semibold">{user.role}</span></div>
                                                      <div><span className="text-muted-foreground">Department:</span> <span className="font-semibold">{user.department}</span></div>
                                                      <div><span className="text-muted-foreground">Designation:</span> <span className="font-semibold">{user.designation}</span></div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {d.existingData && d.existingData.length > 0 && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-blue-600 mb-3 uppercase flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                                USERS UPDATE KIYE GAYE ({d.existingData.length})
                                              </h4>
                                              <div className="space-y-3">
                                                {d.existingData.map((user: any, idx: number) => (
                                                  <div key={idx} className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded">
                                                    <div className="mb-3 pb-3 border-b border-blue-200 dark:border-blue-800">
                                                      <div className="text-sm font-semibold text-foreground">{user.username}</div>
                                                      <div className="text-xs text-muted-foreground">{user.fullName}</div>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                      {user.previousData && user.updatedData && (
                                                        <>
                                                          {/* Show Full Name change */}
                                                          {user.previousData.fullName !== user.updatedData.fullName && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-muted-foreground text-xs font-semibold min-w-28">Full Name:</span>
                                                              <span className="text-xs text-muted-foreground">{user.previousData.fullName || 'N/A'}</span>
                                                              <span className="text-blue-600 font-semibold text-xs">→</span>
                                                              <span className="text-xs font-semibold text-blue-600">{user.updatedData.fullName || 'N/A'}</span>
                                                            </div>
                                                          )}
                                                          
                                                          {/* Show Department change */}
                                                          {user.previousData.department !== user.updatedData.department && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-muted-foreground text-xs font-semibold min-w-28">Department:</span>
                                                              <span className="text-xs text-muted-foreground">{user.previousData.department || 'N/A'}</span>
                                                              <span className="text-blue-600 font-semibold text-xs">→</span>
                                                              <span className="text-xs font-semibold text-blue-600">{user.updatedData.department || 'N/A'}</span>
                                                            </div>
                                                          )}
                                                          
                                                          {/* Show Designation change */}
                                                          {user.previousData.designation !== user.updatedData.designation && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-muted-foreground text-xs font-semibold min-w-28">Designation:</span>
                                                              <span className="text-xs text-muted-foreground">{user.previousData.designation || 'N/A'}</span>
                                                              <span className="text-blue-600 font-semibold text-xs">→</span>
                                                              <span className="text-xs font-semibold text-blue-600">{user.updatedData.designation || 'N/A'}</span>
                                                            </div>
                                                          )}
                                                          
                                                          {/* Show Employee Code change */}
                                                          {user.previousData.employeeCode !== user.updatedData.employeeCode && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-muted-foreground text-xs font-semibold min-w-28">Employee Code:</span>
                                                              <span className="text-xs text-muted-foreground">{user.previousData.employeeCode || 'N/A'}</span>
                                                              <span className="text-blue-600 font-semibold text-xs">→</span>
                                                              <span className="text-xs font-semibold text-blue-600">{user.updatedData.employeeCode || 'N/A'}</span>
                                                            </div>
                                                          )}
                                                          
                                                          {/* Show Role change */}
                                                          {user.previousData.role !== user.updatedData.role && (
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-muted-foreground text-xs font-semibold min-w-28">Role:</span>
                                                              <span className="text-xs text-muted-foreground">{user.previousData.role || 'N/A'}</span>
                                                              <span className="text-blue-600 font-semibold text-xs">→</span>
                                                              <span className="text-xs font-semibold text-blue-600">{user.updatedData.role || 'N/A'}</span>
                                                            </div>
                                                          )}
                                                          
                                                          {/* If no changes detected, show message */}
                                                          {user.previousData.fullName === user.updatedData.fullName &&
                                                            user.previousData.department === user.updatedData.department &&
                                                            user.previousData.designation === user.updatedData.designation &&
                                                            user.previousData.employeeCode === user.updatedData.employeeCode &&
                                                            user.previousData.role === user.updatedData.role && (
                                                              <div className="text-xs text-muted-foreground italic">No changes detected</div>
                                                            )}
                                                        </>
                                                      )}
                                                      
                                                      {/* Fallback if raw data doesn't have comparison */}
                                                      {!user.previousData && (
                                                        <>
                                                          <div><span className="text-muted-foreground text-xs">Full Name:</span> <span className="font-semibold text-xs">{user.fullName}</span></div>
                                                          <div><span className="text-muted-foreground text-xs">Department:</span> <span className="font-semibold text-xs">{user.department}</span></div>
                                                          <div><span className="text-muted-foreground text-xs">Designation:</span> <span className="font-semibold text-xs">{user.designation}</span></div>
                                                        </>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {d.failedData && d.failedData.length > 0 && (
                                            <div>
                                              <h4 className="text-sm font-semibold text-red-600 mb-3 uppercase flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                                                FAILED RECORDS ({d.failedData.length})
                                              </h4>
                                              <div className="space-y-2">
                                                {d.failedData.map((item: any, idx: number) => (
                                                  <div key={idx} className="p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                                                    <div className="text-sm"><span className="text-muted-foreground">Error:</span> <span className="font-semibold text-red-600">{item.error || 'Unknown error'}</span></div>
                                                    {item.username && <div className="text-sm"><span className="text-muted-foreground">Username:</span> <span className="font-mono text-xs">{item.username}</span></div>}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    // Login
                                    if (selectedDetails.action === "Login") {
                                      return <div className="flex justify-between"><span className="text-muted-foreground">IP Address:</span> <span className="font-semibold">{d?.ip || 'Not recorded'}</span></div>;
                                    }
                                    
                                    // Asset Allocation
                                    if (selectedDetails.action === "Allocate Asset") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex justify-between"><span className="text-muted-foreground">Asset Type:</span> <span className="font-semibold">{d.assetType}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Asset Serial:</span> <span className="font-mono text-sm">{d.assetSerial}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Employee:</span> <span className="font-semibold">{d.employeeName}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Employee ID:</span> <span className="font-mono text-sm">{d.employeeCode}</span></div>
                                        </div>
                                      );
                                    }
                                    
                                    // Asset Return
                                    if (selectedDetails.action === "Return Asset") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex justify-between"><span className="text-muted-foreground">Asset:</span> <span className="font-mono text-sm">{d.assetSerial}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Returned From:</span> <span className="font-semibold">{d.employeeName}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Return Reason:</span> <span className="font-semibold">{d.reason || 'Not specified'}</span></div>
                                        </div>
                                      );
                                    }
                                    
                                    // User Management
                                    if (selectedDetails.action === "Create User") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex justify-between"><span className="text-muted-foreground">Username:</span> <span className="font-semibold">{d.username}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Role:</span> <span className="font-semibold text-blue-600">{d.role}</span></div>
                                        </div>
                                      );
                                    }
                                    
                                    if (selectedDetails.action === "Delete User") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex justify-between"><span className="text-muted-foreground">Username:</span> <span className="font-semibold text-red-600">{d.deletedUsername}</span></div>
                                          <div className="flex justify-between"><span className="text-muted-foreground">Role:</span> <span className="font-semibold">{d.deletedRole}</span></div>
                                        </div>
                                      );
                                    }
                                    
                                    if (selectedDetails.action === "Update User") {
                                      return (
                                        <div className="space-y-2">
                                          <div className="text-muted-foreground">Updated Fields:</div>
                                          <div className="flex flex-wrap gap-2">
                                            {Object.keys(d).map(key => (
                                              <div key={key} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                                                {key}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // Default: show all fields
                                    return Object.entries(d).map(([key, value]) => (
                                      <div key={key} className="flex justify-between border-t border-border pt-2">
                                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                        <span className="font-medium text-right max-w-xs">{String(value)}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}
