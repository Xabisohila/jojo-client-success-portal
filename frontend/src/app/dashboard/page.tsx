"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary, getRecentActivity, getCSDashboard, getRenewalDashboard } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import { Users, ClipboardList, FileText, TrendingUp, Clock, AlertCircle, HeartPulse, DollarSign, Rocket, ShieldAlert } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      <Link href={href} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: getRecentActivity,
  });

  const { data: cs } = useQuery({
    queryKey: ["cs-dashboard"],
    queryFn: getCSDashboard,
  });

  const { data: renewals } = useQuery({
    queryKey: ["renewal-dashboard"],
    queryFn: getRenewalDashboard,
  });

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}</div></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Full pipeline overview and pending actions</p>
      </div>

      {/* Alerts — pending approvals */}
      {((summary?.assessments_pending_approval ?? 0) + (summary?.proposals_pending_approval ?? 0)) > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Action required</p>
            <p className="text-yellow-700 text-sm mt-0.5">
              {summary?.assessments_pending_approval ?? 0} assessment(s) and{" "}
              {summary?.proposals_pending_approval ?? 0} proposal(s) awaiting your approval.
            </p>
          </div>
        </div>
      )}

      {/* Lead pipeline stats */}
      <div>
        <SectionHeader title="Lead Pipeline" href="/leads" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Leads" value={summary?.leads_total ?? 0} icon={Users} color="bg-gray-500" />
          <StatCard label="New Leads" value={summary?.leads_new ?? 0} icon={Users} color="bg-blue-500" />
          <StatCard label="Qualified" value={summary?.leads_qualified ?? 0} icon={TrendingUp} color="bg-green-500" />
          <StatCard label="Converted" value={summary?.leads_converted ?? 0} icon={TrendingUp} color="bg-emerald-600" />
        </div>
      </div>

      {/* Approval gates */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval Gates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Assessments Pending" value={summary?.assessments_pending_approval ?? 0} icon={ClipboardList} color="bg-yellow-500" />
          <StatCard label="Proposals Pending" value={summary?.proposals_pending_approval ?? 0} icon={FileText} color="bg-orange-500" />
          <StatCard label="Proposals Sent" value={summary?.proposals_sent ?? 0} icon={FileText} color="bg-purple-500" />
          <StatCard label="Proposals Accepted" value={summary?.proposals_accepted ?? 0} icon={FileText} color="bg-emerald-500" />
        </div>
      </div>

      {/* Client pipeline (onboarding → implementation → go-live → active) */}
      <div>
        <SectionHeader title="Client Pipeline" href="/clients" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Onboarding" value={summary?.clients_onboarding ?? 0} icon={ClipboardList} color="bg-blue-500" />
          <StatCard label="Implementation" value={summary?.clients_implementation ?? 0} icon={Rocket} color="bg-purple-500" />
          <StatCard label="Go-Live" value={summary?.clients_go_live ?? 0} icon={Rocket} color="bg-orange-500" />
          <StatCard label="Active" value={summary?.clients_active ?? 0} icon={TrendingUp} color="bg-emerald-600" />
        </div>
      </div>

      {/* Customer health */}
      <div>
        <SectionHeader title="Customer Health" href="/customer-success" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Healthy" value={cs?.healthy ?? 0} icon={HeartPulse} color="bg-emerald-600" />
          <StatCard label="At Risk" value={cs?.at_risk ?? 0} icon={ShieldAlert} color="bg-yellow-500" />
          <StatCard label="Critical" value={cs?.critical ?? 0} icon={ShieldAlert} color="bg-red-500" />
          <StatCard label="Avg Health Score" value={cs?.avg_health_score ?? "—"} icon={HeartPulse} color="bg-gray-500" />
        </div>
      </div>

      {/* Renewals & revenue */}
      <div>
        <SectionHeader title="Renewals & Revenue" href="/renewals" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total MRR" value={`$${(renewals?.total_mrr ?? 0).toLocaleString()}`} icon={DollarSign} color="bg-emerald-600" />
          <StatCard label="MRR at Risk" value={`$${(renewals?.mrr_at_risk ?? 0).toLocaleString()}`} icon={AlertCircle} color="bg-red-500" />
          <StatCard label="Urgent Renewals" value={renewals?.urgent ?? 0} icon={Clock} color="bg-orange-500" />
          <StatCard label="Upsell Pipeline" value={`$${(renewals?.upsell_pipeline_value ?? 0).toLocaleString()}`} icon={TrendingUp} color="bg-purple-500" />
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">No recent activity yet.</p>
          ) : (
            activity.slice(0, 10).map((item: { activity_type: string; company_name: string; subject: string; lead_id: string; created_at: string }, i: number) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.company_name}</p>
                  <p className="text-xs text-gray-500 truncate">{item.subject}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatRelative(item.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
