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

  if (isLoading) return <LayoutShell><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20 text-primary" /></LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Asset Reports</h1>
          <p className="text-muted-foreground mt-1">Track asset movement and history across the organization.</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="flex items-center gap-2 border-border text-foreground hover:bg-muted">
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      <Card className="mb-6 shadow-sm border-border">
        <CardContent className="p-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by Serial Number, Employee Name, ID or Department..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/20 border-border focus:bg-background transition-colors"
                />
            </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <Table className="min-w-[800px] md:min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground">Asset SN</TableHead>
              <TableHead className="text-foreground">Employee</TableHead>
              <TableHead className="text-foreground">Department</TableHead>
              <TableHead className="text-foreground">Allocation Date</TableHead>
              <TableHead className="text-foreground">Return Date</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAllocations?.map((alloc) => (
              <TableRow key={alloc.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-sm text-foreground">{alloc.asset.serialNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{alloc.employee.name}</span>
                    <span className="text-xs text-muted-foreground">{alloc.employee.empId}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{alloc.employee.department}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(alloc.allocatedAt!).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {alloc.returnDate ? new Date(alloc.returnDate).toLocaleDateString() : <span className="opacity-50">-</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={alloc.status === 'Active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}>
                    {alloc.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filteredAllocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
