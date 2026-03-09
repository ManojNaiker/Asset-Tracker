import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const { toast } = useToast();
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: pageSettings } = useQuery({
    queryKey: ["/api/settings/page"],
  });

  const urlParams = new URLSearchParams(window.location.search);
  const ssoError = urlParams.get("error");
  if (ssoError && !sessionStorage.getItem("sso_error_shown")) {
    sessionStorage.setItem("sso_error_shown", "1");
    const errorMessages: Record<string, string> = {
      sso_error: "SSO authentication failed. Please check with your administrator that the SSO configuration is correct.",
      sso_no_user: "SSO login succeeded but your account was not found. Please contact your administrator.",
      sso_login_error: "SSO login failed due to a server error. Please try again.",
    };
    setTimeout(() => {
      toast({
        title: "SSO Login Failed",
        description: errorMessages[ssoError] || "An unknown SSO error occurred.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/auth");
      sessionStorage.removeItem("sso_error_shown");
    }, 100);
  }

  const handleSsoLogin = async () => {
    setSsoLoading(true);
    try {
      const res = await fetch("/api/auth/saml/login", { redirect: "manual" });
      if (res.type === "opaqueredirect" || res.status === 302 || res.status === 301) {
        window.location.href = "/api/auth/saml/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "SSO Login Failed",
          description: data.message || "Unable to initiate SSO login. Please contact your administrator.",
          variant: "destructive",
        });
      } else {
        window.location.href = "/api/auth/saml/login";
      }
    } catch {
      toast({
        title: "SSO Login Failed",
        description: "Unable to connect to the SSO service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSsoLoading(false);
    }
  };

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (user) {
    return <Redirect to="/" />;
  }

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(values);
  }

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2">
      {/* Mobile Header: Branding */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-white p-1 flex items-center justify-center">
            <img src={pageSettings?.logoUrl || "/images/logo.png"} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-lg">{pageSettings?.companyName || "AssetAlloc"}</span>
        </div>
      </div>

      {/* Left: Branding (Desktop) */}
      <div className="hidden lg:flex flex-col bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 z-0"></div>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-slate-900 to-transparent z-10"></div>
        
        <div className="relative z-20 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white p-2 flex items-center justify-center border border-border shadow-sm">
            <img src={pageSettings?.logoUrl || "/images/logo.png"} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-2xl">{pageSettings?.companyName || "AssetAlloc"}</span>
        </div>

        <div className="relative z-20 flex-1 flex flex-col justify-center max-w-lg">
          <h1 className="text-5xl font-display font-bold mb-6 leading-tight">
            Manage your assets with <span className="text-primary">precision</span> and <span className="text-primary">ease</span>.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Complete lifecycle management for Light Microfinance Pvt Ltd. Track allocation, verification, and asset health in real-time.
          </p>
        </div>

        <div className="relative z-20 text-sm text-slate-500">
          © 2026 Light Microfinance Pvt Ltd. All rights reserved.
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-xl border-border bg-card">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold text-center text-foreground">Sign in to your account</CardTitle>
            <CardDescription className="text-center text-base text-muted-foreground">
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" className="h-11 bg-background text-foreground border-border" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter password" 
                            className="h-11 bg-background text-foreground border-border pr-10" 
                            {...field} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                    disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : (
                    <>
                      Sign In <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
                  </div>
                </div>

                <Button 
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base font-semibold border-border hover:bg-muted shadow-sm"
                    onClick={handleSsoLogin}
                    disabled={ssoLoading}
                    data-testid="button-sso-login"
                >
                  <Building2 className="mr-2 w-5 h-5 text-primary" />
                  {ssoLoading ? "Connecting..." : "Sign in with SSO"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
