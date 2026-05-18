import type { Account } from '@tc/shared';

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
};
