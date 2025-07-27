import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, Home, Search, Users, Bookmark, Plus, LogOut, User, Settings, Wallet, Coins, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, logout } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import AddBookModal from "@/components/modals/add-book-modal";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => getCurrentUser(),
  });

  const isAdmin = (authData?.user as any)?.isAdmin || authData?.user?.email === 'abhinic@gmail.com';

  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!authData?.user,
  });

  const { data: userCredits } = useQuery({
    queryKey: ["/api/user/credits"],
    enabled: !!authData?.user,
  });

  const unreadCount = (notifications as any[])?.filter((n: any) => !n.isRead).length || 0;

  const handleLogout = async () => {
    try {
      await logout();
      queryClient.clear();
      // Use window.location to force a full page reload and clear all state
      window.location.href = "/";
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const navigation = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Browse", icon: Search, path: "/browse" },
    { name: "My Books", icon: Bookmark, path: "/my-books" },
    { name: "Earnings", icon: Coins, path: "/earnings" },
    { name: "Societies", icon: Users, path: "/societies" },
  ];

  const isActiveTab = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold text-text-primary">BookShare</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/rewards">
              <Button variant="ghost" size="sm" className="flex items-center space-x-1 px-2">
                <Coins className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-600">
                  {userCredits?.balance || 0}
                </span>
              </Button>
            </Link>
            <Link href="/notifications">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5 text-text-secondary" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {authData?.user ? getInitials(authData.user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {authData?.user?.name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {authData?.user?.email || "user@example.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/my-wishlist">
                    <Heart className="mr-2 h-4 w-4" />
                    <span>Wishlist</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/buy-brocks">
                    <Wallet className="mr-2 h-4 w-4" />
                    <span>Buy Brocks</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        {children}
      </main>

      {/* Floating Action Button */}
      <Button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-30"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
        <div className="max-w-md mx-auto px-4 py-2">
          <div className="flex justify-around">
            {navigation.map((item) => (
              <Link key={item.name} href={item.path}>
                <Button
                  variant="ghost"
                  className={`flex flex-col items-center py-2 px-3 h-auto ${
                    isActiveTab(item.path)
                      ? "text-primary"
                      : "text-text-secondary"
                  }`}
                >
                  <item.icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{item.name}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Add Book Modal */}
      <AddBookModal 
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
    </div>
  );
}
