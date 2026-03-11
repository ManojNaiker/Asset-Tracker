import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useState } from "react";
import { Allocation, Asset, Employee } from "@shared/schema";
import { Search, Loader2, Download, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { BulkUploadReport } from "@/components/bulk-upload-report";

type AllocationWithDetails = Allocation & { asset: Asset, employee: Employee };

interface InventoryReport {
  type: string;
  count: number;
  available: number;
  allocated: number;
  damaged: number;
  lost: number;
  scrapped: number;
}

interface EmployeeAssetReport {
  emp_id: string;
  employee_name: string;
  department: string;
  designation: string;
  total_assets: number;
  active_assets: number;
  returned_assets: number;
}

interface DepartmentAssetReport {
  department: string;
  total_assets: number;
  available: number;
  allocated: number;
  damaged: number;
  employee_count: number;
}

interface AssetStatusReport {
  serial_number: string;
  asset_type: string;
  status: string;
  employee_name: string;
  employee_id: string;
  department: string;
  allocated_date: string;
  return_date: string;
}

interface AssetReturnReport {
  serial_number: string;
  asset_type: string;
  employee_name: string;
  emp_id: string;
  department: string;
  allocated_date: string;
  return_date: string;
  final_status: string;
  return_reason: string;
}

interface VerificationReport {
  serial_number: string;
  asset_type: string;
  employee_name: string;
  employee_id: string;
  verification_status: string;
  allocated_date: string;
  verified_date: string;
  verified_by: string;
}

const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: pageSettings } = useQuery({
    queryKey: ["/api/settings/page"]
  });

  const { data: allocations, isLoading: allocLoading } = useQuery<AllocationWithDetails[]>({ 
    queryKey: ["/api/allocations"] 
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery<InventoryReport[]>({ 
    queryKey: ["/api/reports/asset-inventory"] 
  });

  const { data: employeeData, isLoading: employeeLoading } = useQuery<EmployeeAssetReport[]>({ 
    queryKey: ["/api/reports/employee-assets"] 
  });

  const { data: departmentData, isLoading: departmentLoading } = useQuery<DepartmentAssetReport[]>({ 
    queryKey: ["/api/reports/department-assets"] 
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<AssetStatusReport[]>({ 
    queryKey: ["/api/reports/asset-status"] 
  });

  const { data: returnData, isLoading: returnLoading } = useQuery<AssetReturnReport[]>({ 
    queryKey: ["/api/reports/asset-returns"] 
  });

  const { data: verificationData, isLoading: verificationLoading } = useQuery<VerificationReport[]>({ 
    queryKey: ["/api/reports/verification-status"] 
  });

  const filteredAllocations = allocations?.filter(alloc => {
    const searchLower = search.toLowerCase();
    const matchesSearch = (
      alloc.asset.serialNumber.toLowerCase().includes(searchLower) ||
      alloc.employee.name.toLowerCase().includes(searchLower) ||
      alloc.employee.empId.toLowerCase().includes(searchLower) ||
      (alloc.employee.department && alloc.employee.department.toLowerCase().includes(searchLower))
    );
    const matchesStatus = filterStatus === "all" || alloc.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.allocatedAt || 0).getTime() - new Date(a.allocatedAt || 0).getTime();
    } else if (sortBy === "employee") {
      return a.employee.name.localeCompare(b.employee.name);
    } else if (sortBy === "serial") {
      return a.asset.serialNumber.localeCompare(b.asset.serialNumber);
    }
    return 0;
  });

  if (allocLoading || inventoryLoading || employeeLoading || departmentLoading || statusLoading || returnLoading || verificationLoading) {
    return <LayoutShell><Loader2 className="w-8 h-8 animate-spin mx-auto mt-20 text-primary" /></LayoutShell>;
  }

  return (
    <LayoutShell>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Reports & Analytics</h1>
        <p className="text-muted-foreground">View detailed reports on asset allocation, inventory, and verification status.</p>
      </div>

      <Tabs defaultValue="allocation" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-8 gap-2 bg-transparent mb-6 p-0 h-auto border-b border-red-200 pb-0"  data-testid="reports-tabs">
          <TabsTrigger value="allocation" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-allocations">Allocations</TabsTrigger>
          <TabsTrigger value="inventory" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="employees" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-employees">Employees</TabsTrigger>
          <TabsTrigger value="departments" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="status" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-status">Asset Status</TabsTrigger>
          <TabsTrigger value="returns" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-returns">Returns</TabsTrigger>
          <TabsTrigger value="verification" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-verification">Verification</TabsTrigger>
          <TabsTrigger value="bulk-uploads" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent rounded-none pb-3 pt-2 px-1 text-sm font-medium hover:text-foreground data-[state=active]:text-red-600" data-testid="tab-bulk-uploads">Bulk Uploads</TabsTrigger>
        </TabsList>

        {/* Allocations Report */}
        <TabsContent value="allocation">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Asset Allocation Report</h2>
              <p className="text-sm text-muted-foreground">Track asset allocation across employees and departments.</p>
            </div>
            <Button onClick={() => exportToExcel(filteredAllocations || [], "Asset_Allocation_Report", "Allocations")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <Card className="mb-6 shadow-sm border-border">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by Serial Number, Employee Name, ID or Department..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/20 border-border"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Sort By</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Latest First</SelectItem>
                        <SelectItem value="employee">Employee Name</SelectItem>
                        <SelectItem value="serial">Serial Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">Filter by Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Returned">Returned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                  <TableHead className="text-foreground">Allocated Date</TableHead>
                  <TableHead className="text-foreground">Return Date</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations?.map((alloc) => (
                  <TableRow key={alloc.id} className="hover:bg-muted/30">
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
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Inventory Report */}
        <TabsContent value="inventory">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Asset Inventory Report</h2>
              <p className="text-sm text-muted-foreground">Summary of assets by type and status.</p>
            </div>
            <Button onClick={() => exportToExcel(inventoryData || [], "Asset_Inventory_Report", "Inventory")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Asset Type</TableHead>
                  <TableHead className="text-foreground text-right">Total</TableHead>
                  <TableHead className="text-foreground text-right">Available</TableHead>
                  <TableHead className="text-foreground text-right">Allocated</TableHead>
                  <TableHead className="text-foreground text-right">Damaged</TableHead>
                  <TableHead className="text-foreground text-right">Lost</TableHead>
                  <TableHead className="text-foreground text-right">Scrapped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryData?.map((row) => (
                  <TableRow key={row.type} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">{row.type}</TableCell>
                    <TableCell className="text-right text-foreground">{row.count}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{row.available}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{row.allocated}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{row.damaged}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{row.lost}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{row.scrapped}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Employee Assets Report */}
        <TabsContent value="employees">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Employee Asset Report</h2>
              <p className="text-sm text-muted-foreground">Assets allocated to each employee.</p>
            </div>
            <Button onClick={() => exportToExcel(employeeData || [], "Employee_Asset_Report", "Employees")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Employee ID</TableHead>
                  <TableHead className="text-foreground">Name</TableHead>
                  <TableHead className="text-foreground">Department</TableHead>
                  <TableHead className="text-foreground">Designation</TableHead>
                  <TableHead className="text-foreground text-right">Total Assets</TableHead>
                  <TableHead className="text-foreground text-right">Active</TableHead>
                  <TableHead className="text-foreground text-right">Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeData?.map((row) => (
                  <TableRow key={row.emp_id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-foreground">{row.emp_id}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.department}</TableCell>
                    <TableCell className="text-muted-foreground">{row.designation}</TableCell>
                    <TableCell className="text-right font-medium">{row.total_assets}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-blue-50 text-blue-700">{row.active_assets}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-gray-50 text-gray-700">{row.returned_assets}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Department Assets Report */}
        <TabsContent value="departments">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Department Asset Report</h2>
              <p className="text-sm text-muted-foreground">Asset distribution across departments.</p>
            </div>
            <Button onClick={() => exportToExcel(departmentData || [], "Department_Asset_Report", "Departments")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Department</TableHead>
                  <TableHead className="text-foreground text-right">Total Assets</TableHead>
                  <TableHead className="text-foreground text-right">Available</TableHead>
                  <TableHead className="text-foreground text-right">Allocated</TableHead>
                  <TableHead className="text-foreground text-right">Damaged</TableHead>
                  <TableHead className="text-foreground text-right">Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentData?.map((row) => (
                  <TableRow key={row.department} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">{row.department}</TableCell>
                    <TableCell className="text-right font-medium">{row.total_assets}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-green-50 text-green-700">{row.available}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-blue-50 text-blue-700">{row.allocated}</Badge></TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className="bg-orange-50 text-orange-700">{row.damaged}</Badge></TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.employee_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Asset Status Report */}
        <TabsContent value="status">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Asset Status Report</h2>
              <p className="text-sm text-muted-foreground">Current status and location of all assets.</p>
            </div>
            <Button onClick={() => exportToExcel(statusData || [], "Asset_Status_Report", "Status")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Serial Number</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Current Location</TableHead>
                  <TableHead className="text-foreground">Department</TableHead>
                  <TableHead className="text-foreground">Allocated Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusData?.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-foreground">{row.serial_number}</TableCell>
                    <TableCell className="text-muted-foreground">{row.asset_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        row.status === 'Available' ? 'bg-green-50 text-green-700' :
                        row.status === 'Allocated' ? 'bg-blue-50 text-blue-700' :
                        row.status === 'Damaged' ? 'bg-orange-50 text-orange-700' :
                        'bg-red-50 text-red-700'
                      }>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">{row.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.department}</TableCell>
                    <TableCell className="text-muted-foreground">{row.allocated_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Asset Returns Report */}
        <TabsContent value="returns">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Asset Returns & Disposal Report</h2>
              <p className="text-sm text-muted-foreground">Track returned, damaged, lost, and scrapped assets.</p>
            </div>
            <Button onClick={() => exportToExcel(returnData || [], "Asset_Returns_Report", "Returns")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Serial Number</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Employee</TableHead>
                  <TableHead className="text-foreground">Department</TableHead>
                  <TableHead className="text-foreground">Allocated Date</TableHead>
                  <TableHead className="text-foreground">Return Date</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnData?.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-foreground">{row.serial_number}</TableCell>
                    <TableCell className="text-muted-foreground">{row.asset_type}</TableCell>
                    <TableCell className="text-foreground">{row.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.department}</TableCell>
                    <TableCell className="text-muted-foreground">{row.allocated_date}</TableCell>
                    <TableCell className="text-muted-foreground">{row.return_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        row.final_status === 'Returned' ? 'bg-green-50 text-green-700' :
                        row.final_status === 'Damaged' ? 'bg-orange-50 text-orange-700' :
                        'bg-red-50 text-red-700'
                      }>
                        {row.final_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.return_reason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Verification Status Report */}
        <TabsContent value="verification">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Asset Verification Report</h2>
              <p className="text-sm text-muted-foreground">Verification status of all allocated assets.</p>
            </div>
            <Button onClick={() => exportToExcel(verificationData || [], "Asset_Verification_Report", "Verification")} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-foreground">Serial Number</TableHead>
                  <TableHead className="text-foreground">Type</TableHead>
                  <TableHead className="text-foreground">Employee</TableHead>
                  <TableHead className="text-foreground">Status</TableHead>
                  <TableHead className="text-foreground">Verified Date</TableHead>
                  <TableHead className="text-foreground">Verified By</TableHead>
                  <TableHead className="text-foreground">Allocated Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verificationData?.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-foreground">{row.serial_number}</TableCell>
                    <TableCell className="text-muted-foreground">{row.asset_type}</TableCell>
                    <TableCell className="text-foreground">{row.employee_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        row.verification_status === 'Approved' ? 'bg-green-50 text-green-700' :
                        row.verification_status === 'Rejected' ? 'bg-red-50 text-red-700' :
                        row.verification_status === 'Revoked' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-50 text-yellow-700'
                      }>
                        {row.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.verified_date || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.verified_by}</TableCell>
                    <TableCell className="text-muted-foreground">{row.allocated_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Bulk Upload Report */}
        <TabsContent value="bulk-uploads">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bulk Upload History</h2>
            <p className="text-muted-foreground">Track all bulk uploads with detailed batch status and results.</p>
          </div>
          <BulkUploadReport />
        </TabsContent>
      </Tabs>
    </LayoutShell>
  );
}
