import type { Account } from '@tc/shared';

const BASE = '/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  accounts: {
    list: () => request<Account[]>('/accounts'),
    get: (id: string) => request<Account>(`/accounts/${id}`),
  },
};
