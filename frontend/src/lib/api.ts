import type { Account, Stakeholder, Call, CallUploadResponse, CallReparseResponse, Question, QuestionWithContext } from '@tc/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export type AccountPatch = Partial<Pick<Account,
  'name' | 'industry' | 'state' | 'status' |
  'fortune_500' | 'fortune_1000' | 'open_opps' |
  'last_activity' | 'prior_context' | 'amount' |
  'website' | 'linkedin_url'
>>;

export type StakeholderDraft = {
  name: string;
  title?: string;
  type?: string;
  email?: string;
  linkedinUrl?: string;
  priorities?: string;
  messaging?: string;
  notes?: string;
  temperature?: string;
  championConfirmed?: boolean;
  lastTouched?: string;
};

export type StakeholderPatch = Partial<StakeholderDraft>;

export type CallPatch = {
  title?: string;
  date?: string | null;
  summary?: string;
  health?: string;
};

export type ImportResult = {
  ok: true;
  summary: { accounts: number; stakeholders: number; calls: number };
};

export type BackupResult = {
  ok: true;
  path: string;
  size_bytes: number;
};

async function exportData(): Promise<void> {
  const res = await fetch(`${BASE}/export`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'territory-command-backup.json';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importData(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/import`, { method: 'POST', body: formData });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return json as ImportResult;
}

async function backupNow(): Promise<BackupResult> {
  const res = await fetch(`${BASE}/backup`, { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return json as BackupResult;
}

export const api = {
  accounts: {
    list: () => request<Account[]>('/accounts'),
    get: (id: string) => request<Account>(`/accounts/${id}`),
    update: (id: string, patch: AccountPatch) =>
      request<Account>(`/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
  },
  stakeholders: {
    list: (accountId: string) =>
      request<Stakeholder[]>(`/accounts/${accountId}/stakeholders`),
    create: (accountId: string, draft: StakeholderDraft) =>
      request<Stakeholder>(`/accounts/${accountId}/stakeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }),
    update: (id: string, patch: StakeholderPatch) =>
      request<Stakeholder>(`/stakeholders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/stakeholders/${id}`, { method: 'DELETE' }),
    merge: (sourceId: string, targetId: string) =>
      request<Stakeholder>(`/stakeholders/${sourceId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      }),
  },
  calls: {
    list: (accountId: string) =>
      request<Call[]>(`/accounts/${accountId}/calls`),
    get: (id: string) =>
      request<Call>(`/calls/${id}`),
    upload: (accountId: string, files: File[]) => {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      return request<CallUploadResponse>(`/accounts/${accountId}/calls/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    update: (id: string, patch: CallPatch) =>
      request<Call>(`/calls/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/calls/${id}`, { method: 'DELETE' }),
    reparse: (id: string) =>
      request<CallReparseResponse>(`/calls/${id}/reparse`, { method: 'POST' }),
  },
  questions: {
    listForAccount: (accountId: string) =>
      request<Question[]>(`/accounts/${accountId}/questions`),
    listOpen: () =>
      request<QuestionWithContext[]>('/questions/open'),
    update: (id: string, patch: {
      status?: 'open' | 'answered' | 'deferred';
      resolution_text?: string | null;
      question_text?: string;
      asker_name?: string;
      asker_stakeholder_id?: string | null;
    }) =>
      request<Question>(`/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    linkStakeholder: (id: string, stakeholderId: string | null) =>
      request<Question>(`/questions/${id}/link-stakeholder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stakeholderId }),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/questions/${id}`, { method: 'DELETE' }),
  },
  data: { exportData, importData, backupNow },
};
