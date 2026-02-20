import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmailSettingsSchema, type EmailSettings } from "@shared/schema";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ShieldCheck, ExternalLink, AlertTriangle, Copy, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SsoSettings() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const { data: settings, isLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/email-settings"],
  });

  const form = useForm({
    resolver: zodResolver(insertEmailSettingsSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      fromEmail: "",
      fromName: "",
      enableBookingNotifications: true,
      enableReminders: true,
      enablePasswordReset: true,
      enableLdap: false,
      enableSso: false,
      samlJitEnabled: true,
      samlEntryPoint: "",
      samlIssuer: "",
      samlIdpIssuer: "",
      samlCert: "",
      samlLogoutUrl: "",
      samlServiceProvider: "Skillmine",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        ...settings,
        samlJitEnabled: settings.samlJitEnabled ?? true,
        samlEntryPoint: settings.samlEntryPoint || "",
        samlIssuer: settings.samlIssuer || "urn:skillmine:meeting-room-booking",
        samlIdpIssuer: settings.samlIdpIssuer || "",
        samlCert: settings.samlCert || "",
        samlLogoutUrl: settings.samlLogoutUrl || "",
        samlServiceProvider: settings.samlServiceProvider || "Skillmine",
      } as any);
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("/api/email-settings", {
        method: "POST",
        body: JSON.stringify(values),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-settings"] });
      toast({
        title: "Settings updated",
        description: "SSO configuration has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleToggleSso = (checked: boolean) => {
    if (!checked) {
      setShowDisableConfirm(true);
    } else {
      form.setValue("enableSso", true);
      if (!form.getValues("samlIssuer")) {
        form.setValue("samlIssuer", "urn:skillmine:meeting-room-booking");
      }
    }
  };

  const confirmDisableSso = () => {
    const values = {
      ...form.getValues(),
      enableSso: false,
      samlEntryPoint: "",
      samlIssuer: "",
      samlIdpIssuer: "",
      samlCert: "",
      samlLogoutUrl: "",
      samlJitEnabled: true,
    };

    // Reset form state locally
    form.reset(values);

    // Save to backend immediately
    mutation.mutate(values);

    setShowDisableConfirm(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Service Provider Entity ID has been copied.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SAML Authentication</CardTitle>
                  <CardDescription>
                    Enable and configure SAML-based SSO for your organization.
                  </CardDescription>
                </div>
                <FormField
                  control={form.control}
                  name="enableSso"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={handleToggleSso}
                          data-testid="switch-enable-sso"
                        />
                      </FormControl>
                      <FormLabel>Enable SSO</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </CardHeader>
            {form.watch("enableSso") && (
              <CardContent className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="samlJitEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">JIT User Provisioning</FormLabel>
                          <FormDescription>
                            Automatically create a new user account if they don't exist in the application.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="toggle-saml-jit"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="samlServiceProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Provider</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly disabled className="bg-muted" />
                          </FormControl>
                          <FormDescription>The SAML Service Provider name.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="samlIssuer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Provider Entity ID (Issuer)</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="urn:skillmine:meeting-room-booking" data-testid="input-saml-issuer" />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(field.value || "urn:skillmine:meeting-room-booking")}
                              title="Copy to clipboard"
                            >
                              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormDescription>Your application's unique SAML identifier.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="samlIdpIssuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identity Provider Entity ID (Issuer)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://skillmine.example.com/adfs/services/trust" data-testid="input-saml-idp-issuer" />
                        </FormControl>
                        <FormDescription>The identifier for your SAML Identity Provider (Okta, Azure, etc.)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="samlEntryPoint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SAML Entry Point (SSO URL)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://skillmine.example.com/adfs/ls/" data-testid="input-saml-entry-point" />
                        </FormControl>
                        <FormDescription>The URL where the SAML authentication request will be sent.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="samlLogoutUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SAML Logout URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://skillmine.example.com/adfs/ls/?wa=wsignout1.0" data-testid="input-saml-logout-url" />
                        </FormControl>
                        <FormDescription>The URL where the SAML logout request will be sent.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="samlCert"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public X.509 Certificate</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            className="font-mono h-32"
                            data-testid="textarea-saml-cert"
                          />
                        </FormControl>
                        <FormDescription>The public certificate provided by Skillmine for signature verification.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-md bg-muted p-4 flex items-start space-x-3 mt-4">
                    <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Metadata URL</p>
                      <p className="text-muted-foreground mt-1">
                        Provide this URL to Skillmine to complete the trust relationship:
                      </p>
                      <code className="block mt-2 p-2 bg-background rounded border text-xs break-all">
                        {window.location.origin}/api/auth/saml/metadata
                      </code>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  This will disable SAML authentication for all users and <strong>permanently clear</strong> all your current SAML configuration settings. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDisableSso} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Disable and Clear Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex justify-end">
            {form.watch("enableSso") && (
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-sso">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save SSO Settings
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
