import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees";
import AssetsPage from "@/pages/assets";
import AllocationsPage from "@/pages/allocations";
import AssetTypesPage from "@/pages/asset-types";
import VerificationsPage from "@/pages/verifications";
import MyAssetsPage from "@/pages/my-assets";
import AuditTrailPage from "@/pages/audit-trail";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import { Loader2 } from "lucide-react";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      
      <Route path="/employees">
        <ProtectedRoute component={EmployeesPage} />
      </Route>

      <Route path="/assets">
        <ProtectedRoute component={AssetsPage} />
      </Route>

      <Route path="/allocations">
        <ProtectedRoute component={AllocationsPage} />
      </Route>

      <Route path="/asset-types">
        <ProtectedRoute component={AssetTypesPage} />
      </Route>

      <Route path="/verifications">
        <ProtectedRoute component={VerificationsPage} />
      </Route>

      <Route path="/my-assets">
        <ProtectedRoute component={MyAssetsPage} />
      </Route>

      <Route path="/audit-trail">
        <ProtectedRoute component={AuditTrailPage} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

      <Route path="/users">
        <ProtectedRoute component={UsersPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <AuthProvider>
                <Router />
                <Toaster />
            </AuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
