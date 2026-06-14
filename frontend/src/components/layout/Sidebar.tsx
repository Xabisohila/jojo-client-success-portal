"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardList, FileText,
  Settings, Zap, Building2, HeartPulse, RefreshCcw
} from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/customer-success", label: "Customer Success", icon: HeartPulse },
  { href: "/renewals", label: "Renewals", icon: RefreshCcw },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">Jojo Portal</p>
          <p className="text-xs text-gray-500">Client Success</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">Jojo Client Success Portal v1.0</p>
      </div>
    </aside>
  );
}
