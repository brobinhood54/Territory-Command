import type { Account, Stakeholder } from '@tc/shared';

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
};
