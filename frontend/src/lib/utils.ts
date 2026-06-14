import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelative(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  engaged: "bg-purple-100 text-purple-700",
  qualified: "bg-green-100 text-green-700",
  disqualified: "bg-red-100 text-red-700",
  converted: "bg-emerald-100 text-emerald-700",
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  ai_scored: "bg-purple-100 text-purple-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  changes_requested: "bg-orange-100 text-orange-700",
  flagged: "bg-red-100 text-red-700",
  generating: "bg-gray-100 text-gray-500",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-blue-100 text-blue-700",
  implementation: "bg-purple-100 text-purple-700",
  go_live: "bg-orange-100 text-orange-700",
  active: "bg-emerald-100 text-emerald-700",
  churned: "bg-gray-100 text-gray-500",
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export const CATEGORY_ICONS: Record<string, string> = {
  setup: "⚙️",
  integration: "🔗",
  configuration: "🔧",
  testing: "🧪",
  training: "🎓",
  sign_off: "✅",
};

export const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function scoreColor(score?: number | null): string {
  if (score == null) return "text-gray-400";
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

export const HEALTH_RISK_COLORS: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-700",
  at_risk: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
};

export const HEALTH_RISK_DOT: Record<string, string> = {
  healthy: "bg-emerald-500",
  at_risk: "bg-yellow-500",
  critical: "bg-red-500",
};

export const NPS_CATEGORY_COLORS: Record<string, string> = {
  promoter: "bg-emerald-100 text-emerald-700",
  passive: "bg-blue-100 text-blue-700",
  detractor: "bg-red-100 text-red-700",
};

export const CHECKIN_OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-gray-100 text-gray-600",
  negative: "bg-orange-100 text-orange-700",
  escalated: "bg-red-100 text-red-700",
};

export const CHECKIN_TYPE_LABELS: Record<string, string> = {
  onboarding_call: "Onboarding Call",
  qbr: "QBR",
  health_check: "Health Check",
  renewal_discussion: "Renewal",
  ad_hoc: "Ad Hoc",
};

export function healthScoreColor(score?: number | null): string {
  if (score == null) return "text-gray-400";
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}
