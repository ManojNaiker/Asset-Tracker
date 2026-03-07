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
                                        createDeptMutation.mutate({ name: formData.get("name") });
                                    }}>
                                        <FormItem>
                                            <FormLabel>Department Name</FormLabel>
                                            <FormControl><Input name="name" required className="bg-background" /></FormControl>
                                        </FormItem>
                                        <Button type="submit" className="w-full">Create</Button>
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
                                        createDesigMutation.mutate({ name: formData.get("name") });
                                    }}>
                                        <FormItem>
                                            <FormLabel>Designation Name</FormLabel>
                                            <FormControl><Input name="name" required className="bg-background" /></FormControl>
                                        </FormItem>
                                        <Button type="submit" className="w-full">Create</Button>
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
        </>
    );

    return hideLayout ? content : <LayoutShell>{content}</LayoutShell>;
}
