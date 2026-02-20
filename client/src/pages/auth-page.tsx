import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, ArrowRight } from "lucide-react";
import { Redirect } from "wouter";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 z-0"></div>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-slate-900 to-transparent z-10"></div>
        
        <div className="relative z-20 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white p-2 flex items-center justify-center">
            <img src="/images/logo.png" alt="Light Microfinance" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-2xl">AssetAlloc</span>
        </div>

        <div className="relative z-20 flex-1 flex flex-col justify-center max-w-lg">
          <h1 className="text-5xl font-display font-bold mb-6 leading-tight">
            Manage your assets with <span className="text-blue-500">precision</span> and <span className="text-blue-500">ease</span>.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Complete lifecycle management for Light Microfinance Pvt Ltd. Track allocation, verification, and asset health in real-time.
          </p>
        </div>

        <div className="relative z-20 text-sm text-slate-500">
          © 2024 Light Microfinance Pvt Ltd. All rights reserved.
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex items-center justify-center p-6 bg-slate-50">
        <Card className="w-full max-w-md shadow-xl border-none">
          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold text-center">Sign in to your account</CardTitle>
            <CardDescription className="text-center text-base">
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
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter username" className="h-11 bg-slate-50" {...field} />
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter password" className="h-11 bg-slate-50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                    type="submit" 
                    className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20" 
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
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
                  </div>
                </div>

                <Button 
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-base font-semibold border-slate-200 hover:bg-slate-50 shadow-sm"
                    onClick={() => window.location.href = "/api/auth/saml/login"}
                >
                  <Building2 className="mr-2 w-5 h-5 text-blue-600" />
                  Sign in with SSO
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
