import { useState } from "react";
import { useEmployees, useCreateEmployee, useUpdateEmployee } from "@/hooks/use-employees";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, type InsertEmployee, type Employee, type Asset } from "@shared/schema";
import { Plus, Search, Loader2, Upload, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const { data: employees, isLoading } = useEmployees({ search });

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Employees</h1>
          <p className="text-muted-foreground mt-1">Directory of all staff members.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="border-slate-300">
                <Upload className="w-4 h-4 mr-2" /> Import
            </Button>
            <CreateEmployeeDialog />
        </div>
      </div>

      <Card className="mb-6 shadow-sm border-slate-200">
        <CardContent className="p-4">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search name or ID..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
                />
            </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Emp ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    </TableCell>
                </TableRow>
            ) : employees?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                        No employees found.
                    </TableCell>
                </TableRow>
            ) : (
                employees?.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-slate-600">{emp.empId}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>{emp.designation}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={emp.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600'}>
                                {emp.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <ViewAllocatedAssetsDialog employee={emp} />
                            <EditEmployeeDialog employee={emp} />
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}

function ViewAllocatedAssetsDialog({ employee }: { employee: Employee }) {
    const { data: allocations, isLoading } = useQuery<(any)[]>({
        queryKey: ["/api/allocations"],
    });

    const employeeAllocations = (allocations as any[])?.filter(a => a.employeeId === employee.id && a.status === 'Active');

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Eye className="w-4 h-4 mr-1" /> View Assets
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Assets Allocated to {employee.name}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    ) : !employeeAllocations || employeeAllocations.length === 0 ? (
                        <p className="text-center py-8 text-slate-500">No active allocations for this employee.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset SN</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Allocated At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeeAllocations.map(a => (
                                    <TableRow key={a.id}>
                                        <TableCell className="font-mono">{a.asset.serialNumber}</TableCell>
                                        <TableCell>{a.asset.type?.name}</TableCell>
                                        <TableCell>{new Date(a.allocatedAt).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EditEmployeeDialog({ employee }: { employee: Employee }) {
    const [open, setOpen] = useState(false);
    const mutation = useUpdateEmployee();
    const form = useForm<InsertEmployee>({
        resolver: zodResolver(insertEmployeeSchema),
        defaultValues: {
            empId: employee.empId,
            name: employee.name,
            email: employee.email,
            department: employee.department || "",
            designation: employee.designation || "",
            status: employee.status || "Active",
            mobile: employee.mobile || "",
            branch: employee.branch || "",
        }
    });

    const onSubmit = (data: InsertEmployee) => {
        mutation.mutate({ id: employee.id, ...data } as any, {
            onSuccess: () => {
                setOpen(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">Edit</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Employee</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="empId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employee ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="EMP001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="john@company.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department</FormLabel>
                                        <FormControl>
                                            <Input placeholder="IT" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="designation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Designation</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Manager" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending ? "Updating..." : "Update Employee"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function CreateEmployeeDialog() {
    const [open, setOpen] = useState(false);
    const mutation = useCreateEmployee();
    const form = useForm<InsertEmployee>({
        resolver: zodResolver(insertEmployeeSchema),
        defaultValues: {
            empId: "",
            name: "",
            email: "",
            department: "",
            designation: "",
            status: "Active",
            mobile: "",
            branch: "",
        }
    });

    const onSubmit = (data: InsertEmployee) => {
        mutation.mutate(data, {
            onSuccess: () => {
                setOpen(false);
                form.reset({
                    empId: "",
                    name: "",
                    email: "",
                    department: "",
                    designation: "",
                    status: "Active",
                    mobile: "",
                    branch: "",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Add Employee
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Employee</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="empId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employee ID</FormLabel>
                                        <FormControl>
                                            <Input placeholder="EMP001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="john@company.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="department"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department</FormLabel>
                                        <FormControl>
                                            <Input placeholder="IT" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="designation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Designation</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Manager" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending ? "Creating..." : "Create Employee"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
