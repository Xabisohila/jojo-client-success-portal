"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getLeads, getPipelineSummary, qualifyLead, disqualifyLead } from "@/lib/api";
import { cn, STATUS_COLORS, scoreColor, formatDate } from "@/lib/utils";
import { Lead } from "@/types";
import { Plus, Search, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";

const STATUSES = ["new", "contacted", "engaged", "qualified", "disqualified", "converted"];
const STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", engaged: "Engaged",
  qualified: "Qualified", disqualified: "Disqualified", converted: "Converted",
};

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-gray-400">Scoring...</span>;
  return (
    <span className={cn("text-sm font-bold", scoreColor(score))}>
      {score}<span className="text-xs font-normal text-gray-400">/100</span>
    </span>
  );
}

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["leads", statusFilter, page],
    queryFn: () => getLeads(statusFilter ? { status: statusFilter, page, page_size: 25 } : { page, page_size: 25 }),
  });
  const leads = data?.items ?? [];
  const paginationProps = data ? { page: data.page, pages: data.pages, total: data.total, page_size: data.page_size } : null;

  const { data: pipeline } = useQuery({
    queryKey: ["pipeline-summary"],
    queryFn: getPipelineSummary,
  });

  const qualify = useMutation({
    mutationFn: ({ id }: { id: string }) => qualifyLead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead qualified"); },
  });

  const disqualify = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => disqualifyLead(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead disqualified"); },
  });

  const filtered = leads.filter((l: Lead) =>
    !search || `${l.first_name} ${l.last_name} ${l.company_name} ${l.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleFilterChange = (s: string) => { setStatusFilter(s); setPage(1); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">{paginationProps ? paginationProps.total : (pipeline?.total ?? 0)} total leads in pipeline</p>
        </div>
        <Link href="/leads/new" className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Lead
        </Link>
      </div>

      {/* Pipeline bar */}
      {pipeline && (
        <div className="grid grid-cols-6 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(statusFilter === s ? "" : s)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                statusFilter === s ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <p className="text-xs text-gray-500 font-medium">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{(pipeline as unknown as Record<string, number>)[s] ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or email..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      {/* Lead table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No leads found. Add your first lead to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead: Lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                      {lead.first_name} {lead.last_name}
                    </Link>
                    <p className="text-xs text-gray-400">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.company_name}</p>
                    <p className="text-xs text-gray-400">{lead.industry ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[lead.status])}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <TrendingUp className={cn("w-3.5 h-3.5", scoreColor(lead.lead_score))} />
                      <ScoreBadge score={lead.lead_score} />
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-gray-500 truncate">{lead.recommended_action ?? "Awaiting score..."}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    {lead.status === "new" || lead.status === "contacted" || lead.status === "engaged" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => qualify.mutate({ id: lead.id })}
                          className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                        >
                          Qualify
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt("Reason for disqualifying?");
                            if (reason) disqualify.mutate({ id: lead.id, reason });
                          }}
                          className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                        >
                          Disqualify
                        </button>
                      </div>
                    ) : null}
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
