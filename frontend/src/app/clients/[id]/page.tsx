"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  getClient, getOnboarding, saveOnboardingStep, submitOnboarding, approveOnboarding,
  getJojoConfig, approveJojoConfig, regenerateJojoConfig,
  getImplementation, updateTask,
  confirmGoLive, getHealthScores, triggerHealthScore, saveManualHealth,
  getCheckins, createCheckin, getNpsResponses, addNpsResponse,
} from "@/lib/api";
import {
  cn, CLIENT_STATUS_COLORS, STATUS_COLORS,
  TASK_PRIORITY_COLORS, CATEGORY_ICONS, formatDate, formatRelative,
  HEALTH_RISK_COLORS, HEALTH_RISK_DOT, NPS_CATEGORY_COLORS,
  CHECKIN_OUTCOME_COLORS, CHECKIN_TYPE_LABELS, healthScoreColor,
} from "@/lib/utils";
import { ArrowLeft, CheckCircle, AlertTriangle, Zap, HeartPulse, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Onboarding, ImplementationTask, JojoConfig, CustomerHealth, Checkin, NpsResponse } from "@/types";
import { RenewalsTab } from "./RenewalsTab";
import { KnowledgeBaseEditor } from "./KnowledgeBaseEditor";

const CLIENT_STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding", implementation: "Implementation",
  go_live: "Go Live", active: "Active", churned: "Churned",
};

const TABS = ["Overview", "Onboarding", "Configuration", "Implementation", "Customer Success", "Renewals"] as const;
type Tab = typeof TABS[number];

const INPUT = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white";
const SELECT = `${INPUT} appearance-none`;
const TEXTAREA = `${INPUT} resize-none`;

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// ── ONBOARDING WIZARD ─────────────────────────────────────────────────────

