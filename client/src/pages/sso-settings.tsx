import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSsoSettingsSchema, type SsoSettings } from "@shared/schema";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ShieldCheck, Copy, ExternalLink } from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";

export default function SsoSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<SsoSettings>({
    queryKey: ["/api/settings/sso"],
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("PUT", "/api/settings/sso", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/sso"] });
      toast({ title: "Success", description: "SSO settings updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertSsoSettingsSchema),
    defaultValues: settings || {
      isEnabled: false,
      jitProvisioning: false,
      entryPoint: "",
      idpEntityId: "",
      spEntityId: window.location.origin,
      publicKey: "",
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  const onSubmit = (values: any) => {
    mutation.mutate(values);
  };

  const metadataUrl = `${window.location.origin}/api/auth/saml/metadata`;

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">SSO Configuration</h1>
        </div>

        <div className="grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Service Provider Information</CardTitle>
              <CardDescription>
                Use these details to configure your Identity Provider (Okta, Azure AD, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Metadata URL</label>
                <div className="flex gap-2">
                  <Input readOnly value={metadataUrl} />
                  <Button variant="outline" size="icon" onClick={() => {
                    navigator.clipboard.writeText(metadataUrl);
                    toast({ title: "Copied", description: "Metadata URL copied to clipboard" });
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={metadataUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Assertion Consumer Service (ACS) URL</label>
                <Input readOnly value={`${window.location.origin}/api/auth/saml/callback`} />
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>SAML Settings</CardTitle>
                  <CardDescription>Configure your Identity Provider details here</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable SSO</FormLabel>
                          <FormDescription>
                            Allow users to sign in using SAML authentication
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="jitProvisioning"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Just-In-Time (JIT) Provisioning</FormLabel>
                          <FormDescription>
                            Automatically create user accounts on first login
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entryPoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSO Target URL (Entry Point)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://idp.example.com/saml/login" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="idpEntityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IdP Entity ID (Issuer)</FormLabel>
                        <FormControl>
                          <Input placeholder="urn:example:idp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="spEntityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SP Entity ID (Audience)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="publicKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X.509 Certificate</FormLabel>
                        <FormControl>
                          <Textarea 
                            className="font-mono text-xs h-32" 
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>The public certificate provided by your IdP</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Configuration
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </LayoutShell>
  );
}
