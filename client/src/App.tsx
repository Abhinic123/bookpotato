import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/auth";
import Welcome from "@/pages/welcome";
import AutofillSuggestions from "@/pages/autofill-suggestions";
import EnhancedBrowse from "@/pages/enhanced-browse";
import Settings from "@/pages/settings";
import EnhancedAuth from "@/pages/enhanced-auth";
import Home from "@/pages/home";
import Browse from "@/pages/browse";
import MyBooks from "@/pages/my-books";
import Societies from "@/pages/societies";
import Referrals from "@/pages/referrals";
import EnhancedProfile from "@/pages/enhanced-profile";
import AdminPanel from "@/pages/admin-panel";
import NotificationsPage from "@/pages/notifications";
import EarningsPage from "@/pages/earnings";
import RewardsPage from "@/pages/rewards";
import AppLayout from "@/components/layout/app-layout";
import { getCurrentUser } from "@/lib/auth";

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/browse" component={EnhancedBrowse} />
        <Route path="/my-books" component={MyBooks} />
        <Route path="/earnings" component={EarningsPage} />
        <Route path="/rewards" component={RewardsPage} />
        <Route path="/societies" component={Societies} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/profile" component={EnhancedProfile} />
        <Route path="/admin" component={AdminPanel} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { data: authData, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => getCurrentUser(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
        <div className="text-center text-white">
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
          <h1 className="text-3xl font-bold mb-2">BookShare</h1>
          <p className="text-lg opacity-90">Community Library</p>
        </div>
      </div>
    );
  }

  if (error || !authData?.user) {
    return (
      <Switch>
        <Route path="/auth" component={EnhancedAuth} />
        <Route component={Welcome} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
