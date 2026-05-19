export interface Account {
  id: string;
  name: string;
  industry: string | null;
  state: string | null;
  status: string | null;
  fortune_500: boolean | null;
  fortune_1000: boolean | null;
  open_opps: number | null;
  last_activity: string | null;
  prior_context: string | null;
  sf_id: string | null;
  website: string | null;
  linkedin_url: string | null;
  amount: number | null;
  archived: boolean | null;
  created_at: number | null;
  updated_at: number | null;
  deal_health?: string | null;
}

export interface Stakeholder {
  id: string;
  account_id: string;
  name: string;
  title: string | null;
  type: string | null;
  champion_confirmed: boolean | null;
  linkedin_url: string | null;
  email: string | null;
  priorities: string | null;
  messaging: string | null;
  notes: string | null;
  temperature: string | null;
  last_touched: string | null;
  source: string | null;
  created_at: number | null;
  updated_at: number | null;
}

export interface Call {
  id: string;
  account_id: string;
  title: string | null;
  date: string | null;
  summary: string | null;
  health: string | null;
  health_reason: string | null;
  customer_attendees: string | null;
  raw_transcript: string | null;
  source_file: string | null;
  source_kind: string | null;
  created_at: number | null;
  updated_at: number | null;
}

export interface Question {
  id: string;
  account_id: string;
  call_id: string;
  asker_name: string;
  asker_stakeholder_id: string | null;
  question_text: string;
  status: 'open' | 'answered' | 'deferred';
  resolution_text: string | null;
  resolution_call_id: string | null;
  asked_at: string | null;
  resolved_at: string | null;
  created_at: number;
  updated_at: number;
}

export interface QuestionWithContext extends Question {
  account_name: string;
  call_title: string | null;
}

export type PainCategory = 'nhi' | 'agentic' | 'compliance' | 'operational' | 'strategic';
export type PainConfidence = 'high' | 'medium' | 'low';

export interface Pain {
  id: string;
  account_id: string;
  summary: string;
  category: PainCategory;
  confidence: PainConfidence;
  first_heard_at: string | null;
  last_heard_at: string | null;
  created_at: number;
  updated_at: number;
}

export interface PainSource {
  id: string;
  pain_id: string;
  call_id: string;
  voicer_name: string;
  voicer_stakeholder_id: string | null;
  quote: string;
  confidence: PainConfidence;
  created_at: number;
  call_title?: string | null;
  call_date?: string | null;
}

export interface PainVoicer {
  voicer_name: string;
  voicer_stakeholder_id: string | null;
}

export interface PainWithSources extends Pain {
  sources: PainSource[];
}

export interface PainEnriched extends Pain {
  mention_count: number;
  voicers: PainVoicer[];
}

export interface GameplanPathItem {
  action: string;
  owner: string;
  date: string;
}

export interface GameplanRisk {
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  evidence: string;
  action: string;
}

export interface GameplanStakeholderPosture {
  name: string;
  stakeholder_id: string | null;
  type: string;
  stance: 'advocate' | 'supportive' | 'neutral' | 'skeptical' | 'blocking' | 'unknown';
  stanceReason: string;
  watchFor: string;
}

export interface GameplanContent {
  headline: string;
  trajectory: 'advancing' | 'stalled' | 'at_risk' | 'regressing';
  trajectoryReason: string;
  risks: GameplanRisk[];
  story: string;
  currentState: {
    stage: string;
    decisionMakers: string;
    openQuestions: string;
    topPains: string;
  };
  pathToClose: {
    p0: GameplanPathItem[];
    p1: GameplanPathItem[];
    p2: GameplanPathItem[];
  };
  stakeholderPosture: GameplanStakeholderPosture[];
}

export interface GameplanListEntry {
  id: string;
  account_id: string;
  model_used: string | null;
  generated_at: number | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  generated_with_data_signature: string | null;
}

export interface Gameplan extends GameplanListEntry {
  content: string;
}

export type PreCallPlanStatus = 'draft' | 'generated' | 'completed';

export type PreCallPlanMeetingType =
  | 'discovery'
  | 'demo'
  | 'poc_kickoff'
  | 'poc_update'
  | 'exec_alignment'
  | 'negotiation'
  | 'other';

export interface PreCallPlanAttendeePrep {
  name: string;
  stakeholder_id: string | null;
  role: string;
  talkingTo: string;
  watchFor: string;
}

export interface PreCallPlanTalkingPoint {
  order: number;
  topic: string;
  supportingDetail: string;
}

export interface PreCallPlanObjection {
  objection: string;
  response: string;
}

export interface PreCallPlanContent {
  goal: string;
  presenter: {
    primary: string;
    supporting: string[];
  };
  talkingPoints: PreCallPlanTalkingPoint[];
  customerContext: {
    whatTheyCareAbout: string;
    perAttendee: PreCallPlanAttendeePrep[];
  };
  anticipatedObjections: PreCallPlanObjection[];
  desiredOutcome: string;
}

export interface PreCallPlan {
  id: string;
  account_id: string;
  title: string;
  meeting_type: string;
  planned_date: string | null;
  goal: string | null;
  attendee_stakeholder_ids: string | null;
  additional_attendees: string | null;
  content: string | null;
  status: string;
  linked_call_id: string | null;
  generated_at: number | null;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  created_at: number;
  updated_at: number;
}

export interface PreCallPlanWithCall extends PreCallPlan {
  linked_call_title?: string | null;
  linked_call_date?: string | null;
}

export interface CsvColumnMappingResult {
  mapping: { [tcField: string]: string | null };
  ambiguous: { [tcField: string]: string[] };
  unmapped: string[];
}

export interface CsvPreviewResponse {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
  mapping: CsvColumnMappingResult;
}

export interface CsvCommitResponse {
  ok: true;
  accounts_inserted: number;
  snapshot_path: string;
}

export interface CallAttendee {
  name: string;
  title: string;
  company: string;
}

export type CallUploadFileResult =
  | {
      ok: true;
      filename: string;
      call: Call;
      attendeesSeeded: number;
      attendeesMerged: number;
    }
  | {
      ok: false;
      filename: string;
      error: string;
    };

export interface CallUploadResponse {
  results: CallUploadFileResult[];
  summary: { succeeded: number; failed: number };
}

export interface CallReparseResponse {
  call: Call;
  attendeesSeeded: number;
  attendeesMerged: number;
}
