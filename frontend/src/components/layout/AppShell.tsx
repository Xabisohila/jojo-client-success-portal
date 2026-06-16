"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginPage) router.replace("/login");
    if (user && isLoginPage) router.replace("/dashboard");
  }, [isLoading, user, isLoginPage, router]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
