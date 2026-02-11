import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Box,
  Repeat,
  FileCheck,
  LogOut,
  Menu,
  X,
  Building2,
  PieChart,
  History,
  Settings,
  ChevronDown,
  ChevronRight,
  Mail,
  UserCog
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Navigation Items based on roles
const getNavItems = (role: string) => {
  const items = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "verifier", "employee"] },
    { name: "Assets", href: "/assets", icon: Box, roles: ["admin", "verifier"] },
    { name: "Employees", href: "/employees", icon: Users, roles: ["admin"] },
    { name: "Allocations", href: "/allocations", icon: Repeat, roles: ["admin"] },
    { name: "My Assets", href: "/my-assets", icon: Box, roles: ["employee"] },
    { name: "Verifications", href: "/verifications", icon: FileCheck, roles: ["admin", "verifier"] },
    { name: "Asset Types", href: "/asset-types", icon: Building2, roles: ["admin"] },
    { name: "Audit Trail", href: "/audit-trail", icon: History, roles: ["admin"] },
    {
      name: "Settings",
      icon: Settings,
      roles: ["admin"],
      children: [
        { name: "User Management", href: "/users", icon: UserCog },
        { name: "Email Settings", href: "/settings", icon: Mail },
      ]
    },
  ];
  return items.filter(item => item.roles.includes(role));
};

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const NavContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-6">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <img src="/images/logo.png" alt="Light Microfinance" className="w-full h-full object-contain" />
            </div>
            <div>
                <h1 className="text-xl font-display font-bold tracking-tight">AssetAlloc</h1>
                <p className="text-xs text-blue-200/70 font-medium">Light Finance</p>
            </div>
        </div>
      </div>
      
      <Separator className="bg-slate-800" />
      
      <div className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some(child => location === child.href);
            return (
              <Collapsible
                key={item.name}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                className="space-y-1"
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isChildActive
                        ? "text-white bg-slate-800"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${isChildActive ? "text-white" : "text-slate-500"}`} />
                      {item.name}
                    </div>
                    {settingsOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 pl-4 border-l border-slate-800">
                  {item.children.map((child) => {
                    const isChildActive = location === child.href;
                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                            isChildActive
                              ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          <child.icon className={`w-4 h-4 ${isChildActive ? "text-white" : "text-slate-500"}`} />
                          {child.name}
                        </div>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-500"}`} />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-200 font-bold text-xs">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.username}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 z-50">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" className="lg:hidden fixed top-4 left-4 z-50 p-2">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 border-r-slate-800 bg-slate-900 text-white">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="container max-w-7xl mx-auto p-4 md:p-8 pt-20 lg:pt-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}