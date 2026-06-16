"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  getLead, qualifyLead, disqualifyLead, addActivity, createAssessment
} from "@/lib/api";
import { cn, STATUS_COLORS, scoreColor, formatDate, formatRelative } from "@/lib/utils";
import { ArrowLeft, TrendingUp, Phone, Mail, Building, Calendar, Plus, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Activity } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", engaged: "Engaged",
  qualified: "Qualified", disqualified: "Disqualified", converted: "Converted",
};

const ACTIVITY_ICONS: Record<string, string> = {
  email: "📧", call: "📞", note: "📝",
  status_change: "🔄", score_update: "📊", system: "⚙️",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id),
    refetchInterval: 5000, // poll while score is pending
  });

  const qualify = useMutation({
    mutationFn: () => qualifyLead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", id] }); toast.success("Lead qualified"); },
  });

  const disqualify = useMutation({
    mutationFn: (reason: string) => disqualifyLead(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", id] }); toast.success("Lead disqualified"); },
  });

  const addNote = useMutation({
    mutationFn: () => addActivity(id, { activity_type: "note", subject: "Note", body: noteText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      setNoteText(""); setShowNoteBox(false);
      toast.success("Note added");
    },
  });

  const startAssessment = useMutation({
    mutationFn: () => createAssessment(id),
    onSuccess: (assessment) => {
      toast.success("Readiness assessment created");
      router.push(`/assessments/${assessment.id}`);
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? "Failed to create assessment"),
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-gray-200 rounded" /></div>;
  if (!lead) return <div className="text-gray-500">Lead not found.</div>;

  const canQualify = ["new", "contacted", "engaged"].includes(lead.status);
  const canStartAssessment = lead.status === "qualified";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.first_name} {lead.last_name}</h1>
            <p className="text-sm text-gray-500">{lead.job_title} · {lead.company_name}</p>
          </div>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[lead.status])}>
          {STATUS_LABELS[lead.status]}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left — profile */}
        <div className="col-span-2 space-y-4">
          {/* AI Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> AI Qualification Score
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Lead Score</p>
                <p className={cn("text-4xl font-bold", scoreColor(lead.lead_score))}>
                  {lead.lead_score ?? "—"}<span className="text-lg text-gray-400">/100</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Opportunity Score</p>
                <p className={cn("text-4xl font-bold", scoreColor(lead.opportunity_score))}>
                  {lead.opportunity_score ?? "—"}<span className="text-lg text-gray-400">/100</span>
                </p>
              </div>
            </div>
            {lead.score_rationale && (
              <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{lead.score_rationale}</p>
            )}
            {lead.recommended_action && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-brand-50 rounded-lg">
                <span className="text-brand-600 text-xs font-semibold uppercase tracking-wide">Recommended</span>
                <p className="text-sm text-brand-800">{lead.recommended_action}</p>
              </div>
            )}
          </div>

          {/* Company detail */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Company & Context</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Industry</p><p className="font-medium">{lead.industry ?? "—"}</p></div>
              <div><p className="text-gray-500">Company Size</p><p className="font-medium">{lead.company_size ?? "—"}</p></div>
              <div><p className="text-gray-500">Monthly Call + WhatsApp Volume</p><p className="font-medium">{lead.monthly_call_volume ?? "—"}</p></div>
              <div><p className="text-gray-500">Source</p><p className="font-medium capitalize">{lead.source.replace("_", " ")}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Current Solution</p><p className="font-medium">{lead.current_solution ?? "—"}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Pain Points</p><p className="font-medium">{lead.pain_points ?? "—"}</p></div>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Activity Timeline</h2>
              <button
                onClick={() => setShowNoteBox(!showNoteBox)}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Note
              </button>
            </div>
            {showNoteBox && (
              <div className="mb-4 space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  placeholder="Add a note..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addNote.mutate()}
                    disabled={!noteText.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    Save Note
                  </button>
                  <button onClick={() => setShowNoteBox(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {lead.activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
              ) : (
                lead.activities.map((act: Activity) => (
                  <div key={act.id} className="flex gap-3">
                    <span className="text-lg">{ACTIVITY_ICONS[act.activity_type] ?? "•"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{act.subject}</p>
                      {act.body && <p className="text-xs text-gray-500 mt-0.5">{act.body}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatRelative(act.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right — actions sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Contact</h2>
            <div className="space-y-3">
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600">
                <Mail className="w-4 h-4" />{lead.email}
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600">
                  <Phone className="w-4 h-4" />{lead.phone}
                </a>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Building className="w-4 h-4" />{lead.company_name}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />Created {formatDate(lead.created_at)}
              </div>
            </div>
          </div>

          {/* Gate 1 actions */}
          {canQualify && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-900">Gate 1 — Qualification</h2>
              <p className="text-xs text-gray-500">Review the AI score and decide whether to qualify or disqualify this lead.</p>
              <button
                onClick={() => qualify.mutate()}
                className="w-full py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✓ Qualify Lead
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Reason for disqualifying?");
                  if (reason) disqualify.mutate(reason);
                }}
                className="w-full py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                ✕ Disqualify Lead
              </button>
            </div>
          )}

          {/* Start assessment */}
          {canStartAssessment && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-green-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Start Assessment
              </h2>
              <p className="text-xs text-green-700">Lead is qualified. Run the readiness assessment to generate a proposal.</p>
              <button
                onClick={() => startAssessment.mutate()}
                disabled={startAssessment.isPending}
                className="w-full py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {startAssessment.isPending ? "Creating..." : "Start Readiness Assessment"}
              </button>
            </div>
          )}

          {lead.disqualified_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Disqualified</p>
              <p className="text-xs text-red-600">{lead.disqualified_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
