import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Allocation, Asset, Employee } from "@shared/schema";
import { Search, Loader2, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

type AllocationWithDetails = Allocation & { asset: Asset, employee: Employee };

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  
  const { data: allocations, isLoading } = useQuery<AllocationWithDetails[]>({ 
    queryKey: ["/api/allocations"] 
  });

  const filteredAllocations = allocations?.filter(alloc => {
    const searchLower = search.toLowerCase();
    return (
      alloc.asset.serialNumber.toLowerCase().includes(searchLower) ||
      alloc.employee.name.toLowerCase().includes(searchLower) ||
      alloc.employee.empId.toLowerCase().includes(searchLower) ||
      (alloc.employee.department && alloc.employee.department.toLowerCase().includes(searchLower))
    );
  });

  const exportToExcel = () => {
    if (!filteredAllocations) return;
    
    const exportData = filteredAllocations.map(alloc => ({
      "Asset Serial": alloc.asset.serialNumber,
      "Employee Name": alloc.employee.name,
      "Employee ID": alloc.employee.empId,
      "Department": alloc.employee.department || "N/A",
      "Allocated Date": new Date(alloc.allocatedAt!).toLocaleDateString(),
      "Return Date": alloc.returnDate ? new Date(alloc.returnDate).toLocaleDateString() : "N/A",
      "Status": alloc.status,
      "Return Reason": alloc.returnReason || "N/A"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Asset Report");
    XLSX.writeFile(workbook, `Asset_Allocation_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) return <LayoutShell><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" /></LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Asset Reports</h1>
          <p className="text-muted-foreground mt-1">Track asset movement and history across the organization.</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by Serial Number, Employee Name, ID or Department..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950"
                />
            </div>
        </CardContent>
      </Card>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="dark:text-slate-200">Asset SN</TableHead>
              <TableHead className="dark:text-slate-200">Employee</TableHead>
              <TableHead className="dark:text-slate-200">Department</TableHead>
              <TableHead className="dark:text-slate-200">Allocation Date</TableHead>
              <TableHead className="dark:text-slate-200">Return Date</TableHead>
              <TableHead className="dark:text-slate-200">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAllocations?.map((alloc) => (
              <TableRow key={alloc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <TableCell className="font-mono text-sm">{alloc.asset.serialNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{alloc.employee.name}</span>
                    <span className="text-xs text-slate-500">{alloc.employee.empId}</span>
                  </div>
                </TableCell>
                <TableCell>{alloc.employee.department}</TableCell>
                <TableCell>{new Date(alloc.allocatedAt!).toLocaleDateString()}</TableCell>
                <TableCell>
                  {alloc.returnDate ? new Date(alloc.returnDate).toLocaleDateString() : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={alloc.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100'}>
                    {alloc.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filteredAllocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                  No records found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}
