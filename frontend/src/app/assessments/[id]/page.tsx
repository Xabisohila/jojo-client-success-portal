"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  getAssessment, updateAssessmentSection, submitAssessment,
  approveAssessment, requestAssessmentChanges
} from "@/lib/api";
import { cn, STATUS_COLORS, RISK_COLORS } from "@/lib/utils";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { AssessmentSection, AssessmentResponse } from "@/types";

// Question option definitions (mirrors backend)
const QUESTION_OPTIONS: Record<string, Record<string, string[]>> = {
  business: {
    b1_call_volume: ["Less than 10 calls/day", "10–30 calls/day", "31–60 calls/day", "More than 60 calls/day"],
    b2_services: ["Answer general enquiries", "Book / reschedule appointments", "Capture lead information", "Qualify callers", "Transfer urgent calls"],
    b3_business_hours: ["Yes, fixed hours with no exceptions", "Yes, but hours vary by day/season", "No, it varies"],
    b4_after_hours: ["Voicemail only — calls are missed", "Calls go unanswered", "Staff member takes calls", "Third-party answering service"],
  },
  operational: {
    o1_call_script: ["Yes, fully documented and followed", "Partially — some guidelines exist", "No — staff handle calls differently"],
    o2_booking_process: ["Online booking system (e.g. Calendly, HotDoc)", "Manual calendar (Google Calendar, Outlook)", "Paper-based / spreadsheet", "No formal booking process"],
    o3_escalation: ["Yes, clear escalation rules exist", "Informal — staff use judgment", "No — all calls treated the same"],
    o4_champion: ["Owner / Managing Director", "Practice / Office Manager", "Senior staff member", "Not yet identified"],
  },
  technology: {
    t1_phone_system: ["VoIP system (e.g. RingCentral, 3CX, Teams)", "Business landline (PSTN)", "Mobile only", "Mixed / unknown"],
    t2_calendar: ["Google Calendar", "Microsoft Outlook / Exchange", "Industry-specific software (e.g. Cliniko, Mindbody)", "Paper diary / no system"],
    t3_crm: ["Yes — HubSpot, Salesforce, or similar", "Yes — industry-specific CRM", "No CRM currently"],
    t4_call_forwarding: ["Yes, we can do this immediately", "Yes, but need IT/provider assistance", "Unsure", "No"],
  },
  leadership: {
    l1_decision_maker: ["Yes — they initiated this process", "Yes — they are aware and supportive", "Partially — they have delegated it", "No — I am evaluating without their knowledge"],
    l2_budget: ["Yes — approved budget in place", "Budget is available but not formally approved", "Exploring options to build a case", "No budget allocated"],
    l3_timeline: ["Within 4 weeks", "1–3 months", "3–6 months", "No specific timeline"],
    l4_blockers: ["No blockers — ready to proceed", "Minor concerns — manageable", "Staff resistance or training concerns", "Significant blockers identified"],
  },
};

const SECTION_TITLES: Record<string, string> = {
  business: "Business Readiness",
  operational: "Operational Readiness",
  technology: "Technology Readiness",
  leadership: "Leadership Readiness",
};

const SECTION_ORDER = ["business", "operational", "technology", "leadership"];

