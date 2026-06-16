export type LeadStatus = "new" | "contacted" | "engaged" | "qualified" | "disqualified" | "converted";
export type LeadSource = "website" | "referral" | "cold_outreach" | "linkedin" | "event" | "partner" | "inbound_call" | "other";

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  company_name: string;
  industry?: string;
  company_size?: string;
  monthly_call_volume?: string;
  current_solution?: string;
  pain_points?: string;
  source: LeadSource;
  status: LeadStatus;
  lead_score?: number;
  opportunity_score?: number;
  score_rationale?: string;
  recommended_action?: string;
  assigned_to?: string;
  disqualified_reason?: string;
  created_at: string;
  updated_at: string;
  activities: Activity[];
}

export interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  subject?: string;
  body?: string;
  performed_by?: string;
  created_at: string;
}

export interface PipelineSummary {
  new: number;
  contacted: number;
  engaged: number;
  qualified: number;
  disqualified: number;
  converted: number;
  total: number;
}

export type AssessmentStatus = "draft" | "in_progress" | "ai_scored" | "pending_approval" | "approved" | "changes_requested" | "flagged";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AssessmentResponse {
  id: string;
  question_key: string;
  question_text: string;
  response_value?: string;
  weight: number;
  points_earned?: number;
}

export interface AssessmentSection {
  id: string;
  section_type: string;
  score?: number;
  max_score: number;
  ai_analysis?: string;
  responses: AssessmentResponse[];
}

export interface AssessmentRisk {
  id: string;
  risk_category: string;
  risk_description: string;
  severity: RiskLevel;
  mitigation?: string;
}

export interface Assessment {
  id: string;
  lead_id: string;
  status: AssessmentStatus;
  total_score?: number;
  risk_level?: RiskLevel;
  ai_summary?: string;
  ai_recommendations?: string;
  reviewer_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  sections: AssessmentSection[];
  risks: AssessmentRisk[];
}

export type ProposalStatus = "generating" | "draft" | "pending_approval" | "approved" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
export type PricingTier = "starter" | "professional" | "enterprise" | "custom";

export interface ProposalLineItem {
  id: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_recurring: boolean;
  sort_order: number;
}

export interface Proposal {
  id: string;
  lead_id: string;
  assessment_id?: string;
  version: number;
  status: ProposalStatus;
  pricing_tier: PricingTier;
  scope_summary?: string;
  executive_summary?: string;
  monthly_fee?: number;
  setup_fee?: number;
  contract_months: number;
  roi_monthly?: number;
  roi_annual?: number;
  roi_rationale?: string;
  valid_until?: string;
  reviewer_notes?: string;
  approved_by?: string;
  approved_at?: string;
  sent_at?: string;
  accepted_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  line_items: ProposalLineItem[];
}

export interface DashboardSummary {
  leads_total: number;
  leads_new: number;
  leads_qualified: number;
  leads_converted: number;
  assessments_pending_approval: number;
  proposals_pending_approval: number;
  proposals_sent: number;
  proposals_accepted: number;
  clients_onboarding: number;
  clients_implementation: number;
  clients_go_live: number;
  clients_active: number;
  clients_churned: number;
}

// ── Phase 2 ───────────────────────────────────────────────────────────────

export type ClientStatus = "onboarding" | "implementation" | "go_live" | "active" | "churned";

