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
import { BulkEmployeeUploadDialog } from "@/components/bulk-upload-dialogs";

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const { data: employees, isLoading } = useEmployees({ search });

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Directory of all staff members.</p>
        </div>
        <div className="flex gap-2">
            <BulkEmployeeUploadDialog />
            <CreateEmployeeDialog />
        </div>
      </div>

      <Card className="mb-6 shadow-sm border-border">
        <CardContent className="p-4">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search name or ID..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/20 border-border focus:bg-background"
                />
            </div>
        </CardContent>
      </Card>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <Table className="min-w-[800px] md:min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground">Emp ID</TableHead>
              <TableHead className="text-foreground">Name</TableHead>
              <TableHead className="text-foreground">Department</TableHead>
              <TableHead className="text-foreground">Designation</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-right text-foreground">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                </TableRow>
            ) : employees?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No employees found.
                    </TableCell>
                </TableRow>
            ) : (
                employees?.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-muted-foreground">{emp.empId}</TableCell>
                        <TableCell className="font-medium text-foreground">{emp.name}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.department}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.designation}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className={emp.status === 'Active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}>
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

import { ImagePreview } from "@/components/image-preview";

function ViewAllocatedAssetsDialog({ employee }: { employee: Employee }) {
    const { data: allocations, isLoading } = useQuery<(any)[]>({
        queryKey: ["/api/allocations"],
    });

    const employeeAllocations = (allocations as any[])?.filter(a => a.employeeId === employee.id && a.status === 'Active');

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
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
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : !employeeAllocations || employeeAllocations.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground">No active allocations for this employee.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset SN</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Allocated At</TableHead>
                                    <TableHead>Photo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeeAllocations.map(a => (
                                    <TableRow key={a.id}>
                                        <TableCell className="font-mono">{a.asset.serialNumber}</TableCell>
                                        <TableCell>{a.asset.type?.name || 'N/A'}</TableCell>
                                        <TableCell>{new Date(a.allocatedAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {a.imageUrl && (
                                                <ImagePreview 
                                                    src={a.imageUrl} 
                                                    alt="Asset" 
                                                    className="w-20 h-20"
                                                />
                                            )}
                                        </TableCell>
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
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="branch"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Main Branch" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mobile"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile</FormLabel>
                                        <FormControl>
                                            <Input placeholder="9876543210" {...field} value={field.value || ''} />
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
                form.reset();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
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
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="branch"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Main Branch" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mobile"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile</FormLabel>
                                        <FormControl>
                                            <Input placeholder="9876543210" {...field} value={field.value || ''} />
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
