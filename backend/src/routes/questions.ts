import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { questions, accounts, calls, stakeholders } from '../db/schema';

export const questionRoutes = new Hono();

// GET /api/accounts/:accountId/questions
questionRoutes.get('/accounts/:accountId/questions', async (c) => {
  const accountId = c.req.param('accountId');

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.account_id, accountId))
    .orderBy(asc(questions.asked_at), asc(questions.created_at));

  // Sort: open first, then answered/deferred; within each group by asked_at asc
  const STATUS_ORDER: Record<string, number> = { open: 0, deferred: 1, answered: 2 };
  rows.sort((a, b) => {
    const aRank = STATUS_ORDER[a.status ?? 'open'] ?? 0;
    const bRank = STATUS_ORDER[b.status ?? 'open'] ?? 0;
    if (aRank !== bRank) return aRank - bRank;
    const aDate = a.asked_at ?? '';
    const bDate = b.asked_at ?? '';
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
  });

  return c.json(rows);
});

// GET /api/questions/open  (all open questions across all accounts)
questionRoutes.get('/questions/open', async (c) => {
  const openQuestions = await db
    .select({
      id: questions.id,
      account_id: questions.account_id,
      call_id: questions.call_id,
      asker_name: questions.asker_name,
      asker_stakeholder_id: questions.asker_stakeholder_id,
      question_text: questions.question_text,
      status: questions.status,
      resolution_text: questions.resolution_text,
      resolution_call_id: questions.resolution_call_id,
      asked_at: questions.asked_at,
      resolved_at: questions.resolved_at,
      created_at: questions.created_at,
      updated_at: questions.updated_at,
      account_name: accounts.name,
      call_title: calls.title,
    })
    .from(questions)
    .innerJoin(accounts, eq(questions.account_id, accounts.id))
    .innerJoin(calls, eq(questions.call_id, calls.id))
    .where(eq(questions.status, 'open'))
    .orderBy(asc(questions.asked_at), asc(questions.created_at));

  return c.json(openQuestions);
});

// PUT /api/questions/:id
questionRoutes.put('/questions/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(questions).where(eq(questions.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const now = Date.now();
  const patch: Partial<typeof questions.$inferInsert> = { updated_at: now };

  if ('question_text' in body && typeof body.question_text === 'string' && body.question_text.trim()) {
    patch.question_text = body.question_text.trim();
  }
  if ('asker_name' in body && typeof body.asker_name === 'string' && body.asker_name.trim()) {
    patch.asker_name = body.asker_name.trim();
  }
  if ('asker_stakeholder_id' in body) {
    patch.asker_stakeholder_id = typeof body.asker_stakeholder_id === 'string'
      ? body.asker_stakeholder_id
      : null;
  }
  if ('resolution_text' in body) {
    patch.resolution_text = typeof body.resolution_text === 'string' ? body.resolution_text : null;
  }

  if ('status' in body && typeof body.status === 'string') {
    const s = body.status;
    if (s === 'open' || s === 'answered' || s === 'deferred') {
      patch.status = s;
      const wasOpen = existing.status === 'open';
      const movingToResolved = s === 'answered' || s === 'deferred';
      const movingToOpen = s === 'open';
      if (wasOpen && movingToResolved) {
        patch.resolved_at = new Date(now).toISOString();
      } else if (movingToOpen) {
        patch.resolved_at = null;
      }
    }
  }

  await db.update(questions).set(patch).where(eq(questions.id, id));
  const updated = (await db.select().from(questions).where(eq(questions.id, id)))[0];
  return c.json(updated);
});

// POST /api/questions/:id/link-stakeholder
questionRoutes.post('/questions/:id/link-stakeholder', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(questions).where(eq(questions.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as { stakeholderId?: string | null };
  const stakeholderId = body.stakeholderId ?? null;

  if (stakeholderId !== null) {
    const sh = (await db.select().from(stakeholders).where(eq(stakeholders.id, stakeholderId)))[0];
    if (!sh) return c.json({ error: 'Stakeholder not found' }, 404);
    if (sh.account_id !== existing.account_id) {
      return c.json({ error: 'Stakeholder does not belong to this account' }, 400);
    }
  }

  await db.update(questions)
    .set({ asker_stakeholder_id: stakeholderId, updated_at: Date.now() })
    .where(eq(questions.id, id));

  const updated = (await db.select().from(questions).where(eq(questions.id, id)))[0];
  return c.json(updated);
});

// DELETE /api/questions/:id
questionRoutes.delete('/questions/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(questions).where(eq(questions.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.delete(questions).where(eq(questions.id, id));
  return c.json({ success: true });
});