export interface Client {
  id: string;
  lead_id: string;
  proposal_id?: string;
  company_name: string;
  industry?: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export type OnboardingStatus = "draft" | "in_progress" | "pending_approval" | "approved";

export interface FAQ { question: string; answer: string; }
export interface EscalationContact { name: string; role: string; phone: string; trigger: string; }
export interface BusinessHoursDay { is_open: boolean; open: string; close: string; }

export interface Onboarding {
  id: string;
  client_id: string;
  status: OnboardingStatus;
  business_name?: string;
  abn?: string;
  business_phone?: string;
  business_email?: string;
  website?: string;
  business_address?: string;
  staff_count?: string;
  business_hours?: Record<string, BusinessHoursDay>;
  timezone: string;
  public_holiday_handling?: string;
  emergency_policy?: string;
  primary_services?: string[];
  call_types?: string[];
  excluded_topics?: string;
  greeting_style: string;
  faqs?: FAQ[];
  key_policies?: string;
  special_instructions?: string;
  calendar_system?: string;
  calendar_details?: Record<string, string>;
  crm_system?: string;
  crm_details?: Record<string, string>;
  phone_system?: string;
  existing_number?: string;
  can_forward_calls?: boolean;
  escalation_contacts?: EscalationContact[];
  reviewer_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type JojoConfigStatus = "generating" | "draft" | "pending_review" | "approved" | "deployed";

export interface JojoConfig {
  id: string;
  client_id: string;
  onboarding_id?: string;
  version: number;
  status: JojoConfigStatus;
  greeting_message?: string;
  after_hours_message?: string;
  call_flow?: Record<string, unknown>;
  booking_rules?: Record<string, unknown>;
  escalation_rules?: unknown[];
  knowledge_base?: Record<string, unknown>;
  config_summary?: string;
  jojo_phone_number?: string;
  reviewer_notes?: string;
  approved_by?: string;
  approved_at?: string;
  deployed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked" | "skipped";
export type TaskCategory = "setup" | "integration" | "configuration" | "testing" | "training" | "sign_off";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface ImplementationTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  notes?: string;
  sort_order: number;
  created_at: string;
}

export interface ImplementationProject {
  id: string;
  client_id: string;
  jojo_config_id?: string;
  status: string;
  target_go_live?: string;
  actual_go_live?: string;
  project_manager?: string;
  created_at: string;
  updated_at: string;
  tasks: ImplementationTask[];
}

// ── Phase 3 ───────────────────────────────────────────────────────────────

export interface GoLiveEvent {
  id: string;
  client_id: string;
  confirmed_by?: string;
  actual_go_live?: string;
  jojo_number_confirmed?: string;
  call_forwarding_verified: boolean;
  test_call_completed: boolean;
  client_signed_off: boolean;
  notes?: string;
  created_at: string;
}

export type HealthRiskLevel = "healthy" | "at_risk" | "critical";

export interface CustomerHealth {
  id: string;
  client_id: string;
  health_score?: number;
  usage_score?: number;
  support_score?: number;
  engagement_score?: number;
  roi_score?: number;
  risk_level: HealthRiskLevel;
  ai_summary?: string;
  ai_recommendations?: string;
  notes?: string;
  calculated_at: string;
  calculated_by?: string;
}

export type CheckinType = "onboarding_call" | "qbr" | "health_check" | "renewal_discussion" | "ad_hoc";
export type CheckinOutcome = "positive" | "neutral" | "negative" | "escalated";

export interface ActionItem {
  item: string;
  owner?: string;
  due_date?: string;
  completed?: boolean;
}

export interface Checkin {
  id: string;
  client_id: string;
  checkin_type: CheckinType;
  scheduled_at?: string;
  completed_at?: string;
  conducted_by?: string;
  outcome?: CheckinOutcome;
  summary?: string;
  action_items?: ActionItem[];
  next_checkin_date?: string;
  created_at: string;
}

export type NpsCategory = "promoter" | "passive" | "detractor";

export interface NpsResponse {
  id: string;
  client_id: string;
  score: number;
  category: NpsCategory;
  verbatim?: string;
  survey_period?: string;
  submitted_at: string;
  recorded_by?: string;
}

export interface CSDashboardSummary {
  active_clients: number;
  go_live_clients: number;
  healthy: number;
  at_risk: number;
  critical: number;
  avg_health_score?: number;
  nps_average?: number;
  promoters: number;
  passives: number;
  detractors: number;
  checkins_due_7_days: number;
  renewals_due_30_days: number;
  renewals_due_60_days: number;
}

export interface ClientHealthSummary {
  client_id: string;
  company_name: string;
  status: string;
  health_score?: number;
  risk_level: HealthRiskLevel;
  last_checkin?: string;
  last_nps?: number;
  days_since_go_live?: number;
}

// ── Pagination ────────────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Phase 4 ───────────────────────────────────────────────────────────────

export type RenewalStatus = "active" | "in_negotiation" | "renewed" | "lost";
export type UpsellType = "tier_upgrade" | "additional_location" | "add_on_feature" | "volume_increase" | "referral" | "custom";
export type UpsellStatus = "identified" | "pitched" | "won" | "lost";

export interface Renewal {
  id: string;
  client_id: string;
  contract_start: string;
  contract_end: string;
  contract_months: number;
  monthly_fee?: number;
  setup_fee?: number;
  status: RenewalStatus;
  renewal_notes?: string;
  next_contact_date?: string;
  renewed_at?: string;
  new_contract_months?: number;
  new_monthly_fee?: number;
  created_at: string;
  updated_at: string;
}

export interface RenewalListItem extends Renewal {
  company_name: string;
  client_status: string;
  days_to_renewal: number;
  upsell_count: number;
}

export interface RenewalDashboard {
  total_active: number;
  due_soon: number;
  urgent: number;
  overdue: number;
  in_negotiation: number;
  renewed_this_quarter: number;
  mrr_at_risk: number;
  total_mrr: number;
  upsell_identified: number;
  upsell_pitched: number;
  upsell_won_quarter: number;
  upsell_pipeline_value: number;
  upsell_won_value: number;
}

export interface UpsellOpportunity {
  id: string;
  client_id: string;
  type: UpsellType;
  title: string;
  description?: string;
  estimated_mrr?: number;
  status: UpsellStatus;
  identified_at: string;
  pitched_at?: string;
  closed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  entra_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface IntegrationStatus {
  name: string;
  status: "configured" | "not_configured" | "not_connected";
  detail?: string;
}
