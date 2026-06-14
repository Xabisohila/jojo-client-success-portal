"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClientRenewals, createRenewal, updateRenewal,
  getClientUpsells, createUpsell, updateUpsell, deleteUpsell,
} from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { Renewal, UpsellOpportunity } from "@/types";
import { RefreshCcw, TrendingUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const RENEWAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  in_negotiation: "bg-yellow-100 text-yellow-700",
  renewed: "bg-blue-100 text-blue-700",
  lost: "bg-gray-100 text-gray-500",
};

const UPSELL_STATUS_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-600",
  pitched: "bg-yellow-100 text-yellow-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-600",
};

const UPSELL_TYPE_LABELS: Record<string, string> = {
  tier_upgrade: "Tier Upgrade",
  additional_location: "Additional Location",
  add_on_feature: "Add-On Feature",
  volume_increase: "Volume Increase",
  referral: "Referral",
  custom: "Custom",
};

// ── Current Contract ──────────────────────────────────────────────────────

function ContractCard({ renewal, clientId }: { renewal: Renewal; clientId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: renewal.status,
    renewal_notes: renewal.renewal_notes ?? "",
    next_contact_date: renewal.next_contact_date ?? "",
    new_contract_months: renewal.new_contract_months?.toString() ?? "",
    new_monthly_fee: renewal.new_monthly_fee?.toString() ?? "",
  });

  const today = new Date();
  const end = new Date(renewal.contract_end);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const update = useMutation({
    mutationFn: () => updateRenewal(clientId, renewal.id, {
      status: form.status,
      renewal_notes: form.renewal_notes || undefined,
      next_contact_date: form.next_contact_date || undefined,
      new_contract_months: form.new_contract_months ? parseInt(form.new_contract_months) : undefined,
      new_monthly_fee: form.new_monthly_fee ? parseFloat(form.new_monthly_fee) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-renewals", clientId] });
      setEditing(false);
      toast.success("Contract updated");
    },
    onError: () => toast.error("Failed to update contract"),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCcw className="w-4 h-4 text-brand-600" /> Current Contract
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span>{formatDate(renewal.contract_start)} → {formatDate(renewal.contract_end)}</span>
            <span className="font-medium">{renewal.contract_months}mo</span>
            {renewal.monthly_fee && <span className="font-semibold text-green-700">${Number(renewal.monthly_fee).toLocaleString()}/mo</span>}
          </div>
        </div>
        <div className="text-right">
          <span className={cn("px-2 py-1 rounded-full text-xs font-medium", RENEWAL_STATUS_COLORS[renewal.status])}>
            {renewal.status.replace(/_/g, " ")}
          </span>
          <p className={cn("text-sm font-semibold mt-1", daysLeft < 0 ? "text-red-600" : daysLeft <= 30 ? "text-red-500" : daysLeft <= 60 ? "text-yellow-600" : "text-gray-500")}>
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
          </p>
        </div>
      </div>

      {!editing ? (
        <div className="space-y-2">
          {renewal.renewal_notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{renewal.renewal_notes}</p>
          )}
          {renewal.next_contact_date && (
            <p className="text-xs text-gray-500">Next contact: <span className="font-medium text-gray-700">{formatDate(renewal.next_contact_date)}</span></p>
          )}
          {renewal.status === "renewed" && renewal.new_monthly_fee && (
            <p className="text-xs text-blue-600 font-medium">Renewed at ${Number(renewal.new_monthly_fee).toLocaleString()}/mo · {renewal.new_contract_months}mo</p>
          )}
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-600 hover:text-brand-700 mt-1">
            Update Status →
          </button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as import("@/types").RenewalStatus })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="active">Active</option>
                <option value="in_negotiation">In Negotiation</option>
                <option value="renewed">Renewed</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Next Contact Date</label>
              <input type="date" value={form.next_contact_date} onChange={(e) => setForm({ ...form, next_contact_date: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          {form.status === "renewed" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Contract (months)</label>
                <input type="number" value={form.new_contract_months} onChange={(e) => setForm({ ...form, new_contract_months: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New MRR ($)</label>
                <input type="number" value={form.new_monthly_fee} onChange={(e) => setForm({ ...form, new_monthly_fee: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.renewal_notes} onChange={(e) => setForm({ ...form, renewal_notes: e.target.value })}
              rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => update.mutate()} disabled={update.isPending}
              className="px-4 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {update.isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Contract Form ─────────────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(y, m - 1 + months, d);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function AddContractForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    contract_start: todayStr(),
    contract_months: "12",
    monthly_fee: "",
    setup_fee: "",
  });

  const contract_end = form.contract_start && form.contract_months
    ? addMonths(form.contract_start, parseInt(form.contract_months) || 0)
    : "";

  const create = useMutation({
    mutationFn: () => createRenewal(clientId, {
      contract_start: form.contract_start,
      contract_end,
      contract_months: parseInt(form.contract_months),
      monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : undefined,
      setup_fee: form.setup_fee ? parseFloat(form.setup_fee) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-renewals", clientId] });
      toast.success("Contract created");
      onDone();
    },
    onError: () => toast.error("Failed to create contract"),
  });

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">Add Contract</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input type="date" value={form.contract_start} onChange={(e) => setForm({ ...form, contract_start: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Duration (months)</label>
          <input type="number" value={form.contract_months} onChange={(e) => setForm({ ...form, contract_months: e.target.value })}
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date (auto-calculated)</label>
          <input type="date" value={contract_end} readOnly
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-default" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Fee ($)</label>
          <input type="number" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => create.mutate()} disabled={create.isPending || !form.contract_start || !form.contract_months || !contract_end}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
          {create.isPending ? "Creating..." : "Create Contract"}
        </button>
        <button onClick={onDone} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  );
}

// ── Upsell Panel ──────────────────────────────────────────────────────────

function UpsellPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: "custom", title: "", description: "", estimated_mrr: "" });

  const { data: upsells = [] } = useQuery({
    queryKey: ["client-upsells", clientId],
    queryFn: () => getClientUpsells(clientId),
  });

  const add = useMutation({
    mutationFn: () => createUpsell(clientId, {
      type: form.type,
      title: form.title,
      description: form.description || undefined,
      estimated_mrr: form.estimated_mrr ? parseFloat(form.estimated_mrr) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-upsells", clientId] });
      setShowAdd(false);
      setForm({ type: "custom", title: "", description: "", estimated_mrr: "" });
      toast.success("Upsell opportunity added");
    },
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateUpsell(clientId, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-upsells", clientId] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteUpsell(clientId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-upsells", clientId] }); toast.success("Removed"); },
  });

  const NEXT_STATUS: Record<string, string | null> = {
    identified: "pitched", pitched: "won", won: null, lost: null,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-600" /> Upsell Opportunities
        </h3>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {Object.entries(UPSELL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Est. MRR ($)</label>
              <input type="number" value={form.estimated_mrr} onChange={(e) => setForm({ ...form, estimated_mrr: e.target.value })} placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Upgrade to Premium plan"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => add.mutate()} disabled={add.isPending || !form.title}
              className="px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500">Cancel</button>
          </div>
        </div>
      )}

      {(upsells as UpsellOpportunity[]).length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400 text-center py-4">No upsell opportunities tracked yet.</p>
      ) : (
        <div className="space-y-2">
          {(upsells as UpsellOpportunity[]).map((u) => (
            <div key={u.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{u.title}</span>
                  <span className="text-xs text-gray-400">{UPSELL_TYPE_LABELS[u.type]}</span>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", UPSELL_STATUS_COLORS[u.status])}>
                    {u.status}
                  </span>
                </div>
                {u.estimated_mrr && (
                  <p className="text-xs text-green-700 font-medium mt-0.5">${Number(u.estimated_mrr).toLocaleString()}/mo</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {NEXT_STATUS[u.status] && (
                  <button onClick={() => advance.mutate({ id: u.id, status: NEXT_STATUS[u.status]! })}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap">
                    Mark {NEXT_STATUS[u.status]} →
                  </button>
                )}
                {u.status === "identified" && (
                  <button onClick={() => advance.mutate({ id: u.id, status: "lost" })}
                    className="text-xs text-gray-400 hover:text-red-500">Lost</button>
                )}
                <button onClick={() => remove.mutate(u.id)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

export function RenewalsTab({ clientId }: { clientId: string }) {
  const [showAddContract, setShowAddContract] = useState(false);

  const { data: renewals = [], isLoading } = useQuery({
    queryKey: ["client-renewals", clientId],
    queryFn: () => getClientRenewals(clientId),
  });

  const activeRenewal = (renewals as Renewal[]).find((r) => r.status !== "lost");

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="text-center p-8 text-gray-400">Loading...</div>
      ) : activeRenewal ? (
        <ContractCard renewal={activeRenewal} clientId={clientId} />
      ) : showAddContract ? (
        <AddContractForm clientId={clientId} onDone={() => setShowAddContract(false)} />
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center space-y-3">
          <RefreshCcw className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-gray-500 text-sm">No contract on record for this client.</p>
          <button onClick={() => setShowAddContract(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700">
            <Plus className="w-4 h-4" /> Add Contract
          </button>
        </div>
      )}

      <UpsellPanel clientId={clientId} />

      {(renewals as Renewal[]).length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Contract History</h3>
          <div className="space-y-2">
            {(renewals as Renewal[]).filter((r) => r.status === "renewed" || r.status === "lost").map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600">{formatDate(r.contract_start)} → {formatDate(r.contract_end)}</span>
                <div className="flex items-center gap-3">
                  {r.monthly_fee && <span className="text-gray-500">${Number(r.monthly_fee).toLocaleString()}/mo</span>}
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", RENEWAL_STATUS_COLORS[r.status])}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
