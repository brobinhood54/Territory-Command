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
