"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { createLead } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  company_name: z.string().min(1, "Required"),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  monthly_call_volume: z.string().optional(),
  current_solution: z.string().optional(),
  pain_points: z.string().optional(),
  source: z.string().default("other"),
});

type FormData = z.infer<typeof schema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const INPUT = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white";
const SELECT = `${INPUT} appearance-none`;

export default function NewLeadPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: "other" },
  });

  const create = useMutation({
    mutationFn: createLead,
    onSuccess: (lead) => {
      toast.success("Lead created. AI scoring started...");
      router.push(`/leads/${lead.id}`);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? "Failed to create lead.");
    },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leads" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Lead</h1>
          <p className="text-sm text-gray-500">AI scoring will run automatically after creation.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => create.mutate({ ...d, source: d.source as import("@/types").LeadSource }))} className="space-y-6">
        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *" error={errors.first_name?.message}>
              <input {...register("first_name")} className={INPUT} placeholder="Jane" />
            </Field>
            <Field label="Last Name *" error={errors.last_name?.message}>
              <input {...register("last_name")} className={INPUT} placeholder="Smith" />
            </Field>
          </div>
          <Field label="Email *" error={errors.email?.message}>
            <input {...register("email")} type="email" className={INPUT} placeholder="jane@company.com" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register("phone")} className={INPUT} placeholder="+61 400 000 000" />
            </Field>
            <Field label="Job Title" error={errors.job_title?.message}>
              <input {...register("job_title")} className={INPUT} placeholder="Practice Manager" />
            </Field>
          </div>
        </div>

        {/* Company */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Company Information</h2>
          <Field label="Company Name *" error={errors.company_name?.message}>
            <input {...register("company_name")} className={INPUT} placeholder="Smith Dental Practice" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Industry">
              <select {...register("industry")} className={SELECT}>
                <option value="">Select industry</option>
                <option>Medical / Healthcare</option>
                <option>Dental</option>
                <option>Legal</option>
                <option>Plumbing / HVAC / Trades</option>
                <option>Real Estate</option>
                <option>Hospitality / Restaurant</option>
                <option>Veterinary</option>
                <option>Salon / Beauty / Spa</option>
                <option>Property Management</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Company Size">
              <select {...register("company_size")} className={SELECT}>
                <option value="">Select size</option>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>201-500</option>
                <option>500+</option>
              </select>
            </Field>
          </div>
          <Field label="Monthly Call Volume">
            <select {...register("monthly_call_volume")} className={SELECT}>
              <option value="">Select volume</option>
              <option value="&lt;100">Less than 100 calls/month</option>
              <option value="100-500">100–500 calls/month</option>
              <option value="500+">500+ calls/month</option>
            </select>
          </Field>
        </div>

        {/* Qualification */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Qualification Context</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lead Source">
              <select {...register("source")} className={SELECT}>
                <option value="other">Other</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="cold_outreach">Cold Outreach</option>
                <option value="linkedin">LinkedIn</option>
                <option value="event">Event</option>
                <option value="partner">Partner</option>
                <option value="inbound_call">Inbound Call</option>
              </select>
            </Field>
          </div>
          <Field label="Current Call Handling Solution">
            <input {...register("current_solution")} className={INPUT} placeholder="e.g. Human receptionist, voicemail, no system" />
          </Field>
          <Field label="Pain Points">
            <textarea {...register("pain_points")} rows={3} className={INPUT} placeholder="e.g. Missed calls after hours, expensive receptionist, booking errors..." />
          </Field>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || create.isPending}
            className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {create.isPending ? "Creating..." : "Create Lead & Start AI Scoring"}
          </button>
          <Link href="/leads" className="px-6 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
