import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { AuditLog, User } from "@shared/schema";
import { Search, Filter, Loader2, User as UserIcon, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditTrailPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  
  const { data: logs, isLoading } = useQuery<AuditLog[]>({ 
    queryKey: ["/api/audit-logs"] 
  });

  const { data: users } = useQuery<User[]>({ 
    queryKey: ["/api/users"] 
  });

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || 
                         log.entityType?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action.includes(actionFilter);
    return matchesSearch && matchesAction;
  });

  if (isLoading) return <LayoutShell><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" /></LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Audit Trail</h1>
        <p className="text-muted-foreground mt-1">Monitor system activities and user actions.</p>
      </div>

      <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search actions or entities..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950"
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
                    <SelectItem value="Create">Create</SelectItem>
                    <SelectItem value="Update">Update</SelectItem>
                    <SelectItem value="Delete">Delete</SelectItem>
                    <SelectItem value="Allocate">Allocate</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="dark:text-slate-200">Timestamp</TableHead>
              <TableHead className="dark:text-slate-200">User</TableHead>
              <TableHead className="dark:text-slate-200">Action</TableHead>
              <TableHead className="dark:text-slate-200">Entity</TableHead>
              <TableHead className="dark:text-slate-200">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.map((log) => {
              const user = users?.find(u => u.id === log.userId);
              return (
                <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {new Date(log.timestamp!).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        </div>
                        <span className="text-sm font-medium dark:text-slate-200">{user?.username || 'System'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold dark:text-slate-200">{log.action}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium dark:text-slate-200">{log.entityType}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">ID: {log.entityId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <pre className="text-[10px] bg-slate-50 dark:bg-slate-950 p-1 rounded overflow-hidden truncate dark:text-slate-400">
                        {JSON.stringify(log.details)}
                    </pre>
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
