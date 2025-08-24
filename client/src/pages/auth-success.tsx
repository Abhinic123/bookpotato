import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract session info from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const userId = urlParams.get('user');

    console.log('🔑 Auth success - Session ID:', sessionId, 'User ID:', userId);

    if (sessionId && userId) {
      // Clear any existing cookies
      document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Force a reload to ensure the server-set cookie is used
      setTimeout(() => {
        console.log('🔄 Reloading to sync authentication session');
        window.location.href = '/';
      }, 500);
    } else {
      // No session info, redirect to auth
      setLocation('/auth');
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
      <div className="text-center text-white">
        <div className="mb-6">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Authentication Successful</h1>
        <p className="text-lg opacity-90">Completing login...</p>
      </div>
    </div>
  );
}