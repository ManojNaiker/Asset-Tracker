import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { useState } from "react";
import { AuditLog, User } from "@shared/schema";
import { Search, Filter, Loader2, User as UserIcon, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

export default function AuditTrailPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  
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
    return matchesSearch && matchesAction;
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}
