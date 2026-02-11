import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Loader2, Edit2, Trash2, Lock, Unlock } from "lucide-react";
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

export default function UsersPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
    const [editingUser, setEditingUser] = useState<any>(null);

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

    const form = useForm({
        resolver: zodResolver(insertUserSchema),
        defaultValues: {
            username: "",
            password: "",
            role: "employee",
            mustChangePassword: false
        }
    });

    const editForm = useForm({
        defaultValues: {
            username: "",
            role: "employee",
            password: ""
        }
    });

    if (isLoading) return <LayoutShell><div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div></LayoutShell>;

    return (
        <LayoutShell>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">User Management</h1>
                    <p className="text-muted-foreground mt-1">Manage system access and roles.</p>
                </div>
                <Dialog>
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
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username (Email)</FormLabel>
                                            <FormControl><Input {...field} placeholder="email@lightmf.com" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? "Creating..." : "Create User"}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead>Username</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.username}</TableCell>
                                <TableCell className="capitalize">{u.role}</TableCell>
                                <TableCell>
                                    <span className={u.isLocked ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                                        {u.isLocked ? "Locked" : "Active"}
                                    </span>
                                </TableCell>
                                <TableCell className="text-slate-500">
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
                                                        editForm.reset({ username: u.username, role: u.role, password: "" });
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Edit User: {u.username}</DialogTitle>
                                                </DialogHeader>
                                                <Form {...editForm}>
                                                    <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate({ id: u.id, values: v }))} className="space-y-4">
                                                        <FormField
                                                            control={editForm.control}
                                                            name="username"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Username (Email)</FormLabel>
                                                                    <FormControl><Input {...field} /></FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={editForm.control}
                                                            name="password"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>New Password (Leave blank to keep current)</FormLabel>
                                                                    <FormControl><Input {...field} type="password" /></FormControl>
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
                                                        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                                                            {updateMutation.isPending ? "Updating..." : "Update User"}
                                                        </Button>
                                                    </form>
                                                </Form>
                                            </DialogContent>
                                        </Dialog>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete the user account for {u.username}.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={() => deleteMutation.mutate(u.id)}
                                                        className="bg-red-600 hover:bg-red-700 text-white"
                                                    >
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
        </LayoutShell>
    );
}
