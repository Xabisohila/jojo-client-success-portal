"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { getProposal, approveProposal, sendProposal, acceptProposal, rejectProposal, downloadProposalPdf } from "@/lib/api";
import { cn, STATUS_COLORS, RISK_COLORS, formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle, Send, XCircle, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import type { ProposalLineItem } from "@/types";

const TIER_LABELS: Record<string, string> = {
  starter: "Jojo Starter", professional: "Jojo Professional",
  enterprise: "Jojo Enterprise", custom: "Custom",
};

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reviewerNotes, setReviewerNotes] = useState("");

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => getProposal(id),
    refetchInterval: (q) => q.state.data?.status === "generating" ? 3000 : false,
  });

  const approve = useMutation({
    mutationFn: () => approveProposal(id, reviewerNotes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposal", id] }); toast.success("Proposal approved"); },
  });

  const send = useMutation({
    mutationFn: () => sendProposal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposal", id] }); toast.success("Proposal marked as sent"); },
  });

  const accept = useMutation({
    mutationFn: () => acceptProposal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposal", id] }); toast.success("🎉 Proposal accepted — lead converted to client!"); },
  });

  const reject = useMutation({
    mutationFn: (reason: string) => rejectProposal(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposal", id] }); toast.info("Proposal marked as rejected"); },
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-gray-200 rounded" /></div>;
  if (!proposal) return <div className="text-gray-500">Proposal not found.</div>;

  const isGenerating = proposal.status === "generating";
  const isPendingApproval = proposal.status === "pending_approval";
  const isApproved = proposal.status === "approved";
  const isSent = ["sent", "viewed"].includes(proposal.status);

  const roiMultiplier = proposal.roi_monthly && proposal.monthly_fee
    ? (proposal.roi_monthly / proposal.monthly_fee).toFixed(1)
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/proposals" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{TIER_LABELS[proposal.pricing_tier]} Proposal</h1>
            <p className="text-sm text-gray-500">v{proposal.version} · Valid until {formatDate(proposal.valid_until)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isGenerating && (
            <a
              href={downloadProposalPdf(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          )}
          <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[proposal.status])}>
            {proposal.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {isGenerating && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-600">AI is generating this proposal...</p>
        </div>
      )}

      {!isGenerating && (
        <>
          {/* ROI summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Monthly Fee</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(proposal.monthly_fee)}</p>
              <p className="text-xs text-gray-400">per month</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Setup Fee</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(proposal.setup_fee)}</p>
              <p className="text-xs text-gray-400">one-time</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600">Est. Monthly ROI</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(proposal.roi_monthly)}</p>
              <p className="text-xs text-green-500">per month</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Annual ROI</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(proposal.roi_annual)}</p>
              {roiMultiplier && <p className="text-xs text-green-500">{roiMultiplier}× return on investment</p>}
            </div>
          </div>

          {/* Executive summary */}
          {proposal.executive_summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Executive Summary</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{proposal.executive_summary}</p>
            </div>
          )}

          {/* Scope */}
          {proposal.scope_summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Scope of Services</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{proposal.scope_summary}</p>
            </div>
          )}

          {/* Line items */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Pricing Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Recurring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proposal.line_items.map((item: ProposalLineItem) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{item.item_name}</p>
                      {item.description && <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{item.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(item.total_price)}</td>
                    <td className="px-6 py-4 text-right text-xs text-gray-400">{item.is_recurring ? "Monthly" : "One-off"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ROI rationale */}
          {proposal.roi_rationale && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h2 className="font-semibold text-green-900 mb-2">ROI Rationale</h2>
              <p className="text-sm text-green-800">{proposal.roi_rationale}</p>
            </div>
          )}

          {/* Reviewer notes */}
          {proposal.reviewer_notes && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reviewer Notes</p>
              <p className="text-sm text-gray-700">{proposal.reviewer_notes}</p>
            </div>
          )}

          {/* Gate 3 — Approval */}
          {isPendingApproval && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
              <h2 className="font-semibold text-yellow-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Gate 3 — Proposal Approval
              </h2>
              <p className="text-sm text-yellow-800">Review the AI-generated proposal. Edit if needed, then approve to send to the prospect.</p>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Reviewer notes (optional)..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => approve.mutate()}
                  disabled={approve.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approve.isPending ? "Approving..." : "Approve Proposal"}
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason for rejection?");
                    if (reason) reject.mutate(reason);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Send / Won / Lost actions */}
          {isApproved && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-green-900">Proposal Approved</p>
                <p className="text-sm text-green-700">Mark as sent once you have delivered this to the prospect.</p>
              </div>
              <button
                onClick={() => send.mutate()}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700"
              >
                <Send className="w-4 h-4" /> Mark as Sent
              </button>
            </div>
          )}

          {isSent && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Proposal Sent</p>
                <p className="text-sm text-gray-500">Record the outcome once you hear back from the prospect.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => accept.mutate()}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                >
                  🎉 Won — Mark Accepted
                </button>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason lost?");
                    if (reason) reject.mutate(reason);
                  }}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Lost
                </button>
              </div>
            </div>
          )}

          {proposal.status === "accepted" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <p className="font-semibold text-emerald-900">🎉 Proposal Accepted — Client Converted</p>
              <p className="text-sm text-emerald-700 mt-1">Lead is now a client. Proceed to Phase 2: Client Onboarding.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