function OnboardingWizard({ clientId, onboarding }: { clientId: string; onboarding: Onboarding }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");

  const [form, setForm] = useState({
    // Step 1
    business_name: onboarding.business_name ?? "",
    abn: onboarding.abn ?? "",
    business_phone: onboarding.business_phone ?? "",
    business_email: onboarding.business_email ?? "",
    website: onboarding.website ?? "",
    business_address: onboarding.business_address ?? "",
    staff_count: onboarding.staff_count ?? "",
    // Step 2
    timezone: onboarding.timezone ?? "Australia/Sydney",
    public_holiday_handling: onboarding.public_holiday_handling ?? "",
    emergency_policy: onboarding.emergency_policy ?? "",
    business_hours: onboarding.business_hours ?? Object.fromEntries(
      DAYS.map((d) => [d, { is_open: d !== "saturday" && d !== "sunday", open: "09:00", close: "17:00" }])
    ),
    // Step 3
    primary_services: (onboarding.primary_services ?? []).join("\n"),
    call_types: (onboarding.call_types ?? []).join("\n"),
    excluded_topics: onboarding.excluded_topics ?? "",
    greeting_style: onboarding.greeting_style ?? "professional",
    // Step 4
    faqs: onboarding.faqs ? onboarding.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") : "",
    key_policies: onboarding.key_policies ?? "",
    special_instructions: onboarding.special_instructions ?? "",
    // Step 5
    calendar_system: onboarding.calendar_system ?? "",
    crm_system: onboarding.crm_system ?? "",
    phone_system: onboarding.phone_system ?? "",
    existing_number: onboarding.existing_number ?? "",
    can_forward_calls: onboarding.can_forward_calls ?? true,
    escalation_contacts_raw: onboarding.escalation_contacts
      ? onboarding.escalation_contacts.map((e) => `${e.name} | ${e.role} | ${e.phone} | ${e.trigger}`).join("\n")
      : "",
  });

  const update = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const saveStep = async (stepNum: number) => {
    setSaving(true);
    try {
      let payload: Record<string, unknown> = {};
      if (stepNum === 1) {
        payload = {
          business_name: form.business_name, abn: form.abn,
          business_phone: form.business_phone, business_email: form.business_email,
          website: form.website, business_address: form.business_address, staff_count: form.staff_count,
        };
      } else if (stepNum === 2) {
        payload = {
          business_hours: form.business_hours, timezone: form.timezone,
          public_holiday_handling: form.public_holiday_handling, emergency_policy: form.emergency_policy,
        };
      } else if (stepNum === 3) {
        payload = {
          primary_services: form.primary_services.split("\n").map((s: string) => s.trim()).filter(Boolean),
          call_types: form.call_types.split("\n").map((s: string) => s.trim()).filter(Boolean),
          excluded_topics: form.excluded_topics, greeting_style: form.greeting_style,
        };
      } else if (stepNum === 4) {
        const parsedFaqs = form.faqs.split(/\n\n+/).map((block: string) => {
          const qLine = block.match(/^Q:\s*(.+)/m)?.[1] ?? "";
          const aLine = block.match(/^A:\s*([\s\S]+)/m)?.[1]?.trim() ?? "";
          return qLine ? { question: qLine, answer: aLine } : null;
        }).filter(Boolean);
        payload = { faqs: parsedFaqs, key_policies: form.key_policies, special_instructions: form.special_instructions };
      } else if (stepNum === 5) {
        const escalation = form.escalation_contacts_raw.split("\n").map((line: string) => {
          const parts = line.split("|").map((s: string) => s.trim());
          return parts.length >= 4 ? { name: parts[0], role: parts[1], phone: parts[2], trigger: parts[3] } : null;
        }).filter(Boolean);
        payload = {
          calendar_system: form.calendar_system, crm_system: form.crm_system,
          phone_system: form.phone_system, existing_number: form.existing_number,
          can_forward_calls: form.can_forward_calls, escalation_contacts: escalation,
        };
      }
      await saveOnboardingStep(clientId, stepNum, payload);
      qc.invalidateQueries({ queryKey: ["onboarding", clientId] });
      toast.success(`Step ${stepNum} saved`);
      if (stepNum < 5) setStep(stepNum + 1);
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const submit = useMutation({
    mutationFn: () => submitOnboarding(clientId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["onboarding", clientId] }); toast.success("Submitted for approval"); },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? "Submit failed"),
  });

  const approve = useMutation({
    mutationFn: () => approveOnboarding(clientId, reviewerNotes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding", clientId] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Onboarding approved — Jojo config generation started");
    },
  });

  const isEditable = ["draft", "in_progress"].includes(onboarding.status);
  const isPending = onboarding.status === "pending_approval";
  const isApproved = onboarding.status === "approved";

  const STEPS = ["Business Profile", "Business Hours", "Services & Calls", "FAQs & Knowledge", "Integrations"];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      {isEditable && (
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <button key={label} onClick={() => setStep(i + 1)} className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                step === i + 1 ? "bg-brand-600 text-white" : i + 1 < step ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-400"
              )}>{i + 1}</div>
              <span className={cn("text-xs hidden md:block", step === i + 1 ? "text-brand-700 font-medium" : "text-gray-400")}>{label}</span>
              {i < 4 && <div className="w-8 h-px bg-gray-200" />}
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — Business Profile */}
      {isEditable && step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 1: Business Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Business Name *</label>
              <input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} className={INPUT} /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">ABN</label>
              <input value={form.abn} onChange={(e) => update("abn", e.target.value)} className={INPUT} placeholder="XX XXX XXX XXX" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Business Phone *</label>
              <input value={form.business_phone} onChange={(e) => update("business_phone", e.target.value)} className={INPUT} /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Business Email</label>
              <input value={form.business_email} onChange={(e) => update("business_email", e.target.value)} className={INPUT} /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Website</label>
              <input value={form.website} onChange={(e) => update("website", e.target.value)} className={INPUT} placeholder="https://" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Number of Staff</label>
              <select value={form.staff_count} onChange={(e) => update("staff_count", e.target.value)} className={SELECT}>
                <option value="">Select</option><option>1-5</option><option>6-20</option><option>21-50</option><option>50+</option>
              </select></div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Business Address</label>
            <textarea value={form.business_address} onChange={(e) => update("business_address", e.target.value)} rows={2} className={TEXTAREA} /></div>
          <button onClick={() => saveStep(1)} disabled={saving} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save & Continue →"}
          </button>
        </div>
      )}

      {/* Step 2 — Business Hours */}
      {isEditable && step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 2: Business Hours & Availability</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Timezone</label>
              <select value={form.timezone} onChange={(e) => update("timezone", e.target.value)} className={SELECT}>
                <option>Australia/Sydney</option><option>Australia/Melbourne</option>
                <option>Australia/Brisbane</option><option>Australia/Perth</option>
                <option>Australia/Adelaide</option><option>New_Zealand/Auckland</option>
              </select></div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Operating Hours</p>
            {DAYS.map((day) => {
              const h = (form.business_hours as Record<string, { is_open: boolean; open: string; close: string }>)[day] ?? { is_open: false, open: "09:00", close: "17:00" };
              return (
                <div key={day} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <input type="checkbox" checked={h.is_open} onChange={(e) => update("business_hours", { ...form.business_hours, [day]: { ...h, is_open: e.target.checked } })} className="accent-brand-600" />
                  <span className="text-sm font-medium text-gray-700 w-24 capitalize">{day}</span>
                  {h.is_open ? (
                    <>
                      <input type="time" value={h.open} onChange={(e) => update("business_hours", { ...form.business_hours, [day]: { ...h, open: e.target.value } })} className="px-2 py-1 text-sm border border-gray-200 rounded-lg" />
                      <span className="text-gray-400 text-sm">to</span>
                      <input type="time" value={h.close} onChange={(e) => update("business_hours", { ...form.business_hours, [day]: { ...h, close: e.target.value } })} className="px-2 py-1 text-sm border border-gray-200 rounded-lg" />
                    </>
                  ) : <span className="text-xs text-gray-400 italic">Closed</span>}
                </div>
              );
            })}
          </div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Public Holiday Handling</label>
            <textarea value={form.public_holiday_handling} onChange={(e) => update("public_holiday_handling", e.target.value)} rows={2} className={TEXTAREA} placeholder="e.g. Treat as closed, play after-hours message" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Emergency / Urgent Call Policy</label>
            <textarea value={form.emergency_policy} onChange={(e) => update("emergency_policy", e.target.value)} rows={2} className={TEXTAREA} placeholder="e.g. For medical emergencies, direct callers to 000" /></div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => saveStep(2)} disabled={saving} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save & Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Services */}
      {isEditable && step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 3: Services & Call Handling</h2>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Primary Services (one per line)</label>
            <textarea value={form.primary_services} onChange={(e) => update("primary_services", e.target.value)} rows={5} className={TEXTAREA} placeholder={"General dental consultations\nTeeth cleaning\nEmergency dental appointments\nOrthodontics"} /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Types of Calls Jojo Will Handle (one per line)</label>
            <textarea value={form.call_types} onChange={(e) => update("call_types", e.target.value)} rows={4} className={TEXTAREA} placeholder={"New patient bookings\nAppointment reschedules\nGeneral enquiries\nPayment questions"} /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Topics Jojo Should NOT Handle (escalate instead)</label>
            <textarea value={form.excluded_topics} onChange={(e) => update("excluded_topics", e.target.value)} rows={2} className={TEXTAREA} placeholder="e.g. Complex medical advice, insurance disputes, legal complaints" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Greeting Style</label>
            <select value={form.greeting_style} onChange={(e) => update("greeting_style", e.target.value)} className={SELECT}>
              <option value="professional">Professional — formal and efficient</option>
              <option value="friendly">Friendly — warm and conversational</option>
              <option value="formal">Formal — strictly business</option>
            </select></div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => saveStep(3)} disabled={saving} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save & Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — FAQs */}
      {isEditable && step === 4 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 4: FAQs & Knowledge Base</h2>
          <p className="text-xs text-gray-500">Format each FAQ as: Q: [question] on one line, A: [answer] on the next. Separate FAQs with a blank line.</p>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Frequently Asked Questions (up to 20)</label>
            <textarea value={form.faqs} onChange={(e) => update("faqs", e.target.value)} rows={10} className={TEXTAREA}
              placeholder={"Q: What are your opening hours?\nA: We are open Monday to Friday 9am–5pm.\n\nQ: Where are you located?\nA: We are located at 123 Main Street, Sydney NSW 2000."} /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Key Policies (cancellation, payment, parking etc.)</label>
            <textarea value={form.key_policies} onChange={(e) => update("key_policies", e.target.value)} rows={3} className={TEXTAREA} placeholder="e.g. 24-hour cancellation notice required. Parking available on-site." /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Special Instructions for Jojo</label>
            <textarea value={form.special_instructions} onChange={(e) => update("special_instructions", e.target.value)} rows={2} className={TEXTAREA} placeholder="e.g. Always ask for a callback number. Never quote prices over the phone." /></div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => saveStep(4)} disabled={saving} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save & Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — Integrations */}
      {isEditable && step === 5 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 5: Integrations & Technical Setup</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Calendar System</label>
              <select value={form.calendar_system} onChange={(e) => update("calendar_system", e.target.value)} className={SELECT}>
                <option value="">None / Not sure</option>
                <option>Google Calendar</option><option>Microsoft Outlook / Exchange</option>
                <option>Industry-specific software</option><option>Paper diary / no system</option>
              </select></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">CRM System</label>
              <select value={form.crm_system} onChange={(e) => update("crm_system", e.target.value)} className={SELECT}>
                <option value="">No CRM currently</option>
                <option>Yes — HubSpot, Salesforce, or similar</option>
                <option>Yes — industry-specific CRM</option>
              </select></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Phone System</label>
              <select value={form.phone_system} onChange={(e) => update("phone_system", e.target.value)} className={SELECT}>
                <option value="">Not sure</option>
                <option>VoIP (RingCentral, 3CX, Teams)</option>
                <option>Business landline (PSTN)</option><option>Mobile only</option>
              </select></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Existing Business Number</label>
              <input value={form.existing_number} onChange={(e) => update("existing_number", e.target.value)} className={INPUT} placeholder="+61 2 9000 0000" /></div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" checked={form.can_forward_calls} onChange={(e) => update("can_forward_calls", e.target.checked)} className="accent-brand-600" id="forward" />
            <label htmlFor="forward" className="text-sm text-gray-700">Client can set up call forwarding to the Jojo number</label>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Escalation Contacts</label>
            <p className="text-xs text-gray-400 mb-2">One per line: Name | Role | Phone | When to escalate</p>
            <textarea value={form.escalation_contacts_raw} onChange={(e) => update("escalation_contacts_raw", e.target.value)} rows={4} className={TEXTAREA}
              placeholder={"Jane Smith | Practice Manager | +61400000000 | Complaints\nDr John Lee | Principal | +61411111111 | Medical escalations"} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">← Back</button>
            <button onClick={() => saveStep(5)} disabled={saving} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      )}

      {/* Read-only summary when not editable */}
      {!isEditable && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Onboarding Data</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Business</p><p className="font-medium">{onboarding.business_name}</p></div>
            <div><p className="text-gray-500">Phone</p><p className="font-medium">{onboarding.business_phone}</p></div>
            <div><p className="text-gray-500">Calendar</p><p className="font-medium">{onboarding.calendar_system || "—"}</p></div>
            <div><p className="text-gray-500">CRM</p><p className="font-medium">{onboarding.crm_system || "—"}</p></div>
            <div><p className="text-gray-500">Services</p><p className="font-medium">{(onboarding.primary_services ?? []).join(", ") || "—"}</p></div>
            <div><p className="text-gray-500">FAQs loaded</p><p className="font-medium">{(onboarding.faqs ?? []).length}</p></div>
            <div><p className="text-gray-500">Timezone</p><p className="font-medium">{onboarding.timezone}</p></div>
            <div><p className="text-gray-500">Greeting style</p><p className="font-medium capitalize">{onboarding.greeting_style}</p></div>
          </div>
        </div>
      )}

      {/* Submit button */}
      {onboarding.status === "in_progress" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Ready to submit for approval?</p>
            <p className="text-sm text-gray-500">Business name and phone are required.</p>
          </div>
          <button onClick={() => submit.mutate()} disabled={submit.isPending}
            className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {submit.isPending ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      )}

      {/* Gate 4 — Onboarding Approval */}
      {isPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-yellow-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Gate 4 — Onboarding Approval
          </h2>
          <p className="text-sm text-yellow-800">Review the onboarding data above. Approve to automatically generate the Jojo configuration.</p>
          <textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} rows={2}
            placeholder="Reviewer notes (optional)..."
            className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
          <button onClick={() => approve.mutate()} disabled={approve.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
            <CheckCircle className="w-4 h-4" />
            {approve.isPending ? "Approving..." : "Approve & Generate Jojo Config"}
          </button>
        </div>
      )}

      {isApproved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-medium text-green-900">Onboarding Approved</p>
            <p className="text-sm text-green-700">Jojo configuration has been generated. Switch to the Configuration tab.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── JOJO CONFIG VIEW ──────────────────────────────────────────────────────

function ConfigView({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [jojoPhone, setJojoPhone] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["jojo-config", clientId],
    queryFn: () => getJojoConfig(clientId).catch((e) => {
      if (e?.response?.status === 404) return null;
      throw e;
    }),
    refetchInterval: (q) => q.state.data?.status === "generating" ? 3000 : false,
  });

  const approve = useMutation({
    mutationFn: () => approveJojoConfig(clientId, config!.id, { reviewer_notes: reviewerNotes, jojo_phone_number: jojoPhone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jojo-config", clientId] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success("Config approved — Implementation tasks generated");
    },
  });

  const regenerate = useMutation({
    mutationFn: () => regenerateJojoConfig(clientId),
    onSuccess: () => {
      toast.success("Config generation started — page will update automatically");
      qc.invalidateQueries({ queryKey: ["jojo-config", clientId] });
    },
    onError: () => toast.error("Failed to start config generation"),
  });

  if (isLoading) return <div className="text-center p-8 text-gray-400">Loading configuration...</div>;
  if (!config) return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center space-y-3">
      <p className="text-gray-500 text-sm">No configuration found. The auto-generation may have failed.</p>
      <button
        onClick={() => regenerate.mutate()}
        disabled={regenerate.isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50"
      >
        <RefreshCw className={cn("w-4 h-4", regenerate.isPending && "animate-spin")} />
        {regenerate.isPending ? "Starting..." : "Generate Config"}
      </button>
    </div>
  );

  if (config.status === "generating") return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-3" />
      <p className="text-sm text-gray-600">AI is generating the Jojo configuration...</p>
      <p className="text-xs text-gray-400 mt-1">This takes about 30 seconds. Page refreshes automatically.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Zap className="w-4 h-4 text-brand-600" /> Jojo Configuration v{config.version}</h2>
          {config.config_summary && <p className="text-sm text-gray-500 mt-1">{config.config_summary}</p>}
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-medium", STATUS_COLORS[config.status])}>
          {config.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Scripts */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">WhatsApp Scripts</h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Missed Call WhatsApp Message</p>
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm text-brand-900 italic">&ldquo;{config.missed_call_message}&rdquo;</div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">After Hours</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 italic">&ldquo;{config.after_hours_message}&rdquo;</div>
          </div>
        </div>
      </div>

      {/* Booking rules */}
      {config.booking_rules && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Booking Rules</h3>
          <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto">{JSON.stringify(config.booking_rules, null, 2)}</pre>
        </div>
      )}

      {/* Escalation rules */}
      {config.escalation_rules && Array.isArray(config.escalation_rules) && config.escalation_rules.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Escalation Rules</h3>
          <div className="space-y-2">
            {(config.escalation_rules as Record<string, string>[]).map((rule, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm">
                <span className="font-semibold text-orange-700 capitalize">{rule.trigger?.replace(/_/g, " ")}</span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-700">{rule.message}</span>
                {rule.contact && <span className="ml-auto text-xs text-gray-400">{rule.contact}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge base editor */}
      <KnowledgeBaseEditor config={config} clientId={clientId} />

      {/* Gate 5 — Config Approval */}
      {config.status === "pending_review" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-yellow-900 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Gate 5 — Configuration Approval</h2>
          <p className="text-sm text-yellow-800">Review all scripts, booking rules, and escalation logic. Assign a Jojo phone number and approve to generate the implementation task list.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Jojo Phone Number (to assign)</label>
              <input value={jojoPhone} onChange={(e) => setJojoPhone(e.target.value)} className={INPUT} placeholder="+61 2 9XXX XXXX" />
            </div>
          </div>
          <textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} rows={2}
            placeholder="Reviewer notes (optional)..."
            className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
          <button onClick={() => approve.mutate()} disabled={approve.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
            <CheckCircle className="w-4 h-4" />
            {approve.isPending ? "Approving..." : "Approve & Generate Implementation Tasks"}
          </button>
        </div>
      )}

      {config.status === "approved" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-medium text-green-900">Configuration Approved</p>
            <p className="text-sm text-green-700">Implementation tasks have been generated. Switch to the Implementation tab.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IMPLEMENTATION BOARD ──────────────────────────────────────────────────

const CATEGORY_ORDER: string[] = ["setup", "integration", "configuration", "testing", "training", "sign_off"];
const CATEGORY_LABELS: Record<string, string> = {
  setup: "Setup", integration: "Integration", configuration: "Configuration",
  testing: "Testing", training: "Training", sign_off: "Sign-Off",
};

function TaskRow({ task, clientId }: { task: ImplementationTask; clientId: string }) {
  const qc = useQueryClient();
  const cycle = useMutation({
    mutationFn: (status: string) => updateTask(clientId, task.id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implementation", clientId] }),
  });

  const nextStatus: Record<string, string> = {
    pending: "in_progress", in_progress: "completed", completed: "pending", blocked: "in_progress",
  };

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-all",
      task.status === "completed" ? "border-green-200 bg-green-50" :
      task.status === "in_progress" ? "border-blue-200 bg-blue-50" :
      task.status === "blocked" ? "border-red-200 bg-red-50" :
      "border-gray-200 bg-white hover:border-gray-300"
    )}>
      <button
        onClick={() => cycle.mutate(nextStatus[task.status] ?? "pending")}
        className="mt-0.5 shrink-0"
        title={`Mark as ${nextStatus[task.status]}`}
      >
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
          task.status === "completed" ? "border-green-500 bg-green-500" :
          task.status === "in_progress" ? "border-blue-500 bg-blue-100" :
          task.status === "blocked" ? "border-red-400 bg-red-100" :
          "border-gray-300 hover:border-brand-400"
        )}>
          {task.status === "completed" && <span className="text-white text-xs">✓</span>}
          {task.status === "in_progress" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
          {task.status === "blocked" && <span className="text-red-500 text-xs">!</span>}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", task.status === "completed" ? "line-through text-gray-400" : "text-gray-900")}>
          {task.title}
        </p>
        {task.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>}
        {task.due_date && <p className="text-xs text-gray-400 mt-0.5">Due: {formatDate(task.due_date)}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn("px-2 py-0.5 rounded text-xs font-medium", TASK_PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

function GoLiveGate({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    actual_go_live: new Date().toISOString().split("T")[0],
    jojo_number_confirmed: "",
    call_forwarding_verified: false,
    test_call_completed: false,
    client_signed_off: false,
    notes: "",
  });

  const confirm = useMutation({
    mutationFn: () => confirmGoLive(clientId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["cs-health", clientId] });
      toast.success("Go-Live confirmed! Client is now Active.");
    },
    onError: () => toast.error("Go-live confirmation failed"),
  });

  const update = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 space-y-4">
      <h2 className="font-bold text-green-900 flex items-center gap-2 text-lg">
        <CheckCircle className="w-5 h-5" /> Gate 6 — Go-Live Confirmation
      </h2>
      <p className="text-sm text-green-800">All implementation tasks complete. Complete the final go-live checklist to activate this client.</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Actual Go-Live Date</label>
          <input type="date" value={form.actual_go_live} onChange={(e) => update("actual_go_live", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Jojo Phone Number (live)</label>
          <input value={form.jojo_number_confirmed} onChange={(e) => update("jojo_number_confirmed", e.target.value)}
            placeholder="+61 2 9XXX XXXX"
            className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
        </div>
      </div>

      <div className="space-y-2">
        {[
          { key: "call_forwarding_verified", label: "Call forwarding verified — calls routing to Jojo" },
          { key: "test_call_completed", label: "Test call completed successfully" },
          { key: "client_signed_off", label: "Client signed off on go-live" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200 cursor-pointer">
            <input type="checkbox" checked={(form as unknown as Record<string, boolean>)[key]}
              onChange={(e) => update(key, e.target.checked)} className="accent-green-600" />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
        <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2}
          placeholder="Any notes about the go-live..."
          className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-white resize-none" />
      </div>

      <button onClick={() => confirm.mutate()} disabled={confirm.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
        <CheckCircle className="w-5 h-5" />
        {confirm.isPending ? "Confirming..." : "Confirm Go-Live & Activate Client"}
      </button>
    </div>
  );
}

function ImplementationBoard({ clientId, clientStatus }: { clientId: string; clientStatus: string }) {
  const { data: project, isLoading } = useQuery({
    queryKey: ["implementation", clientId],
    queryFn: () => getImplementation(clientId),
    refetchInterval: clientStatus === "go_live" ? 10000 : false,
  });

  if (isLoading) return <div className="text-center p-8 text-gray-400">Loading implementation plan...</div>;
  if (!project) return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-500">
      Implementation plan not available yet. Approve the Jojo configuration first.
    </div>
  );

  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.status === "completed" || t.status === "skipped").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  const byCategory = CATEGORY_ORDER.reduce<Record<string, ImplementationTask[]>>((acc, cat) => {
    acc[cat] = project.tasks.filter((t) => t.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Implementation Progress</h2>
            <p className="text-sm text-gray-500">{done} of {total} tasks complete · Target go-live: {formatDate(project.target_go_live)}</p>
          </div>
          <span className="text-3xl font-bold text-brand-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="bg-brand-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>Started</span>
          <span className={cn("px-2 py-0.5 rounded font-medium", STATUS_COLORS[project.status])}>
            {project.status.replace(/_/g, " ")}
          </span>
          <span>Go Live</span>
        </div>
      </div>

      {/* Gate 6 — Go-Live (when all tasks done + client status is go_live) */}
      {allDone && clientStatus === "go_live" && <GoLiveGate clientId={clientId} />}

      {/* Active confirmation */}
      {clientStatus === "active" && project.actual_go_live && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Client is Live!</p>
            <p className="text-sm text-emerald-700">Go-live confirmed on {formatDate(project.actual_go_live)}. Switch to the Customer Success tab.</p>
          </div>
        </div>
      )}

      {/* Task groups by category */}
      {CATEGORY_ORDER.map((cat) => {
        const tasks = byCategory[cat] ?? [];
        if (tasks.length === 0) return null;
        const catDone = tasks.filter((t) => t.status === "completed" || t.status === "skipped").length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
              <h3 className="font-semibold text-gray-800">{CATEGORY_LABELS[cat]}</h3>
              <span className="text-xs text-gray-400">{catDone}/{tasks.length}</span>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => <TaskRow key={task.id} task={task} clientId={clientId} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CUSTOMER SUCCESS TAB ─────────────────────────────────────────────────

const CHECKIN_TYPES = ["ad_hoc", "health_check", "qbr", "onboarding_call", "renewal_discussion"];

function CustomerSuccessTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [showNpsForm, setShowNpsForm] = useState(false);
  const [showManualHealth, setShowManualHealth] = useState(false);

  const [checkinForm, setCheckinForm] = useState({ checkin_type: "health_check", summary: "", outcome: "positive", next_checkin_date: "" });
  const [npsForm, setNpsForm] = useState({ score: 8, verbatim: "", survey_period: "" });
  const [healthForm, setHealthForm] = useState({ usage_score: 20, support_score: 20, engagement_score: 20, roi_score: 20, notes: "" });

  const { data: healthScores = [], isLoading: healthLoading } = useQuery({
    queryKey: ["cs-health", clientId],
    queryFn: () => getHealthScores(clientId),
    refetchInterval: 30000,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins", clientId],
    queryFn: () => getCheckins(clientId),
  });

  const { data: npsResponses = [] } = useQuery({
    queryKey: ["nps", clientId],
    queryFn: () => getNpsResponses(clientId),
  });

  const refreshHealth = useMutation({
    mutationFn: () => triggerHealthScore(clientId),
    onSuccess: () => { toast.success("Health score recalculation started"); setTimeout(() => qc.invalidateQueries({ queryKey: ["cs-health", clientId] }), 5000); },
  });

  const saveHealth = useMutation({
    mutationFn: () => saveManualHealth(clientId, healthForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cs-health", clientId] }); setShowManualHealth(false); toast.success("Health score saved"); },
  });

  const logCheckin = useMutation({
    mutationFn: () => createCheckin(clientId, { ...checkinForm, next_checkin_date: checkinForm.next_checkin_date || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checkins", clientId] }); setShowCheckinForm(false); toast.success("Check-in logged"); },
  });

  const addNps = useMutation({
    mutationFn: () => addNpsResponse(clientId, npsForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["nps", clientId] }); setShowNpsForm(false); toast.success("NPS response recorded"); },
  });

  const latest = healthScores[0];
  const INPUT = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white";

  return (
    <div className="space-y-6">
      {/* Health score card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-brand-600" /> Health Score
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowManualHealth(!showManualHealth)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Plus className="w-3 h-3" /> Manual
            </button>
            <button onClick={() => refreshHealth.mutate()} disabled={refreshHealth.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 disabled:opacity-50">
              <RefreshCw className={cn("w-3 h-3", refreshHealth.isPending && "animate-spin")} /> Recalculate
            </button>
          </div>
        </div>

        {healthLoading ? (
          <div className="text-center text-gray-400 py-4">Loading...</div>
        ) : latest ? (
          <>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className={cn("text-5xl font-bold", healthScoreColor(latest.health_score))}>{latest.health_score ?? "—"}</p>
                <p className="text-xs text-gray-400 mt-1">/ 100</p>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: "Usage", val: latest.usage_score },
                  { label: "Support", val: latest.support_score },
                  { label: "Engagement", val: latest.engagement_score },
                  { label: "ROI / Value", val: latest.roi_score },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${((val ?? 0) / 25) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-6 text-right">{val ?? 0}</span>
                    <span className="text-xs text-gray-400">/25</span>
                  </div>
                ))}
              </div>
              <span className={cn("px-3 py-1 rounded-full text-sm font-semibold self-start", HEALTH_RISK_COLORS[latest.risk_level])}>
                {latest.risk_level.replace("_", " ")}
              </span>
            </div>
            {latest.ai_summary && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{latest.ai_summary}</p>}
            {latest.ai_recommendations && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 mb-1">Recommended Actions</p>
                <p className="text-sm text-blue-800">{latest.ai_recommendations}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Last calculated {formatRelative(latest.calculated_at)}</p>
          </>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <HeartPulse className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No health score yet.</p>
            <button onClick={() => refreshHealth.mutate()} className="mt-3 text-sm text-brand-600 hover:underline">Calculate now →</button>
          </div>
        )}

        {/* Manual health form */}
        {showManualHealth && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-sm font-medium text-gray-700">Enter scores manually (0–25 each)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: "usage_score", label: "Usage / Adoption" },
                { k: "support_score", label: "Support Sentiment" },
                { k: "engagement_score", label: "Engagement" },
                { k: "roi_score", label: "ROI / Value" },
              ].map(({ k, label }) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                  <input type="number" min={0} max={25}
                    value={(healthForm as unknown as Record<string, number>)[k]}
                    onChange={(e) => setHealthForm((p) => ({ ...p, [k]: Number(e.target.value) }))}
                    className={INPUT} />
                </div>
              ))}
            </div>
            <input value={healthForm.notes} onChange={(e) => setHealthForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)" className={INPUT} />
            <div className="flex gap-2">
              <button onClick={() => saveHealth.mutate()} disabled={saveHealth.isPending}
                className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {saveHealth.isPending ? "Saving..." : "Save Score"}
              </button>
              <button onClick={() => setShowManualHealth(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Check-ins */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Check-ins</h2>
          <button onClick={() => setShowCheckinForm(!showCheckinForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
            <Plus className="w-3 h-3" /> Log Check-in
          </button>
        </div>

        {showCheckinForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type</label>
                <select value={checkinForm.checkin_type} onChange={(e) => setCheckinForm((p) => ({ ...p, checkin_type: e.target.value }))}
                  className={INPUT}>
                  {CHECKIN_TYPES.map((t) => <option key={t} value={t}>{CHECKIN_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Outcome</label>
                <select value={checkinForm.outcome} onChange={(e) => setCheckinForm((p) => ({ ...p, outcome: e.target.value }))}
                  className={INPUT}>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
            </div>
            <textarea value={checkinForm.summary} onChange={(e) => setCheckinForm((p) => ({ ...p, summary: e.target.value }))}
              placeholder="Summary of the check-in..." rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none" />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Next Check-in Date (optional)</label>
              <input type="date" value={checkinForm.next_checkin_date} onChange={(e) => setCheckinForm((p) => ({ ...p, next_checkin_date: e.target.value }))} className={INPUT} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => logCheckin.mutate()} disabled={logCheckin.isPending}
                className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {logCheckin.isPending ? "Saving..." : "Log Check-in"}
              </button>
              <button onClick={() => setShowCheckinForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {(checkins as Checkin[]).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No check-ins logged yet.</p>
        ) : (
          <div className="space-y-2">
            {(checkins as Checkin[]).slice(0, 8).map((c: Checkin) => (
              <div key={c.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                <div className={cn("mt-0.5 px-2 py-0.5 rounded text-xs font-medium shrink-0",
                  c.outcome ? CHECKIN_OUTCOME_COLORS[c.outcome] : "bg-gray-100 text-gray-500")}>
                  {c.outcome ?? "scheduled"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{CHECKIN_TYPE_LABELS[c.checkin_type]}</p>
                  {c.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.summary}</p>}
                  {c.next_checkin_date && <p className="text-xs text-brand-600 mt-1">Next: {formatDate(c.next_checkin_date)}</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">{formatRelative(c.completed_at ?? c.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NPS */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">NPS Responses</h2>
          <button onClick={() => setShowNpsForm(!showNpsForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
            <Plus className="w-3 h-3" /> Record NPS
          </button>
        </div>

        {showNpsForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Score (0–10)</label>
                <input type="number" min={0} max={10} value={npsForm.score}
                  onChange={(e) => setNpsForm((p) => ({ ...p, score: Number(e.target.value) }))} className={INPUT} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Survey Period (e.g. Q2 2026)</label>
                <input value={npsForm.survey_period} onChange={(e) => setNpsForm((p) => ({ ...p, survey_period: e.target.value }))}
                  placeholder="Q2 2026" className={INPUT} />
              </div>
            </div>
            <textarea value={npsForm.verbatim} onChange={(e) => setNpsForm((p) => ({ ...p, verbatim: e.target.value }))}
              placeholder="Verbatim feedback (optional)..." rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none" />
            <div className="flex gap-2">
              <button onClick={() => addNps.mutate()} disabled={addNps.isPending}
                className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {addNps.isPending ? "Saving..." : "Record NPS"}
              </button>
              <button onClick={() => setShowNpsForm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {(npsResponses as NpsResponse[]).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No NPS responses yet.</p>
        ) : (
          <div className="space-y-2">
            {(npsResponses as NpsResponse[]).map((n: NpsResponse) => (
              <div key={n.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0",
                  n.category === "promoter" ? "bg-emerald-100 text-emerald-700" :
                  n.category === "passive" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                )}>{n.score}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", NPS_CATEGORY_COLORS[n.category])}>
                      {n.category}
                    </span>
                    {n.survey_period && <span className="text-xs text-gray-400">{n.survey_period}</span>}
                  </div>
                  {n.verbatim && <p className="text-xs text-gray-500 mt-1 line-clamp-2">&ldquo;{n.verbatim}&rdquo;</p>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">{formatDate(n.submitted_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClient(id),
    refetchInterval: 10000,
  });

  const { data: onboarding } = useQuery({
    queryKey: ["onboarding", id],
    queryFn: () => getOnboarding(id),
    enabled: tab === "Onboarding" || tab === "Overview",
    retry: false,
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-gray-200 rounded" /></div>;
  if (!client) return <div className="text-gray-500">Client not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
            <p className="text-sm text-gray-500">{client.industry} · Client since {formatDate(client.created_at)}</p>
          </div>
        </div>
        <span className={cn("px-3 py-1.5 rounded-full text-sm font-semibold", CLIENT_STATUS_COLORS[client.status])}>
          {CLIENT_STATUS_LABELS[client.status]}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}>{t}</button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Onboarding", status: onboarding?.status ?? "—", done: onboarding?.status === "approved" },
              { label: "Jojo Config", status: "—", done: ["implementation", "go_live", "active"].includes(client.status) },
              { label: "Implementation", status: client.status === "go_live" || client.status === "active" ? "complete" : "pending", done: client.status === "active" },
            ].map(({ label, status, done }) => (
              <div key={label} className={cn("rounded-xl border p-4", done ? "border-green-200 bg-green-50" : "border-gray-200 bg-white")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  {done ? <CheckCircle className="w-4 h-4 text-green-500" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                </div>
                <p className="text-xs text-gray-400 mt-1 capitalize">{status.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Journey Status</h2>
            <div className="flex items-center gap-3">
              {["Onboarding", "Implementation", "Go Live", "Active"].map((stage, i) => {
                const steps = ["onboarding", "implementation", "go_live", "active"];
                const current = steps.indexOf(client.status);
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="text-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto",
                        i < current ? "bg-brand-600 text-white" :
                        i === current ? "bg-brand-100 text-brand-700 ring-2 ring-brand-400" :
                        "bg-gray-100 text-gray-400"
                      )}>{i < current ? "✓" : i + 1}</div>
                      <p className="text-xs text-gray-500 mt-1">{stage}</p>
                    </div>
                    {i < 3 && <div className={cn("flex-1 h-px w-12", i < current ? "bg-brand-400" : "bg-gray-200")} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {tab === "Onboarding" && onboarding && <OnboardingWizard clientId={id} onboarding={onboarding} />}
      {tab === "Onboarding" && !onboarding && (
        <div className="p-8 text-center text-gray-400">Loading onboarding data...</div>
      )}

      {/* Configuration */}
      {tab === "Configuration" && <ConfigView clientId={id} />}

      {/* Implementation */}
      {tab === "Implementation" && <ImplementationBoard clientId={id} clientStatus={client.status} />}

      {/* Customer Success */}
      {tab === "Customer Success" && <CustomerSuccessTab clientId={id} />}

      {/* Renewals */}
      {tab === "Renewals" && <RenewalsTab clientId={id} />}
    </div>
  );
}
