// Utility functions for cookie management
export function clearAllCookies() {
  document.cookie.split(";").forEach(function(c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  console.log('🧹 All cookies cleared');
}

export function getSessionCookie() {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('connect.sid='))
    ?.split('=')[1];
}

export function logCookieStatus() {
  const sessionCookie = getSessionCookie();
  console.log('🍪 Cookie status:', {
    hasSessionCookie: !!sessionCookie,
    cookieValue: sessionCookie?.slice(0, 20) + '...',
    allCookies: document.cookie
  });
}