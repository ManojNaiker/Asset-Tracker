import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: emailSettings, isLoading: isLoadingSettings } = useQuery({
        queryKey: ["/api/settings/email"]
    });

    const updateEmailMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await fetch("/api/settings/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            });
            if (!res.ok) throw new Error("Failed to update email settings");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/email"] });
            toast({ title: "Success", description: "Email settings updated successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update email settings", variant: "destructive" });
        }
    });

    const emailForm = useForm<any>({
        values: emailSettings || {
            host: "",
            port: 465,
            secure: true,
            user: "",
            password: "",
            fromEmail: ""
        }
    });

    const testEmailMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/settings/email/test", { method: "POST" });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to send test email");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast({ title: "Success", description: data.message });
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    return (
        <LayoutShell>
            <div className="mb-8">
                <h1 className="text-3xl font-display font-bold text-foreground">System Settings</h1>
                <p className="text-muted-foreground mt-1">Configure system parameters and user access.</p>
            </div>

            <div className="space-y-6">
                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-foreground">Email Notification Settings</CardTitle>
                        <CardDescription className="text-muted-foreground">Configure SMTP settings for sending automated allocation notifications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...emailForm}>
                            <form onSubmit={emailForm.handleSubmit((v) => updateEmailMutation.mutate(v))} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={emailForm.control}
                                    name="host"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">SMTP Host</FormLabel>
                                            <FormControl><Input {...field} placeholder="smtp.gmail.com" className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={emailForm.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">SMTP Port</FormLabel>
                                            <FormControl><Input {...field} type="number" onChange={e => field.onChange(parseInt(e.target.value))} className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={emailForm.control}
                                    name="user"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">SMTP User</FormLabel>
                                            <FormControl><Input {...field} placeholder="your-email@gmail.com" className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={emailForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">SMTP Password</FormLabel>
                                            <FormControl><Input {...field} type="password" placeholder="••••••••" className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={emailForm.control}
                                    name="fromEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">From Email Address</FormLabel>
                                            <FormControl><Input {...field} placeholder="no-reply@lightmf.com" className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={emailForm.control}
                                    name="secure"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-foreground">Use SSL/TLS</FormLabel>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="md:col-span-2 flex gap-4">
                                    <Button type="submit" className="w-full md:w-auto px-12" disabled={updateEmailMutation.isPending}>
                                        {updateEmailMutation.isPending ? "Saving..." : "Save Settings"}
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-full md:w-auto px-12 border-border hover:bg-muted text-foreground"
                                        disabled={testEmailMutation.isPending}
                                        onClick={() => testEmailMutation.mutate()}
                                    >
                                        {testEmailMutation.isPending ? "Testing..." : "Test Email"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </LayoutShell>
    );
}
