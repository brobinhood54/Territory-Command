import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts, calls } from '../db/schema';

export const accountRoutes = new Hono();

accountRoutes.get('/accounts', async (c) => {
  const accountRows = await db.select().from(accounts).where(eq(accounts.archived, false));

  // Fetch all calls in one query, then find the most recent per account in memory.
  // deal_health is derived, not stored, so no schema change is needed.
  const allCalls = await db.select({
    account_id: calls.account_id,
    date: calls.date,
    created_at: calls.created_at,
    health: calls.health,
  }).from(calls);

  type CallSummary = { date: string | null; created_at: number | null; health: string | null };
  const latestCallMap = new Map<string, CallSummary>();
  for (const call of allCalls) {
    const existing = latestCallMap.get(call.account_id);
    if (!existing) {
      latestCallMap.set(call.account_id, call);
    } else {
      const newer =
        (call.date ?? '') > (existing.date ?? '') ||
        (call.date === existing.date && (call.created_at ?? 0) > (existing.created_at ?? 0));
      if (newer) latestCallMap.set(call.account_id, call);
    }
  }

  const result = accountRows.map(a => ({
    ...a,
    deal_health: latestCallMap.get(a.id)?.health ?? 'unknown',
  }));

  return c.json(result);
});

accountRoutes.get('/accounts/:id', async (c) => {
  const id = c.req.param('id');
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  const row = rows[0] ?? null;
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

accountRoutes.put('/accounts/:id', async (c) => {
  const id = c.req.param('id');

  const existing = (await db.select().from(accounts).where(eq(accounts.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;

  const patch: Partial<typeof accounts.$inferInsert> = { updated_at: Date.now() };

  if ('name' in body && typeof body.name === 'string') patch.name = body.name;
  if ('industry' in body) patch.industry = body.industry as string | null;
  if ('state' in body) patch.state = body.state as string | null;
  if ('status' in body) patch.status = body.status as string | null;
  if ('fortune_500' in body) patch.fortune_500 = body.fortune_500 as boolean | null;
  if ('fortune_1000' in body) patch.fortune_1000 = body.fortune_1000 as boolean | null;
  if ('open_opps' in body) patch.open_opps = body.open_opps as number | null;
  if ('last_activity' in body) patch.last_activity = body.last_activity as string | null;
  if ('prior_context' in body) patch.prior_context = body.prior_context as string | null;
  if ('amount' in body) patch.amount = body.amount as number | null;
  if ('website' in body) patch.website = body.website as string | null;
  if ('linkedin_url' in body) patch.linkedin_url = body.linkedin_url as string | null;

  if (Object.keys(patch).length <= 1) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  await db.update(accounts).set(patch).where(eq(accounts.id, id));

  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  return c.json(rows[0]);
});
