"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "./api";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue>({ user: undefined, isLoading: true, refetch: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch: () => refetch() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
