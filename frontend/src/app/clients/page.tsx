"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getClients } from "@/lib/api";
import { cn, CLIENT_STATUS_COLORS, formatDate } from "@/lib/utils";
import type { Client } from "@/types";
import { Building2 } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding", implementation: "Implementation",
  go_live: "Go Live", active: "Active", churned: "Churned",
};

const STATUS_STEPS: Record<string, number> = {
  onboarding: 1, implementation: 2, go_live: 3, active: 4, churned: 0,
};

function ProgressBar({ status }: { status: string }) {
  const step = STATUS_STEPS[status] ?? 0;
  return (
    <div className="flex items-center gap-1 mt-1">
      {["Onboarding", "Implementation", "Go Live", "Active"].map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            i < step ? "bg-brand-600" : i === step - 1 ? "bg-brand-400" : "bg-gray-200"
          )} />
          {i < 3 && <div className={cn("w-6 h-px", i < step - 1 ? "bg-brand-400" : "bg-gray-200")} />}
        </div>
      ))}
    </div>
  );
}

export default function ClientsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", page],
    queryFn: () => getClients(page, 25),
  });
  const clients = data?.items ?? [];
  const paginationProps = data ? { page: data.page, pages: data.pages, total: data.total, page_size: data.page_size } : null;

  const byStatus = {
    onboarding: clients.filter((c: Client) => c.status === "onboarding").length,
    implementation: clients.filter((c: Client) => c.status === "implementation").length,
    go_live: clients.filter((c: Client) => c.status === "go_live").length,
    active: clients.filter((c: Client) => c.status === "active").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">{paginationProps?.total ?? 0} total clients</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: "onboarding", label: "Onboarding", color: "bg-blue-500" },
          { key: "implementation", label: "Implementation", color: "bg-purple-500" },
          { key: "go_live", label: "Go Live", color: "bg-orange-500" },
          { key: "active", label: "Active", color: "bg-emerald-500" },
        ].map(({ key, label, color }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
              <p className="text-xs font-medium text-gray-500">{label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{(byStatus as Record<string, number>)[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Client list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No clients yet. Accept a proposal to convert a lead to a client.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Journey</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c: Client) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-brand-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{c.company_name}</p>
                        <p className="text-xs text-gray-400">{c.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.industry ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", CLIENT_STATUS_COLORS[c.status])}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/clients/${c.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {paginationProps && (
          <div className="px-4 border-t border-gray-100">
            <Pagination {...paginationProps} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
