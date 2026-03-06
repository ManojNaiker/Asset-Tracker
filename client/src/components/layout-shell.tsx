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
  ChevronLeft,
  Mail,
  UserCog,
  ShieldCheck
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemeToggle } from "./theme-toggle";

// Navigation Items based on roles
const getNavItems = (role: string) => {
  const items = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "verifier", "employee"] },
    {
      name: "Assets",
      icon: Box,
      roles: ["admin", "verifier"],
      children: [
        { name: "Asset List", href: "/assets", icon: Box },
        { name: "Asset Type", href: "/asset-types", icon: Building2 },
        { name: "Allocation", href: "/allocations", icon: Repeat },
        { name: "Verification", href: "/verifications", icon: FileCheck },
      ]
    },
    { name: "Employees", href: "/employees", icon: Users, roles: ["admin"] },
    { name: "Audit Trail", href: "/audit-trail", icon: History, roles: ["admin"] },
    {
      name: "User Management",
      icon: UserCog,
      roles: ["admin"],
      children: [
        { name: "Users", href: "/users", icon: Users },
      ]
    },
    { name: "Reports", href: "/reports", icon: PieChart, roles: ["admin"] },
    { name: "My Assets", href: "/my-assets", icon: Box, roles: ["employee"] },
    {
      name: "Settings",
      icon: Settings,
      roles: ["admin"],
      children: [
        { name: "Email Settings", href: "/email-settings", icon: Mail },
        { name: "SSO Configuration", href: "/sso-settings", icon: ShieldCheck },
      ]
    },
  ];
  return items.filter(item => item.roles.includes(role));
};

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  
  // Track open state for collapsible menus
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const NavContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className={`p-6 ${isCollapsed ? "items-center px-2" : ""}`}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                    <img src="/images/logo.png" alt="Light Microfinance" className="w-full h-full object-contain" />
                </div>
                {!isCollapsed && (
                  <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                      <h1 className="text-xl font-display font-bold tracking-tight">AssetAlloc</h1>
                      <p className="text-xs text-blue-200/70 font-medium">Light Finance</p>
                  </div>
                )}
            </div>
            {!isCollapsed && <ThemeToggle />}
        </div>
      </div>
      
      <Separator className="bg-slate-800" />
      
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some(child => location === child.href);
            const isOpen = openMenus[item.name] || isChildActive;

            if (isCollapsed) {
              return (
                <div key={item.name} className="flex flex-col items-center py-2 group relative">
                  <div className={`p-3 rounded-lg transition-all duration-200 ${isChildActive ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  {/* Tooltip-like popup for collapsed children could be added here */}
                </div>
              );
            }

            return (
              <Collapsible
                key={item.name}
                open={isOpen}
                onOpenChange={() => toggleMenu(item.name)}
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
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-4 pl-4 border-l border-slate-800">
                  {item.children.map((child) => {
                    const isActive = location === child.href;
                    return (
                      <Link key={child.href} href={child.href}>
                        <div
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                          onClick={() => setMobileOpen(false)}
                        >
                          <child.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
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
            <Link key={item.href || item.name} href={item.href || "#"}>
              <div
                className={`flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className={`p-4 bg-slate-950/50 ${isCollapsed ? "px-2 items-center" : ""}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-200 font-bold text-xs shrink-0">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <Button 
          variant="outline" 
          className={`w-full text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 ${isCollapsed ? "justify-center px-0" : "justify-start"}`}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className={`w-4 h-4 ${isCollapsed ? "" : "mr-2"}`} />
          {!isCollapsed && "Logout"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background/80 backdrop-blur-md z-40 flex items-center px-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </Button>
        <div className="ml-4 flex items-center gap-2">
          <img src="/images/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg">AssetAlloc</span>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:block fixed inset-y-0 left-0 z-50 border-r transition-all duration-300 ease-in-out ${
          desktopCollapsed ? "w-20" : "w-64"
        }`}
      >
        <NavContent isCollapsed={desktopCollapsed} />
        {/* Toggle Button for Desktop */}
        <button
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-colors z-50"
        >
          {desktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 border-r-slate-800 bg-slate-900 text-white">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${desktopCollapsed ? "lg:ml-20" : "lg:ml-64"} min-h-screen`}>
        <div className="container max-w-7xl mx-auto p-4 md:p-8 pt-20 lg:pt-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}