export interface Job {
  id: string;
  userId: string;
  platform: string;
  externalJobId: string;
  fingerprint: string;
  title: string;
  description: string;
  budget: Record<string, unknown>;
  skills: string[];
  clientInfo: Record<string, unknown>;
  status: JobStatus;
  postedAt: string;
  isSubmitted: boolean;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus =
  | "Processing"
  | "WaitingApproval"
  | "Approved"
  | "Rejected"
  | "ReadyToFill"
  | "Completed"
  | "Failed";

export interface AiAnalysis {
  id: string;
  jobId: string;
  summary: string;
  requiredSkills?: string[];
  suggestedProposal: string;
  suggestedBudget: Record<string, unknown>;
  suggestedTimeline?: string;
  questions?: string[];
  portfolioLink?: string;
  providerUsed: string;
  model?: string;
  createdAt: string;
}

export interface JobDetail extends Job {
  aiAnalysis?: AiAnalysis | null;
  proposals?: Proposal[];
  jobStatusHistory?: JobStatusHistory[];
}

export interface Proposal {
  id: string;
  jobId: string;
  content: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProposalStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Filled"
  | "Submitted";

export interface JobStatusHistory {
  id: string;
  jobId: string;
  fromStatus: string;
  toStatus: string;
  actor: string;
  changedAt: string;
}

export interface JobListParams {
  status?: JobStatus;
  platform?: string;
}

export interface ExtractedJob {
  platform: string;
  externalJobId: string;
  fingerprint: string;
  title: string;
  description: string;
  budget: Record<string, unknown>;
  skills: string[];
  clientInfo: Record<string, unknown>;
  postedAt: string;
}

export interface JobAnalysisOutput {
  summary: string;
  suggestedProposal: string;
  suggestedBudget: Record<string, unknown>;
}

export interface ApprovedProposal {
  jobId: string;
  platform?: string;
  externalJobId?: string;
  proposalText: string;
  budget: Record<string, unknown>;
  timeline?: string;
}

export interface FillResult {
  success: boolean;
  error?: string;
  filledFields?: string[];
  

  blocked?: boolean;
  blockedReasons?: string[];
}

export interface WsEvent {
  type:
    | "job.analyzed"
    | "job.approved"
    | "job.rejected"
    | "job.failed"
    | "job.submitted";
  jobId: string;
  data: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
