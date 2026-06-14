"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAssessments, getLeads, createAssessment } from "@/lib/api";
import { cn, STATUS_COLORS, RISK_COLORS, formatDate } from "@/lib/utils";
import type { Assessment, Lead } from "@/types";
import { ClipboardList, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", in_progress: "In Progress", ai_scored: "AI Scored",
  pending_approval: "Pending Approval", approved: "Approved",
  changes_requested: "Changes Requested", flagged: "Flagged",
};

export default function AssessmentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["assessments", page],
    queryFn: () => getAssessments(page, 25),
  });
  const assessments = data?.items ?? [];
  const paginationProps = data ? { page: data.page, pages: data.pages, total: data.total, page_size: data.page_size } : null;

  const { data: leadsData } = useQuery({
    queryKey: ["leads", "", 1],
    queryFn: () => getLeads({ page: 1, page_size: 100 }),
  });
  const allLeads = leadsData?.items ?? [];

  // Leads that are qualified but have no assessment yet
  const assessedLeadIds = new Set((assessments as Assessment[]).map((a) => a.lead_id));
  const awaitingAssessment = (allLeads as Lead[]).filter(
    (l) => l.status === "qualified" && !assessedLeadIds.has(l.id)
  );

  const startAssessment = useMutation({
    mutationFn: (leadId: string) => createAssessment(leadId),
    onSuccess: (assessment) => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Assessment created");
      router.push(`/assessments/${assessment.id}`);
    },
    onError: () => toast.error("Failed to create assessment"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Readiness Assessments</h1>
        <p className="mt-1 text-sm text-gray-500">All assessments across qualified leads</p>
      </div>

      {/* Qualified leads awaiting assessment */}
      {awaitingAssessment.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h2 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            {awaitingAssessment.length} Qualified Lead{awaitingAssessment.length > 1 ? "s" : ""} Awaiting Assessment
          </h2>
          <div className="space-y-2">
            {awaitingAssessment.map((lead: Lead) => (
              <div key={lead.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-yellow-100">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{lead.first_name} {lead.last_name}</p>
                  <p className="text-xs text-gray-500">{lead.company_name} · {lead.industry ?? "—"}</p>
                </div>
                <button
                  onClick={() => startAssessment.mutate(lead.id)}
                  disabled={startAssessment.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 text-white text-xs font-semibold rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  Start Assessment <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing assessments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (assessments as Assessment[]).length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No assessments started yet.</p>
            <p className="text-gray-400 text-xs mt-1">Use the panel above to start an assessment for your qualified leads.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assessments.map((a: Assessment) => {
                const lead = allLeads.find((l: Lead) => l.id === a.lead_id);
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{lead?.company_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{lead ? `${lead.first_name} ${lead.last_name}` : a.id.slice(0, 8) + "..."}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[a.status])}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.total_score != null ? (
                        <span className="font-bold text-gray-900">{a.total_score}<span className="text-gray-400 font-normal">/100</span></span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.risk_level ? (
                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium capitalize", RISK_COLORS[a.risk_level])}>
                          {a.risk_level}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/assessments/${a.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                        {a.status === "pending_approval" ? "Review →" : "Open →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
