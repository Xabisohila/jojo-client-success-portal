import axios from "axios";
import type {
  Lead, Assessment, Proposal, PipelineSummary, DashboardSummary, Activity,
  Client, Onboarding, JojoConfig, ImplementationProject, ImplementationTask,
  GoLiveEvent, CustomerHealth, Checkin, NpsResponse, CSDashboardSummary, ClientHealthSummary,
  Renewal, RenewalListItem, RenewalDashboard, UpsellOpportunity,
  TeamMember, IntegrationStatus, Paginated, AuthUser,
} from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url: string = error?.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/me");
    if (error?.response?.status === 401 && !isAuthCall && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────
export const login = (email: string, password: string): Promise<AuthUser> =>
  api.post("/auth/login", { email, password }).then((r) => r.data);

export const logout = (): Promise<void> =>
  api.post("/auth/logout").then(() => undefined);

export const getMe = (): Promise<AuthUser> =>
  api.get("/auth/me").then((r) => r.data);

export const changeOwnPassword = (currentPassword: string, newPassword: string): Promise<void> =>
  api.patch("/auth/me/password", { current_password: currentPassword, new_password: newPassword }).then(() => undefined);

// ── Dashboard ─────────────────────────────────────────────────────────────
export const getDashboardSummary = (): Promise<DashboardSummary> =>
  api.get("/dashboard/summary").then((r) => r.data);

export const getRecentActivity = () =>
  api.get("/dashboard/recent-activity").then((r) => r.data);

// ── Leads ─────────────────────────────────────────────────────────────────
export const getLeads = (params?: Record<string, string | number>): Promise<Paginated<Lead>> =>
  api.get("/leads", { params }).then((r) => r.data);

export const getLead = (id: string): Promise<Lead> =>
  api.get(`/leads/${id}`).then((r) => r.data);

export const createLead = (data: Partial<Lead>): Promise<Lead> =>
  api.post("/leads", data).then((r) => r.data);

export const updateLead = (id: string, data: Partial<Lead>): Promise<Lead> =>
  api.patch(`/leads/${id}`, data).then((r) => r.data);

export const getPipelineSummary = (): Promise<PipelineSummary> =>
  api.get("/leads/pipeline-summary").then((r) => r.data);

export const scoreLead = (id: string): Promise<Lead> =>
  api.post(`/leads/${id}/score`).then((r) => r.data);

export const qualifyLead = (id: string, note?: string): Promise<Lead> =>
  api.post(`/leads/${id}/qualify`, { note }).then((r) => r.data);

export const disqualifyLead = (id: string, reason: string): Promise<Lead> =>
  api.post(`/leads/${id}/disqualify`, { reason }).then((r) => r.data);

export const addActivity = (leadId: string, data: Partial<Activity>): Promise<Activity> =>
  api.post(`/leads/${leadId}/activities`, data).then((r) => r.data);

// ── Assessments ───────────────────────────────────────────────────────────
export const createAssessment = (leadId: string): Promise<Assessment> =>
  api.post(`/leads/${leadId}/assessments`).then((r) => r.data);

export const getAssessments = (page = 1, page_size = 25): Promise<Paginated<Assessment>> =>
  api.get("/assessments", { params: { page, page_size } }).then((r) => r.data);

export const getAssessment = (id: string): Promise<Assessment> =>
  api.get(`/assessments/${id}`).then((r) => r.data);

export const updateAssessmentSection = (
  id: string,
  data: { section_type: string; responses: { question_key: string; question_text: string; response_value: string; weight: number }[] }
): Promise<Assessment> =>
  api.patch(`/assessments/${id}/sections`, data).then((r) => r.data);

export const submitAssessment = (id: string): Promise<Assessment> =>
  api.post(`/assessments/${id}/submit`).then((r) => r.data);

export const approveAssessment = (id: string, reviewer_notes?: string): Promise<Assessment> =>
  api.post(`/assessments/${id}/approve`, { reviewer_notes }).then((r) => r.data);

export const requestAssessmentChanges = (id: string, reviewer_notes: string): Promise<Assessment> =>
  api.post(`/assessments/${id}/request-changes`, { reviewer_notes }).then((r) => r.data);

// ── Proposals ─────────────────────────────────────────────────────────────
export const getProposals = (page = 1, page_size = 25): Promise<Paginated<Proposal>> =>
  api.get("/proposals", { params: { page, page_size } }).then((r) => r.data);

export const downloadProposalPdf = (id: string): string =>
  `${api.defaults.baseURL}/proposals/${id}/pdf`;

export const getProposal = (id: string): Promise<Proposal> =>
  api.get(`/proposals/${id}`).then((r) => r.data);

export const updateProposal = (id: string, data: Partial<Proposal>): Promise<Proposal> =>
  api.patch(`/proposals/${id}`, data).then((r) => r.data);

export const approveProposal = (id: string, reviewer_notes?: string): Promise<Proposal> =>
  api.post(`/proposals/${id}/approve`, { reviewer_notes }).then((r) => r.data);

export const sendProposal = (id: string): Promise<Proposal> =>
  api.post(`/proposals/${id}/send`).then((r) => r.data);

export const acceptProposal = (id: string): Promise<Proposal> =>
  api.post(`/proposals/${id}/accept`).then((r) => r.data);

export const rejectProposal = (id: string, reason: string): Promise<Proposal> =>
  api.post(`/proposals/${id}/reject`, { reason }).then((r) => r.data);

// ── Clients ───────────────────────────────────────────────────────────────
export const getClients = (page = 1, page_size = 25): Promise<Paginated<Client>> =>
  api.get("/clients", { params: { page, page_size } }).then((r) => r.data);

export const getClient = (id: string): Promise<Client> =>
  api.get(`/clients/${id}`).then((r) => r.data);

// ── Onboarding ────────────────────────────────────────────────────────────
export const getOnboarding = (clientId: string): Promise<Onboarding> =>
  api.get(`/clients/${clientId}/onboarding`).then((r) => r.data);

export const saveOnboardingStep = (clientId: string, step: number, data: Record<string, unknown>): Promise<Onboarding> =>
  api.patch(`/clients/${clientId}/onboarding/step${step}`, data).then((r) => r.data);

export const submitOnboarding = (clientId: string): Promise<Onboarding> =>
  api.post(`/clients/${clientId}/onboarding/submit`).then((r) => r.data);

export const approveOnboarding = (clientId: string, reviewer_notes?: string): Promise<Onboarding> =>
  api.post(`/clients/${clientId}/onboarding/approve`, { reviewer_notes }).then((r) => r.data);

// ── Jojo Config ───────────────────────────────────────────────────────────
export const getJojoConfig = (clientId: string): Promise<JojoConfig> =>
  api.get(`/clients/${clientId}/config`).then((r) => r.data);

export const updateJojoConfig = (clientId: string, configId: string, data: Partial<JojoConfig>): Promise<JojoConfig> =>
  api.patch(`/clients/${clientId}/config/${configId}`, data).then((r) => r.data);

export const approveJojoConfig = (clientId: string, configId: string, payload: { reviewer_notes?: string; jojo_phone_number?: string }): Promise<JojoConfig> =>
  api.post(`/clients/${clientId}/config/${configId}/approve`, payload).then((r) => r.data);

export const regenerateJojoConfig = (clientId: string): Promise<void> =>
  api.post(`/clients/${clientId}/config/regenerate`).then((r) => r.data);

export const updateKnowledgeBase = (
  clientId: string,
  configId: string,
  kb: { business_name?: string; business_hours?: string; timezone?: string; services: string[]; faqs: { question: string; answer: string }[] }
): Promise<JojoConfig> =>
  api.patch(`/clients/${clientId}/config/${configId}/knowledge-base`, kb).then((r) => r.data);

// ── Implementation ────────────────────────────────────────────────────────
export const getImplementation = (clientId: string): Promise<ImplementationProject> =>
  api.get(`/clients/${clientId}/implementation`).then((r) => r.data);

export const updateTask = (clientId: string, taskId: string, data: { status?: string; notes?: string }): Promise<ImplementationTask> =>
  api.patch(`/clients/${clientId}/implementation/tasks/${taskId}`, data).then((r) => r.data);

// ── Go Live ───────────────────────────────────────────────────────────────
export const confirmGoLive = (clientId: string, data: {
  actual_go_live?: string;
  jojo_number_confirmed?: string;
  call_forwarding_verified: boolean;
  test_call_completed: boolean;
  client_signed_off: boolean;
  notes?: string;
}): Promise<GoLiveEvent> =>
  api.post(`/clients/${clientId}/go-live`, data).then((r) => r.data);

// ── Customer Success ──────────────────────────────────────────────────────
export const getCSDashboard = (): Promise<CSDashboardSummary> =>
  api.get("/customer-success/dashboard").then((r) => r.data);

export const getCSClients = (page = 1, page_size = 25): Promise<Paginated<ClientHealthSummary>> =>
  api.get("/customer-success/clients", { params: { page, page_size } }).then((r) => r.data);

export const getHealthScores = (clientId: string): Promise<CustomerHealth[]> =>
  api.get(`/clients/${clientId}/health`).then((r) => r.data);

export const triggerHealthScore = (clientId: string): Promise<{ message: string }> =>
  api.post(`/clients/${clientId}/health/score`).then((r) => r.data);

export const saveManualHealth = (clientId: string, data: {
  usage_score?: number;
  support_score?: number;
  engagement_score?: number;
  roi_score?: number;
  notes?: string;
}): Promise<CustomerHealth> =>
  api.post(`/clients/${clientId}/health/manual`, data).then((r) => r.data);

export const getCheckins = (clientId: string): Promise<Checkin[]> =>
  api.get(`/clients/${clientId}/checkins`).then((r) => r.data);

export const createCheckin = (clientId: string, data: {
  checkin_type: string;
  scheduled_at?: string;
  summary?: string;
  outcome?: string;
  action_items?: { item: string; owner?: string; due_date?: string }[];
  next_checkin_date?: string;
}): Promise<Checkin> =>
  api.post(`/clients/${clientId}/checkins`, data).then((r) => r.data);

export const getNpsResponses = (clientId: string): Promise<NpsResponse[]> =>
  api.get(`/clients/${clientId}/nps`).then((r) => r.data);

export const addNpsResponse = (clientId: string, data: {
  score: number;
  verbatim?: string;
  survey_period?: string;
}): Promise<NpsResponse> =>
  api.post(`/clients/${clientId}/nps`, data).then((r) => r.data);

// ── Renewals ──────────────────────────────────────────────────────────────
export const getRenewalDashboard = (): Promise<RenewalDashboard> =>
  api.get("/renewals/dashboard").then((r) => r.data);

export const listRenewals = (status?: string, page = 1, page_size = 25): Promise<Paginated<RenewalListItem>> =>
  api.get("/renewals", { params: { ...(status ? { status } : {}), page, page_size } }).then((r) => r.data);

export const getClientRenewals = (clientId: string): Promise<Renewal[]> =>
  api.get(`/clients/${clientId}/renewals`).then((r) => r.data);

export const createRenewal = (clientId: string, data: {
  contract_start: string;
  contract_end: string;
  contract_months: number;
  monthly_fee?: number;
  setup_fee?: number;
  renewal_notes?: string;
}): Promise<Renewal> =>
  api.post(`/clients/${clientId}/renewals`, data).then((r) => r.data);

export const updateRenewal = (clientId: string, renewalId: string, data: {
  status?: string;
  renewal_notes?: string;
  next_contact_date?: string;
  new_contract_months?: number;
  new_monthly_fee?: number;
}): Promise<Renewal> =>
  api.patch(`/clients/${clientId}/renewals/${renewalId}`, data).then((r) => r.data);

export const getClientUpsells = (clientId: string): Promise<UpsellOpportunity[]> =>
  api.get(`/clients/${clientId}/upsells`).then((r) => r.data);

export const createUpsell = (clientId: string, data: {
  type?: string;
  title: string;
  description?: string;
  estimated_mrr?: number;
  notes?: string;
}): Promise<UpsellOpportunity> =>
  api.post(`/clients/${clientId}/upsells`, data).then((r) => r.data);

export const updateUpsell = (clientId: string, upsellId: string, data: {
  status?: string;
  title?: string;
  description?: string;
  estimated_mrr?: number;
  notes?: string;
}): Promise<UpsellOpportunity> =>
  api.patch(`/clients/${clientId}/upsells/${upsellId}`, data).then((r) => r.data);

export const deleteUpsell = (clientId: string, upsellId: string): Promise<void> =>
  api.delete(`/clients/${clientId}/upsells/${upsellId}`).then((r) => r.data);

// ── Settings ──────────────────────────────────────────────────────────────
export const getSystemSettings = (): Promise<Record<string, string>> =>
  api.get("/settings/system").then((r) => r.data);

export const updateSystemSettings = (data: Record<string, string>): Promise<Record<string, string>> =>
  api.patch("/settings/system", data).then((r) => r.data);

export const getIntegrations = (): Promise<IntegrationStatus[]> =>
  api.get("/settings/integrations").then((r) => r.data);

export const getTeamMembers = (): Promise<TeamMember[]> =>
  api.get("/settings/team").then((r) => r.data);

export const addTeamMember = (data: { full_name: string; email: string; role: string; password?: string }): Promise<TeamMember> =>
  api.post("/settings/team", data).then((r) => r.data);

export const updateTeamMember = (userId: string, data: { full_name?: string; role?: string; is_active?: boolean; password?: string }): Promise<TeamMember> =>
  api.patch(`/settings/team/${userId}`, data).then((r) => r.data);

export const deactivateTeamMember = (userId: string): Promise<void> =>
  api.delete(`/settings/team/${userId}`).then((r) => r.data);
