import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Loader2, Edit2, Trash2, Lock, Unlock, Mail, UserCog, Building2, Briefcase, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, userRoles } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { BulkUserUploadDialog, BulkDepartmentUploadDialog, BulkDesignationUploadDialog } from "@/components/bulk-upload-dialogs";

export default function UsersPage({ hideLayout = false }: { hideLayout?: boolean }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [location] = useLocation();
    const { data: users, isLoading: usersLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
    const { data: departments, isLoading: deptsLoading } = useQuery<any[]>({ queryKey: ["/api/departments"] });
    const { data: designations, isLoading: desigsLoading } = useQuery<any[]>({ queryKey: ["/api/designations"] });

    const isLoading = usersLoading || deptsLoading || desigsLoading;
    const [editingUser, setEditingUser] = useState<any>(null);
    const [activeSubTab, setActiveSubTab] = useState<string>("users");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
    const [isDesigDialogOpen, setIsDesigDialogOpen] = useState(false);

    const activeTab = location === "/users" ? "users" : "email";

    const createMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create user");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "Success", description: "User created successfully" });
            form.reset();
            setIsCreateDialogOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, values }: { id: number, values: any }) => {
            const res = await fetch(`/api/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update user");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "Success", description: "User updated successfully" });
            setEditingUser(null);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to delete user");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "Success", description: "User deleted successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const createDeptMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
            toast({ title: "Success", description: "Department created" });
            setIsDeptDialogOpen(false);
        }
    });

    const deleteDeptMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/departments/${id}`, { method: "DELETE" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
            toast({ title: "Success", description: "Department deleted" });
        }
    });

    const createDesigMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await fetch("/api/designations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
            toast({ title: "Success", description: "Designation created" });
            setIsDesigDialogOpen(false);
        }
    });

    const deleteDesigMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/designations/${id}`, { method: "DELETE" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
            toast({ title: "Success", description: "Designation deleted" });
        }
    });

    const form = useForm({
        resolver: zodResolver(insertUserSchema),
        defaultValues: {
            username: "",
            password: "",
            role: "employee",
            fullName: "",
            employeeCode: "",
            designation: "",
            department: "",
            mustChangePassword: false
        }
    });

    const editForm = useForm({
        defaultValues: {
            username: "",
            role: "employee",
            password: "",
            fullName: "",
            employeeCode: "",
            designation: "",
            department: ""
        }
    });

    if (isLoading) {
        const loadingContent = <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
        return hideLayout ? loadingContent : <LayoutShell>{loadingContent}</LayoutShell>;
    }

    const content = (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">System Settings</h1>
                <p className="text-muted-foreground mt-1">Configure system parameters and user access.</p>
            </div>

            <Tabs value={activeTab} className="mb-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                    <Link href="/users">
                        <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                            <UserCog className="w-4 h-4 mr-2" /> User Management
                        </TabsTrigger>
                    </Link>
                    <Link href="/settings">
                        <TabsTrigger value="email" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                            <Mail className="w-4 h-4 mr-2" /> Email Settings
                        </TabsTrigger>
                    </Link>
                </TabsList>
            </Tabs>

            {activeTab === "users" && (
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="mb-6">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                        <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                            Users
                        </TabsTrigger>
                        <TabsTrigger value="departments" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                            Departments
                        </TabsTrigger>
                        <TabsTrigger value="designations" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                            Designations
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            {activeSubTab === "users" && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">User Management</h2>
                            <p className="text-muted-foreground mt-1">Manage system access and roles.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkUserUploadDialog />
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <UserPlus className="w-4 h-4 mr-2" /> Add User
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create New User</DialogTitle>
                                    </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="fullName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Full Name</FormLabel>
                                                        <FormControl><Input {...field} placeholder="John Doe" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email ID</FormLabel>
                                                        <FormControl><Input {...field} placeholder="email@lightmf.com" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="employeeCode"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Employee Code</FormLabel>
                                                        <FormControl><Input {...field} placeholder="EMP001" /></FormControl>
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
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {designations?.map(d => (
                                                                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="department"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Department</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {departments?.map(d => (
                                                                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="role"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Role</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {userRoles.map(role => (
                                                                    <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <FormControl><Input {...field} type="password" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                                        {createMutation.isPending ? "Creating..." : "Create User"}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                                    <TableHead className="dark:text-slate-200">Username</TableHead>
                                    <TableHead className="dark:text-slate-200">Role</TableHead>
                                    <TableHead className="dark:text-slate-200">Status</TableHead>
                                    <TableHead className="dark:text-slate-200">Created At</TableHead>
                                    <TableHead className="text-right dark:text-slate-200">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map((u) => (
                                    <TableRow key={u.id} className="dark:hover:bg-slate-800/30">
                                        <TableCell className="font-medium dark:text-slate-200">{u.username}</TableCell>
                                        <TableCell className="capitalize dark:text-slate-400">{u.role}</TableCell>
                                        <TableCell>
                                            <span className={u.isLocked ? "text-red-600 dark:text-red-400 font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                                                {u.isLocked ? "Locked" : "Active"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-500 dark:text-slate-400">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => {
                                                        updateMutation.mutate({ 
                                                            id: u.id, 
                                                            values: { isLocked: !u.isLocked } 
                                                        });
                                                    }}
                                                    title={u.isLocked ? "Unlock User" : "Lock User"}
                                                >
                                                    {u.isLocked ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-amber-600" />}
                                                </Button>
                                                
                                                <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                                                    <DialogTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => {
                                                                setEditingUser(u);
                                                                editForm.reset({ 
                                                                    username: u.username, 
                                                                    role: u.role, 
                                                                    password: "",
                                                                    fullName: u.fullName || "",
                                                                    employeeCode: u.employeeCode || "",
                                                                    designation: u.designation || "",
                                                                    department: u.department || ""
                                                                });
                                                            }}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl">
                                                        <DialogHeader>
                                                            <DialogTitle>Edit User: {u.username}</DialogTitle>
                                                        </DialogHeader>
                                                        <Form {...editForm}>
                                                            <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate({ id: u.id, values: v }))} className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="fullName"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Full Name</FormLabel>
                                                                                <FormControl><Input {...field} /></FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="username"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Email ID</FormLabel>
                                                                                <FormControl><Input {...field} /></FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="employeeCode"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Employee Code</FormLabel>
                                                                                <FormControl><Input {...field} /></FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="designation"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Designation</FormLabel>
                                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {designations?.map(d => (
                                                                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="department"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Department</FormLabel>
                                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {departments?.map(d => (
                                                                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="role"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Role</FormLabel>
                                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {userRoles.map(role => (
                                                                                            <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <FormField
                                                                    control={editForm.control}
                                                                    name="password"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>New Password (optional)</FormLabel>
                                                                            <FormControl><Input {...field} type="password" /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                                                                    {updateMutation.isPending ? "Updating..." : "Update User"}
                                                                </Button>
                                                            </form>
                                                        </Form>
                                                    </DialogContent>
                                                </Dialog>
                                                
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={u.role === 'admin'}>
                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete the user account for {u.username}.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)} className="bg-red-600 hover:bg-red-700">
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}

            {activeSubTab === "departments" && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Departments</h2>
                            <p className="text-muted-foreground mt-1">Manage company departments.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkDepartmentUploadDialog />
                            <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Building2 className="w-4 h-4 mr-2" /> Add Department
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
                                <form onSubmit={(e: any) => {
                                    e.preventDefault();
                                    createDeptMutation.mutate({ name: e.target.name.value });
                                    e.target.reset();
                                }} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Department Name</label>
                                        <Input name="name" required />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createDeptMutation.isPending}>
                                        {createDeptMutation.isPending ? "Creating..." : "Create"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {departments?.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{d.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteDeptMutation.mutate(d.id)} disabled={deleteDeptMutation.isPending}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {activeSubTab === "designations" && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Designations</h2>
                            <p className="text-muted-foreground mt-1">Manage company designations.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkDesignationUploadDialog />
                            <Dialog open={isDesigDialogOpen} onOpenChange={setIsDesigDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Briefcase className="w-4 h-4 mr-2" /> Add Designation
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Designation</DialogTitle></DialogHeader>
                                <form onSubmit={(e: any) => {
                                    e.preventDefault();
                                    createDesigMutation.mutate({ name: e.target.name.value });
                                    e.target.reset();
                                }} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Designation Name</label>
                                        <Input name="name" required />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createDesigMutation.isPending}>
                                        {createDesigMutation.isPending ? "Creating..." : "Create"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {designations?.map(d => (
                                    <TableRow key={d.id}>
                                        <TableCell>{d.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteDesigMutation.mutate(d.id)} disabled={deleteDesigMutation.isPending}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </>
    );

    return hideLayout ? content : <LayoutShell>{content}</LayoutShell>;
}
