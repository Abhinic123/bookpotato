import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Home, Search, Users, Bookmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import AddBookModal from "@/components/modals/add-book-modal";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: authData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => getCurrentUser(),
  });

  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!authData?.user,
  });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  const navigation = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Browse", icon: Search, path: "/browse" },
    { name: "My Books", icon: Bookmark, path: "/my-books" },
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
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5 text-text-secondary" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
            <Button variant="ghost" className="p-0" onClick={() => alert('Profile functionality coming soon!')}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {authData?.user ? getInitials(authData.user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
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
