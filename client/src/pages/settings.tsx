import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image as ImageIcon, Upload, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function SettingsPage() {
    const [location] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: pageSettings, isLoading: isLoadingPage } = useQuery({
        queryKey: ["/api/settings/page"]
    });

    const { data: emailSettings, isLoading: isLoadingEmail } = useQuery({
        queryKey: ["/api/settings/email"]
    });

    const updatePageMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await apiRequest("PUT", "/api/settings/page", values);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/page"] });
            toast({ title: "Success", description: "Page settings updated successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update page settings", variant: "destructive" });
        }
    });

    const updateEmailMutation = useMutation({
        mutationFn: async (values: any) => {
            const res = await apiRequest("POST", "/api/settings/email", values);
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

    const testEmailMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/settings/email/test", {});
            return res.json();
        },
        onSuccess: (data) => {
            toast({ title: "Success", description: data.message });
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const pageForm = useForm<any>({
        values: pageSettings || {
            softwareName: "AssetAlloc",
            companyName: "Light Finance",
            logoUrl: "/images/logo.png"
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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            pageForm.setValue("logoUrl", data.url);
        } catch (error) {
            toast({ title: "Error", description: "Logo upload failed", variant: "destructive" });
        }
    };

    if ((location === "/settings" && isLoadingPage) || (location === "/email-settings" && isLoadingEmail)) {
        return (
            <LayoutShell>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </LayoutShell>
        );
    }

    if (location === "/email-settings") {
        return (
            <LayoutShell>
                <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-foreground">Email Notification Settings</h1>
                    <p className="text-muted-foreground mt-1">Configure SMTP settings for sending automated allocation notifications.</p>
                </div>

                <div className="space-y-6">
                    <Card className="border-border bg-card">
                        <CardContent className="pt-6">
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

    return (
        <LayoutShell>
            <div className="mb-8">
                <h1 className="text-3xl font-display font-bold text-foreground">Page Settings</h1>
                <p className="text-muted-foreground mt-1">Customize your application branding, including logo and company name.</p>
            </div>

            <div className="space-y-6">
                <Card className="border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/50 border-b border-border">
                        <CardTitle className="text-lg font-display font-bold text-foreground">General Information</CardTitle>
                        <CardDescription>Update the software name and company name displayed in the application.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <Form {...pageForm}>
                            <form onSubmit={pageForm.handleSubmit((data) => updatePageMutation.mutate(data))} className="space-y-6">
                                <div className="grid sm:grid-cols-2 gap-6">
                                    <FormField
                                        control={pageForm.control}
                                        name="softwareName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-foreground">Software Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="AssetAlloc" className="bg-background border-border" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={pageForm.control}
                                        name="companyName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-foreground">Company Name</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Light Finance" className="bg-background border-border" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                
                                <div className="space-y-4">
                                    <FormLabel className="text-foreground">Company Logo</FormLabel>
                                    <div className="flex items-start gap-6">
                                        <div className="w-32 h-32 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center overflow-hidden">
                                            {pageForm.watch("logoUrl") ? (
                                                <img src={pageForm.watch("logoUrl")} alt="Logo Preview" className="w-full h-full object-contain" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    id="logo-upload"
                                                    onChange={handleLogoUpload}
                                                />
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    className="border-border hover:bg-muted"
                                                    onClick={() => document.getElementById("logo-upload")?.click()}
                                                >
                                                    <Upload className="w-4 h-4 mr-2" />
                                                    Upload Logo
                                                </Button>
                                            </div>
                                            <FormField
                                                control={pageForm.control}
                                                name="logoUrl"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl><Input {...field} placeholder="/images/logo.png" className="bg-background border-border" /></FormControl>
                                                        <p className="text-xs text-muted-foreground">Or provide a direct URL to your logo image.</p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full md:w-auto px-12" disabled={updatePageMutation.isPending}>
                                    {updatePageMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save Page Settings
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </LayoutShell>
    );
}
