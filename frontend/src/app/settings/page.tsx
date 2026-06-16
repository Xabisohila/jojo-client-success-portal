"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSystemSettings, updateSystemSettings,
  getTeamMembers, addTeamMember, updateTeamMember, deactivateTeamMember,
  getIntegrations,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TeamMember, IntegrationStatus } from "@/types";
import { Users, Settings, Plug, CheckCircle, XCircle, Plus, Shield } from "lucide-react";
import { toast } from "sonner";

type Tab = "team" | "system" | "integrations";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", sales: "Sales", csm: "CSM", implementation: "Implementation",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  sales: "bg-blue-100 text-blue-700",
  csm: "bg-green-100 text-green-700",
  implementation: "bg-purple-100 text-purple-700",
};
const INTEGRATION_COLORS = {
  configured: "text-green-600",
  not_configured: "text-yellow-600",
  not_connected: "text-gray-400",
};

// ── Team Tab ──────────────────────────────────────────────────────────────

function TeamTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", role: "sales", password: "" });
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({ queryKey: ["team"], queryFn: getTeamMembers });

  const add = useMutation({
    mutationFn: () => addTeamMember(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setShowAdd(false);
      setForm({ full_name: "", email: "", role: "sales", password: "" });
      toast.success("Team member added");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to add team member");
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateTeamMember(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateTeamMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setConfirmDeactivateId(null);
      toast.success("Member deactivated");
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => updateTeamMember(id, { is_active: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); toast.success("Member reactivated"); },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => updateTeamMember(id, { password }),
    onSuccess: () => {
      setResettingId(null);
      setNewPassword("");
      toast.success("Password updated");
    },
    onError: () => toast.error("Failed to update password"),
  });

  const SYSTEM_ID = "00000000-0000-0000-0000-000000000001";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage who has access to the Jojo portal</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">New Team Member</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Initial Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave blank to set later"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="sales">Sales</option>
                <option value="csm">CSM</option>
                <option value="implementation">Implementation</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => add.mutate()} disabled={add.isPending || !form.full_name || !form.email}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {add.isPending ? "Adding..." : "Add Member"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(members as TeamMember[]).map((m) => (
                <tr key={m.id} className={cn("hover:bg-gray-50", !m.is_active && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700">
                        {m.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{m.full_name}</span>
                      {m.id === SYSTEM_ID && <Shield className="w-3 h-3 text-gray-400" aria-label="System user" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3">
                    {m.id === SYSTEM_ID ? (
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", ROLE_COLORS[m.role])}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                        className={cn("px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-1 focus:ring-brand-500", ROLE_COLORS[m.role])}
                      >
                        <option value="sales">Sales</option>
                        <option value="csm">CSM</option>
                        <option value="implementation">Implementation</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", m.is_active ? "text-green-600" : "text-gray-400")}>
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.id !== SYSTEM_ID && resettingId === m.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="password"
                          autoFocus
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="w-36 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => resetPassword.mutate({ id: m.id, password: newPassword })}
                          disabled={!newPassword || resetPassword.isPending}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setResettingId(null); setNewPassword(""); }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : m.id !== SYSTEM_ID && confirmDeactivateId === m.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-600">Deactivate this account?</span>
                        <button
                          onClick={() => deactivate.mutate(m.id)}
                          disabled={deactivate.isPending}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
                        >
                          {deactivate.isPending ? "Deactivating..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeactivateId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 justify-end">
                        {m.id !== SYSTEM_ID && (
                          <button onClick={() => { setResettingId(m.id); setNewPassword(""); }}
                            className="text-xs text-gray-500 hover:text-gray-900 font-medium">
                            Reset Password
                          </button>
                        )}
                        {m.id !== SYSTEM_ID && (
                          m.is_active ? (
                            <button onClick={() => setConfirmDeactivateId(m.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium">
                              Deactivate
                            </button>
                          ) : (
                            <button onClick={() => activate.mutate(m.id)}
                              disabled={activate.isPending}
                              className="text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50">
                              Activate
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── System Tab ────────────────────────────────────────────────────────────

function SystemTab() {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({ queryKey: ["system-settings"], queryFn: getSystemSettings });
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const merged = { ...settings, ...form };

  const save = useMutation({
    mutationFn: () => updateSystemSettings(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      setForm({});
      setDirty(false);
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const FIELDS = [
    { key: "company_name", label: "Company Name", type: "text" },
    { key: "company_timezone", label: "Default Timezone", type: "text" },
    { key: "notification_email", label: "Notification Email", type: "email" },
    { key: "slack_webhook_url", label: "Slack Webhook URL", type: "url", placeholder: "https://hooks.slack.com/..." },
    { key: "renewal_reminder_days", label: "Renewal Reminder (days before)", type: "number" },
  ];

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="font-semibold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Global configuration for the Jojo portal</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {FIELDS.map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={merged[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        <div className="pt-2">
          <button onClick={() => save.mutate()} disabled={!dirty || save.isPending}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────

function IntegrationsTab() {
  const { data: integrations = [] } = useQuery({ queryKey: ["integrations"], queryFn: getIntegrations });

  const ICON_MAP: Record<string, string> = {
    configured: "✅",
    not_configured: "⚠️",
    not_connected: "🔌",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Status of all connected services</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(integrations as IntegrationStatus[]).map((integration) => (
          <div key={integration.name} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">{integration.name}</h3>
                {integration.detail && <p className="text-xs text-gray-500 mt-1">{integration.detail}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {integration.status === "configured" ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300" />
                )}
                <span className={cn("text-xs font-medium capitalize", INTEGRATION_COLORS[integration.status])}>
                  {integration.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            {integration.status !== "configured" && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Coming soon</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "team", label: "Team", icon: Users },
    { key: "system", label: "System", icon: Settings },
    { key: "integrations", label: "Integrations", icon: Plug },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings & Admin</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your team, system configuration, and integrations</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "team" && <TeamTab />}
        {tab === "system" && <SystemTab />}
        {tab === "integrations" && <IntegrationsTab />}
      </div>
    </div>
  );
}
