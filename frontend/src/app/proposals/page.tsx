"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getProposals } from "@/lib/api";
import { cn, STATUS_COLORS, formatCurrency, formatDate } from "@/lib/utils";
import type { Proposal } from "@/types";
import { FileText } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";

const STATUS_LABELS: Record<string, string> = {
  generating: "Generating", draft: "Draft", pending_approval: "Pending Approval",
  approved: "Approved", sent: "Sent", viewed: "Viewed",
  accepted: "Accepted", rejected: "Rejected", expired: "Expired",
};

const TIER_LABELS: Record<string, string> = {
  starter: "Starter", professional: "Professional",
  enterprise: "Enterprise", custom: "Custom",
};

export default function ProposalsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["proposals", page],
    queryFn: () => getProposals(page, 25),
  });
  const proposals = data?.items ?? [];
  const paginationProps = data ? { page: data.page, pages: data.pages, total: data.total, page_size: data.page_size } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
        <p className="mt-1 text-sm text-gray-500">
          {paginationProps ? `${paginationProps.total} proposals` : "All generated proposals across the pipeline"}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : proposals.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No proposals yet. Approve an assessment to generate one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proposal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monthly</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Setup</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proposals.map((p: Proposal) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-500">{p.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-400">v{p.version}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{TIER_LABELS[p.pricing_tier]}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(p.monthly_fee)}/mo</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(p.setup_fee)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/proposals/${p.id}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      {p.status === "pending_approval" ? "Review →" : "View →"}
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
