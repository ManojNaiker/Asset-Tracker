import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Box,
  Repeat,
  FileCheck,
  LogOut,
  Menu,
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "./theme-toggle";

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
        { name: "Page Settings", href: "/settings", icon: Settings },
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
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const { data: pageSettings } = useQuery({ queryKey: ["/api/settings/page"] });

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  if (!user) return null;

  const navItems = getNavItems(user.role);

  const renderNavItems = (isCollapsed: boolean) => (
    <>
      {navItems.map((item) => {
        if (item.children) {
          const isChildActive = item.children.some(child => location === child.href);
          const isOpen = openMenus[item.name] || isChildActive;

          if (isCollapsed) {
            return (
              <Popover key={item.name}>
                <PopoverTrigger asChild>
                  <button
                    className={`w-full flex flex-col items-center py-2 group relative focus:outline-none`}
                    data-testid={`nav-collapsed-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className={`p-3 rounded-lg transition-all duration-200 ${isChildActive ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" sideOffset={8} className="w-48 p-2 bg-slate-900 border-slate-700">
                  <p className="text-xs font-semibold text-slate-400 px-2 pb-2 uppercase tracking-wider">{item.name}</p>
                  <div className="space-y-1">
                    {item.children.map((child) => {
                      const isActive = location === child.href;
                      return (
                        <Link key={child.href} href={child.href}>
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                              isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white hover:bg-slate-800"
                            }`}
                          >
                            <child.icon className="w-4 h-4 shrink-0" />
                            {child.name}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          return (
            <Collapsible
              key={item.name}
              open={isOpen}
              onOpenChange={() => toggleMenu(item.name)}
              className="w-full space-y-1"
            >
              <CollapsibleTrigger asChild>
                <div
                  className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isChildActive ? "text-white bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${isChildActive ? "text-white" : "text-slate-500"}`} />
                    {item.name}
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1 ml-4 pl-4 border-l border-slate-800">
                {item.children.map((child) => {
                  const isActive = location === child.href;
                  return (
                    <Link key={child.href} href={child.href}>
                      <div
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                          isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
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
        if (isCollapsed) {
          return (
            <Link key={item.href || item.name} href={item.href || "#"}>
              <div
                className={`flex justify-center py-2 group relative cursor-pointer`}
                data-testid={`nav-collapsed-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className={`p-3 rounded-lg transition-all duration-200 ${isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                  {item.name}
                </div>
              </div>
            </Link>
          );
        }

        return (
          <Link key={item.href || item.name} href={item.href || "#"}>
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
              <span className="truncate">{item.name}</span>
            </div>
          </Link>
        );
      })}
    </>
  );

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className={`p-4 ${isCollapsed ? "px-2" : "p-6"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 border border-slate-200/50 shadow-sm ring-1 ring-black/[0.08]">
              <img src={pageSettings?.logoUrl || "/images/logo.png"} alt={pageSettings?.companyName || "AssetAlloc"} className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h1 className="text-xl font-display font-bold tracking-tight text-white">{pageSettings?.softwareName || "AssetAlloc"}</h1>
                <p className="text-xs text-blue-200/70 font-medium">{pageSettings?.companyName || "Light Finance"}</p>
              </div>
            )}
          </div>
          {!isCollapsed && <ThemeToggle />}
        </div>
      </div>

      <Separator className="bg-slate-800" />

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
        {renderNavItems(isCollapsed)}
      </div>

      <div className={`p-4 bg-slate-950/50 ${isCollapsed ? "px-2 flex flex-col items-center" : ""}`}>
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
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur-md z-40 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-accent shrink-0"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </Button>
        <div className="ml-3 flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200/50 shadow-sm ring-1 ring-black/[0.08]">
            <img src={pageSettings?.logoUrl || "/images/logo.png"} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-lg tracking-tight truncate text-foreground">{pageSettings?.companyName || "AssetAlloc"}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 border-r transition-all duration-300 ease-in-out ${
          desktopCollapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent isCollapsed={desktopCollapsed} />
        {/* Toggle Button — positioned at bottom of header area, away from nav items */}
        <button
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="absolute -right-3 bottom-24 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition-colors z-50"
          data-testid="button-toggle-sidebar"
        >
          {desktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 border-r-slate-800 bg-slate-900 text-white flex flex-col">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${desktopCollapsed ? "lg:ml-20" : "lg:ml-64"} min-h-screen w-full overflow-x-hidden`}>
        <div className="max-w-7xl mx-auto p-3 sm:p-6 md:p-8 pt-20 lg:pt-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
