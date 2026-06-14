"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getCSDashboard, getCSClients } from "@/lib/api";
import { Pagination } from "@/components/ui/Pagination";
import {
  cn, HEALTH_RISK_COLORS, HEALTH_RISK_DOT,
  NPS_CATEGORY_COLORS, healthScoreColor, formatDate, formatRelative,
} from "@/lib/utils";
import type { ClientHealthSummary } from "@/types";
import {
  HeartPulse, AlertTriangle, CheckCircle, Clock, TrendingUp, Users,
} from "lucide-react";

function StatCard({
  label, value, sub, icon: Icon, color = "text-gray-900",
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={cn("text-3xl font-bold mt-2", color)}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

function HealthBar({ score }: { score?: number }) {
  const pct = score ?? 0;
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={cn("h-2 rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-sm font-bold w-8 text-right", healthScoreColor(score))}>{score ?? "—"}</span>
    </div>
  );
}

function NpsDonut({ promoters, passives, detractors }: { promoters: number; passives: number; detractors: number }) {
  const total = promoters + passives + detractors;
  if (total === 0) return <p className="text-sm text-gray-400 text-center py-4">No NPS data yet</p>;
  const pctP = Math.round((promoters / total) * 100);
  const pctN = Math.round((detractors / total) * 100);
  const npsScore = pctP - pctN;
  return (
    <div className="flex items-center gap-6">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.8" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3.8"
            strokeDasharray={`${pctP} ${100 - pctP}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold", npsScore >= 0 ? "text-emerald-600" : "text-red-600")}>
            {npsScore > 0 ? `+${npsScore}` : npsScore}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Promoters</span>
          <span className="ml-auto font-semibold">{promoters}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="text-gray-600">Passives</span>
          <span className="ml-auto font-semibold">{passives}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-gray-600">Detractors</span>
          <span className="ml-auto font-semibold">{detractors}</span>
        </div>
      </div>
    </div>
  );
}

const RISK_ICON: Record<string, React.ElementType> = {
  healthy: CheckCircle,
  at_risk: AlertTriangle,
  critical: AlertTriangle,
};

export default function CustomerSuccessPage() {
  const [page, setPage] = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["cs-dashboard"],
    queryFn: getCSDashboard,
    refetchInterval: 30000,
  });

  const { data: csData, isLoading: clientsLoading } = useQuery({
    queryKey: ["cs-clients", page],
    queryFn: () => getCSClients(page, 25),
    refetchInterval: 30000,
  });
  const clients = csData?.items ?? [];
  const paginationProps = csData ? { page: csData.page, pages: csData.pages, total: csData.total, page_size: csData.page_size } : null;

  const atRiskClients = clients.filter((c: ClientHealthSummary) => c.risk_level !== "healthy");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-brand-600" /> Customer Success
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {summary ? `${summary.active_clients} active clients · ${summary.go_live_clients} in go-live` : "Loading..."}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : summary && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Active Clients" value={summary.active_clients + summary.go_live_clients} icon={Users} />
            <StatCard label="Healthy" value={summary.healthy} sub="score ≥ 70" icon={CheckCircle} color="text-emerald-600" />
            <StatCard label="At Risk" value={summary.at_risk} sub="score 40–69" icon={AlertTriangle} color="text-yellow-600" />
            <StatCard label="Critical" value={summary.critical} sub="score < 40" icon={AlertTriangle} color="text-red-600" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Avg health */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Avg Health Score</p>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <p className={cn("text-4xl font-bold", healthScoreColor(summary.avg_health_score))}>
                {summary.avg_health_score ?? "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">out of 100</p>
            </div>

            {/* NPS */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">NPS Breakdown</p>
              <NpsDonut promoters={summary.promoters} passives={summary.passives} detractors={summary.detractors} />
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Action Required</p>
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-blue-700">Check-ins due (7 days)</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{summary.checkins_due_7_days}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs text-orange-700">Renewals due (30 days)</span>
                </div>
                <span className="text-sm font-bold text-orange-700">{summary.renewals_due_30_days}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs text-yellow-700">Renewals due (60 days)</span>
                </div>
                <span className="text-sm font-bold text-yellow-700">{summary.renewals_due_60_days}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* At-risk clients */}
      {atRiskClients.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Clients Needing Attention ({atRiskClients.length})
          </h2>
          <div className="space-y-2">
            {atRiskClients.map((c: ClientHealthSummary) => {
              const Icon = RISK_ICON[c.risk_level];
              return (
                <Link key={c.client_id} href={`/clients/${c.client_id}`}
                  className="flex items-center gap-4 p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", HEALTH_RISK_DOT[c.risk_level])} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{c.company_name}</p>
                    <p className="text-xs text-gray-400">
                      {c.days_since_go_live != null ? `${c.days_since_go_live}d since go-live` : ""}
                      {c.last_checkin ? ` · Last check-in ${formatRelative(c.last_checkin)}` : " · No check-ins yet"}
                    </p>
                  </div>
                  <div className="w-32">
                    <HealthBar score={c.health_score} />
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium shrink-0", HEALTH_RISK_COLORS[c.risk_level])}>
                    {c.risk_level.replace("_", " ")}
                  </span>
                  <Icon className={cn("w-4 h-4 shrink-0", c.risk_level === "critical" ? "text-red-500" : "text-yellow-500")} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* All active clients table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">All Active Clients</h2>
          <p className="text-xs text-gray-400">{paginationProps?.total ?? 0} clients</p>
        </div>
        {clientsLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <HeartPulse className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No active clients yet. Clients appear here once they go live.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Health</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Check-in</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last NPS</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Live</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((c: ClientHealthSummary) => (
                <tr key={c.client_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900">{c.company_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.status.replace("_", " ")}</p>
                  </td>
                  <td className="px-5 py-3 w-40">
                    <HealthBar score={c.health_score} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", HEALTH_RISK_DOT[c.risk_level])} />
                      <span className="text-xs capitalize text-gray-700">{c.risk_level.replace("_", " ")}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {c.last_checkin ? formatRelative(c.last_checkin) : <span className="text-gray-300">None</span>}
                  </td>
                  <td className="px-5 py-3">
                    {c.last_nps != null ? (
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                        c.last_nps >= 9 ? NPS_CATEGORY_COLORS.promoter :
                        c.last_nps >= 7 ? NPS_CATEGORY_COLORS.passive :
                        NPS_CATEGORY_COLORS.detractor
                      )}>{c.last_nps}/10</span>
                    ) : <span className="text-xs text-gray-300">No NPS</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {c.days_since_go_live != null ? `${c.days_since_go_live}d` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.client_id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {paginationProps && (
          <div className="px-5 border-t border-gray-100">
            <Pagination {...paginationProps} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
