"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type UserRole = "admin" | "callcenter" | null;

interface AuthContextType {
  role: UserRole;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedRole = localStorage.getItem("lcc_user_role") as UserRole;
    const expiry = localStorage.getItem("lcc_auth_expiry");
    
    if (savedRole && expiry && new Date().getTime() < parseInt(expiry)) {
      setRole(savedRole);
    } else {
      localStorage.removeItem("lcc_user_role");
      localStorage.removeItem("lcc_auth_expiry");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!role && pathname !== "/login") {
        router.push("/login");
      } else if (role === "callcenter" && pathname === "/admin") {
        router.push("/");
      }
    }
  }, [role, pathname, isLoading, router]);

  const login = (username: string, password: string): boolean => {
    let assignedRole: UserRole = null;

    if (username === "gmc_admin" && password === "GMC@Admin#2026") {
      assignedRole = "admin";
    } else if (username === "gmc_callcenter" && password === "Gardenia@2026") {
      assignedRole = "callcenter";
    }

    if (assignedRole) {
      setRole(assignedRole);
      localStorage.setItem("lcc_user_role", assignedRole);
      // Expire in 24 hours
      localStorage.setItem("lcc_auth_expiry", (new Date().getTime() + 24 * 60 * 60 * 1000).toString());
      router.push("/");
      return true;
    }
    return false;
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem("lcc_user_role");
    localStorage.removeItem("lcc_auth_expiry");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ role, login, logout, isLoading }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
