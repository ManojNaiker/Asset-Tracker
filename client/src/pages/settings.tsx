import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Image as ImageIcon, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: pageSettings, isLoading: isLoadingPage } = useQuery({
        queryKey: ["/api/settings/page"]
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

    const pageForm = useForm<any>({
        values: pageSettings || {
            companyName: "AssetAlloc",
            logoUrl: "/images/logo.png"
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

    if (isLoadingPage) {
        return (
            <LayoutShell>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                <Card className="border-border bg-card">
                    <CardContent className="pt-6">
                        <Form {...pageForm}>
                            <form onSubmit={pageForm.handleSubmit((v) => updatePageMutation.mutate(v))} className="space-y-6">
                                <FormField
                                    control={pageForm.control}
                                    name="companyName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-foreground">Company Name</FormLabel>
                                            <FormControl><Input {...field} placeholder="AssetAlloc" className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
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
                                                    className="border-border"
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
                                                        <FormControl><Input {...field} placeholder="/images/logo.png" className="bg-background" /></FormControl>
                                                        <p className="text-xs text-muted-foreground">Or provide a direct URL to your logo image.</p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" className="px-12" disabled={updatePageMutation.isPending}>
                                    {updatePageMutation.isPending ? "Saving..." : "Save Page Settings"}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </LayoutShell>
    );
}
