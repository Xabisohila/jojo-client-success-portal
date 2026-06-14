"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateKnowledgeBase } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, Save } from "lucide-react";
import { toast } from "sonner";
import type { JojoConfig } from "@/types";

interface FAQ { question: string; answer: string; }

interface KB {
  business_name?: string;
  business_hours?: string;
  timezone?: string;
  services: string[];
  faqs: FAQ[];
}

function parseKB(raw: Record<string, unknown> | null | undefined): KB {
  if (!raw) return { services: [], faqs: [] };
  return {
    business_name: raw.business_name as string | undefined,
    business_hours: raw.business_hours as string | undefined,
    timezone: raw.timezone as string | undefined,
    services: Array.isArray(raw.services) ? (raw.services as string[]) : [],
    faqs: Array.isArray(raw.faqs) ? (raw.faqs as FAQ[]) : [],
  };
}

function FAQItem({
  faq, index, onChange, onDelete,
}: {
  faq: FAQ; index: number;
  onChange: (i: number, f: FAQ) => void;
  onDelete: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 truncate pr-4">
          {faq.question || <span className="text-gray-400 italic">New question...</span>}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-white">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Question</label>
            <input
              value={faq.question}
              onChange={(e) => onChange(index, { ...faq, question: e.target.value })}
              placeholder="e.g. What are your business hours?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Answer</label>
            <textarea
              value={faq.answer}
              onChange={(e) => onChange(index, { ...faq, answer: e.target.value })}
              rows={3}
              placeholder="e.g. We are open Monday to Friday, 8am to 6pm."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete this FAQ
          </button>
        </div>
      )}
    </div>
  );
}

export function KnowledgeBaseEditor({ config, clientId }: { config: JojoConfig; clientId: string }) {
  const qc = useQueryClient();
  const [kb, setKB] = useState<KB>(() => parseKB(config.knowledge_base as Record<string, unknown> | null));
  const [newService, setNewService] = useState("");
  const [dirty, setDirty] = useState(false);

  function mark<T>(val: T, setter: (v: T) => void) {
    setter(val);
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: () => updateKnowledgeBase(clientId, config.id, kb),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jojo-config", clientId] });
      setDirty(false);
      toast.success("Knowledge base saved");
    },
    onError: () => toast.error("Failed to save knowledge base"),
  });

  function addFaq() {
    mark({ ...kb, faqs: [...kb.faqs, { question: "", answer: "" }] }, setKB);
  }

  function updateFaq(i: number, faq: FAQ) {
    const faqs = [...kb.faqs];
    faqs[i] = faq;
    mark({ ...kb, faqs }, setKB);
  }

  function deleteFaq(i: number) {
    mark({ ...kb, faqs: kb.faqs.filter((_, idx) => idx !== i) }, setKB);
  }

  function addService() {
    const s = newService.trim();
    if (!s || kb.services.includes(s)) return;
    mark({ ...kb, services: [...kb.services, s] }, setKB);
    setNewService("");
  }

  function deleteService(s: string) {
    mark({ ...kb, services: kb.services.filter((x) => x !== s) }, setKB);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-600" /> Knowledge Base Editor
        </h3>
        <button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            dirty
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          <Save className="w-3.5 h-3.5" />
          {save.isPending ? "Saving..." : dirty ? "Save Changes" : "Saved"}
        </button>
      </div>

      {/* Business info (read-only) */}
      {(kb.business_name || kb.business_hours) && (
        <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Business Info</p>
          {kb.business_name && (
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-28 shrink-0">Business name</span>
              <span className="font-medium text-gray-800">{kb.business_name}</span>
            </div>
          )}
          {kb.timezone && (
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-28 shrink-0">Timezone</span>
              <span className="font-medium text-gray-800">{kb.timezone}</span>
            </div>
          )}
          {kb.business_hours && (
            <div className="flex gap-2 text-sm">
              <span className="text-gray-500 w-28 shrink-0">Hours</span>
              <span className="text-gray-700 whitespace-pre-line">{kb.business_hours}</span>
            </div>
          )}
        </div>
      )}

      {/* Services */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Services <span className="ml-1 text-xs font-normal text-gray-400">({kb.services.length})</span>
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {kb.services.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 text-sm rounded-full border border-brand-200">
              {s}
              <button type="button" onClick={() => deleteService(s)} className="hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          {kb.services.length === 0 && (
            <p className="text-sm text-gray-400 italic">No services listed yet.</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService(); } }}
            placeholder="Add a service (e.g. Emergency call-out)..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={addService}
            disabled={!newService.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* FAQs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            FAQs <span className="ml-1 text-xs font-normal text-gray-400">({kb.faqs.length})</span>
          </h4>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add FAQ
          </button>
        </div>
        {kb.faqs.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <BookOpen className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No FAQs yet. Add Q&As that Jojo should know.</p>
            <button type="button" onClick={addFaq} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              + Add first FAQ
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {kb.faqs.map((faq, i) => (
              <FAQItem key={i} faq={faq} index={i} onChange={updateFaq} onDelete={deleteFaq} />
            ))}
          </div>
        )}
      </div>

      {dirty && (
        <div className="flex justify-end pt-2 border-t border-gray-100">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "Saving..." : "Save Knowledge Base"}
          </button>
        </div>
      )}
    </div>
  );
}
