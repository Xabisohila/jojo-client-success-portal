from app.schemas.lead import (
    LeadCreate, LeadUpdate, LeadOut, LeadListItem,
    LeadQualify, LeadDisqualify, ActivityCreate, ActivityOut, PipelineSummary
)
from app.schemas.assessment import (
    AssessmentCreate, AssessmentOut, AssessmentListItem,
    SectionResponsesUpdate, AssessmentApprove, AssessmentRequestChanges
)
from app.schemas.proposal import (
    ProposalOut, ProposalListItem, ProposalUpdate, ProposalApprove, ProposalReject
)
from app.schemas.client import (
    ClientOut, ClientListItem,
    OnboardingOut, OnboardingStep1, OnboardingStep2, OnboardingStep3,
    OnboardingStep4, OnboardingStep5, OnboardingApprove,
    JojoConfigOut, JojoConfigUpdate, JojoConfigApprove,
    ImplementationProjectOut, TaskOut, TaskUpdate, ProjectUpdate,
)
