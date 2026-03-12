import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Loader2, Edit2, Trash2, Lock, Unlock, Mail, UserCog, Building2, Briefcase, Upload, Settings2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, userRoles, fieldTypeOptions, type CustomField } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkUserUploadDialog, BulkDepartmentUploadDialog, BulkDesignationUploadDialog } from "@/components/bulk-upload-dialogs";

export default function UsersPage({ hideLayout = false }: { hideLayout?: boolean }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: users, isLoading: usersLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
    const { data: departments, isLoading: deptsLoading } = useQuery<any[]>({ queryKey: ["/api/departments"] });
    const { data: designations, isLoading: desigsLoading } = useQuery<any[]>({ queryKey: ["/api/designations"] });

    const isLoading = usersLoading || deptsLoading || desigsLoading;
    const [editingUser, setEditingUser] = useState<any>(null);
    const [activeSubTab, setActiveSubTab] = useState<string>("users");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
    const [isDesigDialogOpen, setIsDesigDialogOpen] = useState(false);

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
            role: "user",
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
            role: "user",
            password: "",
            fullName: "",
            employeeCode: "",
            designation: "",
            department: ""
        }
    });

    if (isLoading) {
        const loadingContent = <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
        return hideLayout ? loadingContent : <LayoutShell>{loadingContent}</LayoutShell>;
    }

    const content = (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-display font-bold text-foreground">System Settings</h1>
                <p className="text-muted-foreground mt-1">Configure system parameters and user access.</p>
            </div>

            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="mb-6">
                <TabsList className="bg-muted p-1">
                    <TabsTrigger value="users" className="data-[state=active]:bg-card">
                        Users
                    </TabsTrigger>
                    <TabsTrigger value="departments" className="data-[state=active]:bg-card">
                        Departments
                    </TabsTrigger>
                    <TabsTrigger value="designations" className="data-[state=active]:bg-card">
                        Designations
                    </TabsTrigger>
                    <TabsTrigger value="field-settings" className="data-[state=active]:bg-card">
                        Field Settings
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {activeSubTab === "users" && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-display font-bold text-foreground">User Management</h2>
                            <p className="text-muted-foreground mt-1">Manage system access and roles.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkUserUploadDialog />
                            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary hover:bg-primary/90">
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
                                                        <FormControl><Input {...field} placeholder="John Doe" className="bg-background" /></FormControl>
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
                                                        <FormControl><Input {...field} placeholder="email@lightmf.com" className="bg-background" /></FormControl>
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
                                                        <FormControl><Input {...field} placeholder="EMP001" className="bg-background" /></FormControl>
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
                                                            <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select designation" /></SelectTrigger></FormControl>
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
                                                            <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
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
                                                            <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
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
                                                    <FormControl><Input {...field} type="password"  className="bg-background"/></FormControl>
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

                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-foreground">Username</TableHead>
                                    <TableHead className="text-foreground">Role</TableHead>
                                    <TableHead className="text-foreground">Status</TableHead>
                                    <TableHead className="text-foreground">Created At</TableHead>
                                    <TableHead className="text-right text-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.map((u) => (
                                    <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium text-foreground">{u.username}</TableCell>
                                        <TableCell className="capitalize text-muted-foreground">{u.role}</TableCell>
                                        <TableCell>
                                            <span className={u.isLocked ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                                                {u.isLocked ? "Locked" : "Active"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
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
                                                            <Edit2 className="w-4 h-4 text-muted-foreground" />
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
                                                                                <FormControl><Input {...field} className="bg-background" /></FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="username"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Email ID</FormLabel>
                                                                                <FormControl><Input {...field} className="bg-background" /></FormControl>
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
                                                                                <FormControl><Input {...field} className="bg-background" /></FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="role"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Role</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {userRoles.map(role => (
                                                                                            <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
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
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {departments?.map(d => (
                                                                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={editForm.control}
                                                                        name="designation"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel>Designation</FormLabel>
                                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                                    <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                                                                                    <SelectContent>
                                                                                        {designations?.map(d => (
                                                                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <FormField
                                                                    control={editForm.control}
                                                                    name="password"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel>New Password (Optional)</FormLabel>
                                                                            <FormControl><Input {...field} type="password" placeholder="Leave blank to keep current" className="bg-background" /></FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                                                                    {updateMutation.isPending ? "Saving..." : "Update User"}
                                                                </Button>
                                                            </form>
                                                        </Form>
                                                    </DialogContent>
                                                </Dialog>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="w-4 h-4" />
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
                                                            <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                            <h2 className="text-2xl font-display font-bold text-foreground">Departments</h2>
                            <p className="text-muted-foreground mt-1">Manage organization structure.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkDepartmentUploadDialog />
                            <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary hover:bg-primary/90">
                                        <Plus className="w-4 h-4 mr-2" /> Add Department
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
                                    <form className="space-y-4" onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        createDeptMutation.mutate({ name: String(formData.get("name")) }, {
                                          onSuccess: () => setIsDeptDialogOpen(false)
                                        });
                                    }}>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Department Name</label>
                                            <Input name="name" required className="bg-background" placeholder="Enter department name" />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={createDeptMutation.isPending}>
                                          {createDeptMutation.isPending ? "Creating..." : "Create"}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-foreground">Name</TableHead>
                                    <TableHead className="text-right text-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departments?.map(d => (
                                    <TableRow key={d.id} className="hover:bg-muted/30">
                                        <TableCell className="text-foreground">{d.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteDeptMutation.mutate(d.id)} className="text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-4 h-4" />
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
                            <h2 className="text-2xl font-display font-bold text-foreground">Designations</h2>
                            <p className="text-muted-foreground mt-1">Manage staff roles.</p>
                        </div>
                        <div className="flex gap-2">
                            <BulkDesignationUploadDialog />
                            <Dialog open={isDesigDialogOpen} onOpenChange={setIsDesigDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary hover:bg-primary/90">
                                        <Plus className="w-4 h-4 mr-2" /> Add Designation
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>New Designation</DialogTitle></DialogHeader>
                                    <form className="space-y-4" onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        createDesigMutation.mutate({ name: String(formData.get("name")) }, {
                                          onSuccess: () => setIsDesigDialogOpen(false)
                                        });
                                    }}>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Designation Name</label>
                                            <Input name="name" required className="bg-background" placeholder="Enter designation name" />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={createDesigMutation.isPending}>
                                          {createDesigMutation.isPending ? "Creating..." : "Create"}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-foreground">Name</TableHead>
                                    <TableHead className="text-right text-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {designations?.map(d => (
                                    <TableRow key={d.id} className="hover:bg-muted/30">
                                        <TableCell className="text-foreground">{d.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteDesigMutation.mutate(d.id)} className="text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {activeSubTab === "field-settings" && (
                <FieldSettingsTab />
            )}
        </>
    );

    return hideLayout ? content : <LayoutShell>{content}</LayoutShell>;
}

function FieldSettingsTab() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [entityFilter, setEntityFilter] = useState<string>("all");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    const { data: customFields, isLoading } = useQuery<CustomField[]>({
        queryKey: ["/api/custom-fields"],
    });

    const { data: dropdownSources } = useQuery<{ value: string; label: string }[]>({
        queryKey: ["/api/custom-fields/dropdown-sources"],
    });

    const entityOptions = [
        { value: "department", label: "Department" },
        { value: "designation", label: "Designation" },
        { value: "employee", label: "Employee" },
        { value: "asset", label: "Asset" },
        { value: "allocation", label: "Allocation" },
    ];

    const filteredFields = entityFilter === "all"
        ? customFields
        : customFields?.filter(f => f.entity === entityFilter);

    const createMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await fetch("/api/custom-fields", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create field");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
            toast({ title: "Success", description: "Field created successfully" });
            setIsCreateOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, values }: { id: number; values: any }) => {
            const res = await fetch(`/api/custom-fields/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update field");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
            toast({ title: "Success", description: "Field updated successfully" });
            setEditingField(null);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete field");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
            toast({ title: "Success", description: "Field deleted" });
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
            const res = await fetch(`/api/custom-fields/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error("Failed to update field");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
        },
    });

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground" data-testid="text-field-settings-title">Field Settings</h2>
                    <p className="text-muted-foreground mt-1">Configure custom fields for departments, designations, and other entities.</p>
                </div>
                <div className="flex gap-2">
                    <Select value={entityFilter} onValueChange={setEntityFilter}>
                        <SelectTrigger className="w-[180px] bg-background" data-testid="select-entity-filter">
                            <SelectValue placeholder="Filter by entity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Entities</SelectItem>
                            {entityOptions.map(e => (
                                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-field">
                                <Plus className="w-4 h-4 mr-2" /> Add Field
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader><DialogTitle>Create Custom Field</DialogTitle></DialogHeader>
                            <FieldForm
                                entityOptions={entityOptions}
                                dropdownSources={dropdownSources || []}
                                onSubmit={(values) => createMutation.mutate(values)}
                                isPending={createMutation.isPending}
                                submitLabel="Create Field"
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-foreground">Field Name</TableHead>
                            <TableHead className="text-foreground">Key</TableHead>
                            <TableHead className="text-foreground">Entity</TableHead>
                            <TableHead className="text-foreground">Type</TableHead>
                            <TableHead className="text-foreground">Required</TableHead>
                            <TableHead className="text-foreground">Active</TableHead>
                            <TableHead className="text-foreground">Order</TableHead>
                            <TableHead className="text-right text-foreground">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(!filteredFields || filteredFields.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    No custom fields configured yet. Click "Add Field" to create one.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredFields?.map((field) => (
                            <TableRow key={field.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-field-${field.id}`}>
                                <TableCell className="font-medium text-foreground">{field.fieldName}</TableCell>
                                <TableCell className="text-muted-foreground font-mono text-sm">{field.fieldKey}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">{field.entity}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="capitalize">{field.fieldType}</Badge>
                                </TableCell>
                                <TableCell>
                                    {field.required ? <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Yes</Badge> : <span className="text-muted-foreground">No</span>}
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={field.isActive ?? true}
                                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: field.id, isActive: checked })}
                                        data-testid={`switch-active-${field.id}`}
                                    />
                                </TableCell>
                                <TableCell className="text-muted-foreground">{field.sortOrder}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Dialog open={editingField?.id === field.id} onOpenChange={(open) => !open && setEditingField(null)}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => setEditingField(field)} data-testid={`button-edit-field-${field.id}`}>
                                                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-lg">
                                                <DialogHeader><DialogTitle>Edit Field: {field.fieldName}</DialogTitle></DialogHeader>
                                                <FieldForm
                                                    entityOptions={entityOptions}
                                                    dropdownSources={dropdownSources || []}
                                                    defaultValues={field}
                                                    onSubmit={(values) => updateMutation.mutate({ id: field.id, values })}
                                                    isPending={updateMutation.isPending}
                                                    submitLabel="Update Field"
                                                />
                                            </DialogContent>
                                        </Dialog>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" data-testid={`button-delete-field-${field.id}`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Field?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the custom field "{field.fieldName}" for {field.entity}. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteMutation.mutate(field.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        </div>
    );
}

function FieldForm({ entityOptions, dropdownSources, defaultValues, onSubmit, isPending, submitLabel }: {
    entityOptions: { value: string; label: string }[];
    dropdownSources: { value: string; label: string }[];
    defaultValues?: Partial<CustomField>;
    onSubmit: (values: any) => void;
    isPending: boolean;
    submitLabel: string;
}) {
    const [fieldType, setFieldType] = useState(defaultValues?.fieldType || "text");
    const [entity, setEntity] = useState(defaultValues?.entity || "");
    const [fieldName, setFieldName] = useState(defaultValues?.fieldName || "");
    const [fieldKey, setFieldKey] = useState(defaultValues?.fieldKey || "");
    const [required, setRequired] = useState(defaultValues?.required || false);
    const [sortOrder, setSortOrder] = useState(defaultValues?.sortOrder || 0);
    const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
    const opts = (defaultValues?.options || {}) as Record<string, any>;
    const [dropdownSource, setDropdownSource] = useState(opts.dropdownSource || "custom");
    const [customOptions, setCustomOptions] = useState<string>(
        (opts.customOptions || []).join("\n")
    );
    const [numberMin, setNumberMin] = useState<string>(opts.min?.toString() || "");
    const [numberMax, setNumberMax] = useState<string>(opts.max?.toString() || "");
    const [textCase, setTextCase] = useState(opts.textCase || "any");
    const [textMaxLength, setTextMaxLength] = useState<string>(opts.maxLength?.toString() || "");

    const autoGenerateKey = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    };

    const handleNameChange = (name: string) => {
        setFieldName(name);
        if (!defaultValues?.fieldKey) {
            setFieldKey(autoGenerateKey(name));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const options: Record<string, any> = {};

        if (fieldType === "dropdown") {
            options.dropdownSource = dropdownSource;
            if (dropdownSource === "custom") {
                options.customOptions = customOptions.split("\n").map(s => s.trim()).filter(Boolean);
            }
        } else if (fieldType === "number") {
            if (numberMin) options.min = parseFloat(numberMin);
            if (numberMax) options.max = parseFloat(numberMax);
        } else if (fieldType === "text") {
            if (textCase !== "any") options.textCase = textCase;
            if (textMaxLength) options.maxLength = parseInt(textMaxLength);
        }

        onSubmit({
            entity,
            fieldName,
            fieldKey,
            fieldType,
            required,
            sortOrder,
            isActive,
            options,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Entity</Label>
                    <Select value={entity} onValueChange={setEntity} required>
                        <SelectTrigger className="bg-background" data-testid="select-field-entity">
                            <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                        <SelectContent>
                            {entityOptions.map(e => (
                                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Field Type</Label>
                    <Select value={fieldType} onValueChange={(v) => setFieldType(v as any)}>
                        <SelectTrigger className="bg-background" data-testid="select-field-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Field Name</Label>
                    <Input
                        value={fieldName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Branch Code"
                        className="bg-background"
                        required
                        data-testid="input-field-name"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Field Key</Label>
                    <Input
                        value={fieldKey}
                        onChange={(e) => setFieldKey(e.target.value)}
                        placeholder="e.g. branch_code"
                        className="bg-background font-mono text-sm"
                        required
                        data-testid="input-field-key"
                    />
                </div>
            </div>

            {fieldType === "text" && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Text Case</Label>
                        <Select value={textCase} onValueChange={setTextCase}>
                            <SelectTrigger className="bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">Any Case</SelectItem>
                                <SelectItem value="uppercase">Uppercase Only</SelectItem>
                                <SelectItem value="lowercase">Lowercase Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Max Length</Label>
                        <Input
                            type="number"
                            value={textMaxLength}
                            onChange={(e) => setTextMaxLength(e.target.value)}
                            placeholder="No limit"
                            className="bg-background"
                        />
                    </div>
                </div>
            )}

            {fieldType === "number" && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Min Value</Label>
                        <Input
                            type="number"
                            value={numberMin}
                            onChange={(e) => setNumberMin(e.target.value)}
                            placeholder="No minimum"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Max Value</Label>
                        <Input
                            type="number"
                            value={numberMax}
                            onChange={(e) => setNumberMax(e.target.value)}
                            placeholder="No maximum"
                            className="bg-background"
                        />
                    </div>
                </div>
            )}

            {fieldType === "dropdown" && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Dropdown Data Source</Label>
                        <Select value={dropdownSource} onValueChange={setDropdownSource}>
                            <SelectTrigger className="bg-background" data-testid="select-dropdown-source">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="custom">Custom Options</SelectItem>
                                {dropdownSources.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label} (from table)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {dropdownSource === "custom" && (
                        <div className="space-y-2">
                            <Label>Options (one per line)</Label>
                            <textarea
                                value={customOptions}
                                onChange={(e) => setCustomOptions(e.target.value)}
                                placeholder={"Option 1\nOption 2\nOption 3"}
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                data-testid="textarea-custom-options"
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Sort Order</Label>
                    <Input
                        type="number"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                        className="bg-background"
                        data-testid="input-sort-order"
                    />
                </div>
                <div className="flex items-end gap-2 pb-1">
                    <Switch checked={required} onCheckedChange={setRequired} data-testid="switch-required" />
                    <Label>Required</Label>
                </div>
                <div className="flex items-end gap-2 pb-1">
                    <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-is-active" />
                    <Label>Active</Label>
                </div>
            </div>

            <Button type="submit" className="w-full" disabled={isPending || !entity || !fieldName || !fieldKey} data-testid="button-submit-field">
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {submitLabel}
            </Button>
        </form>
    );
}
