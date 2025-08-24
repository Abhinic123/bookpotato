import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";

export default function AuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const authenticated = urlParams.get('authenticated');

  console.log('🔑 Auth callback - Session:', sessionId, 'Authenticated:', authenticated);

  // Force check authentication status
  const { data: authData, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getCurrentUser,
    enabled: !!sessionId,
    retry: 3,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (sessionId && authenticated) {
      console.log('🔄 Setting session cookie manually');
      // Set the session cookie manually
      document.cookie = `connect.sid=s:${sessionId}; path=/; max-age=86400; SameSite=Lax`;
      
      // Force refetch auth data
      setTimeout(() => {
        refetch();
      }, 500);
    }
  }, [sessionId, authenticated, refetch]);

  useEffect(() => {
    if (authData?.user) {
      console.log('✅ Authentication successful, redirecting to home');
      window.location.href = '/';
    }
  }, [authData]);

  // Show loading while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
      <div className="text-center text-white">
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Completing Authentication</h1>
        <p className="text-lg opacity-90">
          {isLoading ? 'Verifying session...' : 'Processing login...'}
        </p>
        <div className="mt-4 text-sm opacity-75">
          Session: {sessionId ? 'Found' : 'Missing'}
        </div>
      </div>
    </div>
  );
}