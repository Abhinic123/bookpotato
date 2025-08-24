import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface AuthResponse {
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/login", { email, password });
  return response.json();
}

export async function register(userData: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/register", userData);
  return response.json();
}

export async function logout(): Promise<void> {
  await apiRequest("POST", "/api/auth/logout");
}

export async function getCurrentUser() {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    }
  });
  
  if (response.status === 401) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error("Failed to get current user");
  }
  
  const data = await response.json();
  return data.user;
}
