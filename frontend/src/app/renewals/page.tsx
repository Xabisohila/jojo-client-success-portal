"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getRenewalDashboard, listRenewals } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { RenewalListItem } from "@/types";
import { RefreshCcw, TrendingUp, AlertTriangle, CheckCircle, DollarSign } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";

type Filter = "all" | "urgent" | "in_negotiation" | "renewed";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  in_negotiation: "In Negotiation",
  renewed: "Renewed",
  lost: "Lost",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  in_negotiation: "bg-yellow-100 text-yellow-700",
  renewed: "bg-blue-100 text-blue-700",
  lost: "bg-gray-100 text-gray-500",
};

function daysColor(days: number, status: string) {
  if (status === "renewed") return "text-blue-600 font-semibold";
  if (status === "lost") return "text-gray-400";
  if (days < 0) return "text-red-700 font-bold";
  if (days <= 30) return "text-red-600 font-semibold";
  if (days <= 60) return "text-yellow-600 font-semibold";
  return "text-gray-600";
}

function daysLabel(days: number, status: string) {
  if (status === "renewed") return "Renewed";
  if (status === "lost") return "Lost";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `${days}d`;
}

export default function RenewalsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const { data: dash } = useQuery({ queryKey: ["renewal-dashboard"], queryFn: getRenewalDashboard });
  const { data, isLoading } = useQuery({
    queryKey: ["renewals", filter, page],
    queryFn: () => listRenewals(filter === "all" ? undefined : filter === "urgent" ? "active" : filter, page, 25),
  });
  const renewals = data?.items ?? [];
  const paginationProps = data ? { page: data.page, pages: data.pages, total: data.total, page_size: data.page_size } : null;

  const filtered = filter === "urgent"
    ? renewals.filter((r) => r.days_to_renewal <= 60 && r.status === "active")
    : renewals;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "urgent", label: `Due ≤60 days${dash ? ` (${dash.due_soon})` : ""}` },
    { key: "in_negotiation", label: `In Negotiation${dash ? ` (${dash.in_negotiation})` : ""}` },
    { key: "renewed", label: "Renewed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Renewals & Upsell</h1>
        <p className="mt-1 text-sm text-gray-500">Track contracts, renewal pipeline, and upsell opportunities</p>
      </div>

      {/* Stats */}
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total MRR</p>
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">${dash.total_mrr.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{dash.total_active} active contracts</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">MRR at Risk</p>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">${dash.mrr_at_risk.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{dash.due_soon} due soon · {dash.overdue} overdue</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Upsell Pipeline</p>
              <TrendingUp className="w-4 h-4 text-brand-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">${dash.upsell_pipeline_value.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{dash.upsell_identified} identified · {dash.upsell_pitched} pitched</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Renewed This Qtr</p>
              <CheckCircle className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{dash.renewed_this_quarter}</p>
            <p className="text-xs text-gray-400 mt-0.5">${dash.upsell_won_value.toLocaleString()} upsell won</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(1); }}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              filter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCcw className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No contracts found.</p>
            <p className="text-gray-400 text-xs mt-1">Add a contract from the client detail page → Renewals tab.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contract End</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Left</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">MRR</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Upsells</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r: RenewalListItem) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.company_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{r.client_status.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(r.contract_end)}</td>
                  <td className="px-4 py-3">
                    <span className={daysColor(r.days_to_renewal, r.status)}>
                      {daysLabel(r.days_to_renewal, r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.monthly_fee ? `$${Number(r.monthly_fee).toLocaleString()}/mo` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[r.status])}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.upsell_count > 0 ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                        {r.upsell_count}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {r.next_contact_date ? formatDate(r.next_contact_date) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/clients/${r.client_id}?tab=Renewals`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Manage →
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