function SectionForm({ section, assessmentId, readOnly }: { section: AssessmentSection; assessmentId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(section.responses.map((r) => [r.question_key, r.response_value ?? ""]))
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateAssessmentSection(assessmentId, {
        section_type: section.section_type,
        responses: section.responses.map((r: AssessmentResponse) => ({
          question_key: r.question_key,
          question_text: r.question_text,
          response_value: answers[r.question_key] ?? "",
          weight: r.weight,
        })),
      });
      qc.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      toast.success(`${SECTION_TITLES[section.section_type]} saved`);
    } catch {
      toast.error("Failed to save section");
    } finally {
      setSaving(false);
    }
  };

  const opts = QUESTION_OPTIONS[section.section_type] ?? {};

  return (
    <div className="space-y-4">
      {section.responses.map((resp: AssessmentResponse) => {
        const options = opts[resp.question_key] ?? [];
        return (
          <div key={resp.question_key}>
            <p className="text-sm font-medium text-gray-800 mb-2">{resp.question_text}</p>
            <div className="space-y-2">
              {options.map((opt) => (
                <label key={opt} className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all text-sm",
                  answers[resp.question_key] === opt
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-gray-200 hover:border-gray-300 text-gray-700",
                  readOnly && "pointer-events-none opacity-75"
                )}>
                  <input
                    type="radio"
                    name={resp.question_key}
                    value={opt}
                    checked={answers[resp.question_key] === opt}
                    onChange={() => !readOnly && setAnswers(prev => ({ ...prev, [resp.question_key]: opt }))}
                    className="accent-brand-600"
                    disabled={readOnly}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {!readOnly && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : `Save ${SECTION_TITLES[section.section_type]}`}
        </button>
      )}
      {section.score != null && (
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span className="text-gray-500">Section score:</span>
          <span className="font-bold text-gray-900">{section.score}/{section.max_score}</span>
        </div>
      )}
    </div>
  );
}

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState(0);
  const [reviewerNotes, setReviewerNotes] = useState("");

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => getAssessment(id),
    refetchInterval: (q) => q.state.data?.status === "ai_scored" ? 3000 : false,
  });

  const submit = useMutation({
    mutationFn: () => submitAssessment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessment", id] }); toast.success("Assessment submitted for AI scoring"); },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? "Failed to submit"),
  });

  const approve = useMutation({
    mutationFn: () => approveAssessment(id, reviewerNotes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessment", id] }); toast.success("Assessment approved — Proposal generation started"); },
  });

  const requestChanges = useMutation({
    mutationFn: () => requestAssessmentChanges(id, reviewerNotes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessment", id] }); toast.success("Changes requested"); },
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-gray-200 rounded" /></div>;
  if (!assessment) return <div className="text-gray-500">Assessment not found.</div>;

  const isEditable = ["draft", "in_progress", "changes_requested"].includes(assessment.status);
  const isPendingApproval = assessment.status === "pending_approval";
  const isApproved = assessment.status === "approved";
  const recommendations = assessment.ai_recommendations ? JSON.parse(assessment.ai_recommendations) : [];

  const orderedSections = SECTION_ORDER.map(
    (st) => assessment.sections.find((s: AssessmentSection) => s.section_type === st)
  ).filter(Boolean) as AssessmentSection[];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/assessments" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Readiness Assessment</h1>
            <p className="text-sm text-gray-500">Lead ID: {assessment.lead_id.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {assessment.total_score != null && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Score</p>
              <p className="text-2xl font-bold text-gray-900">{assessment.total_score}<span className="text-sm text-gray-400">/100</span></p>
            </div>
          )}
          {assessment.risk_level && (
            <span className={cn("px-3 py-1.5 rounded-full text-sm font-semibold capitalize", RISK_COLORS[assessment.risk_level])}>
              {assessment.risk_level} Risk
            </span>
          )}
          <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[assessment.status])}>
            {assessment.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* AI summary (after scoring) */}
      {assessment.ai_summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-blue-900 mb-2">AI Analysis Summary</p>
          <p className="text-sm text-blue-800">{assessment.ai_summary}</p>
          {recommendations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">Recommendations</p>
              <ul className="space-y-1.5">
                {recommendations.map((r: { priority: number; text: string; category: string }, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 font-bold shrink-0">{r.priority}.</span>{r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {assessment.risks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Identified Risks
          </h2>
          <div className="space-y-3">
            {assessment.risks.map((risk) => (
              <div key={risk.id} className={cn("p-3 rounded-lg border", RISK_COLORS[risk.severity].replace("text-", "border-").replace("bg-", "bg-"))}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">{risk.risk_category}</p>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium capitalize", RISK_COLORS[risk.severity])}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{risk.risk_description}</p>
                {risk.mitigation && <p className="text-xs text-gray-500 mt-1">Mitigation: {risk.mitigation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        {/* Section tabs */}
        <div className="space-y-2">
          {orderedSections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(i)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-all",
                activeSection === i
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              )}
            >
              <p>{SECTION_TITLES[section.section_type]}</p>
              {section.score != null && (
                <p className="text-xs mt-0.5 font-normal text-gray-400">{section.score}/{section.max_score} pts</p>
              )}
            </button>
          ))}
        </div>

        {/* Section form */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-5">
            {SECTION_TITLES[orderedSections[activeSection]?.section_type ?? "business"]}
          </h2>
          {orderedSections[activeSection] && (
            <SectionForm
              section={orderedSections[activeSection]}
              assessmentId={id}
              readOnly={!isEditable}
            />
          )}
        </div>
      </div>

      {/* Submit for scoring */}
      {isEditable && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Ready to score?</p>
            <p className="text-sm text-gray-500">At least 12 of 16 questions must be answered.</p>
          </div>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submit.isPending ? "Submitting..." : "Submit for AI Scoring"}
          </button>
        </div>
      )}

      {/* Gate 2 — Approval panel */}
      {isPendingApproval && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-yellow-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Gate 2 — Assessment Approval
          </h2>
          <p className="text-sm text-yellow-800">Review the AI analysis and risk report above, then approve or request changes.</p>
          <textarea
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Reviewer notes (optional for approval, required for changes)..."
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
              {approve.isPending ? "Approving..." : "Approve & Generate Proposal"}
            </button>
            <button
              onClick={() => {
                if (!reviewerNotes.trim()) { toast.error("Please add notes explaining what changes are needed."); return; }
                requestChanges.mutate();
              }}
              disabled={requestChanges.isPending}
              className="flex items-center gap-2 px-5 py-2.5 border border-orange-300 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Request Changes
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900">Assessment Approved</p>
            <p className="text-sm text-green-700">A proposal has been generated automatically. Check the Proposals section.</p>
          </div>
          <Link href="/proposals" className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
            View Proposals →
          </Link>
        </div>
      )}
    </div>
  );
}
