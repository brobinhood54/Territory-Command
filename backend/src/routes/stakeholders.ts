import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { stakeholders } from '../db/schema';

export const stakeholderRoutes = new Hono();

// Type rank for ordering (lower = higher priority)
const TYPE_RANK: Record<string, number> = {
  'Economic Buyer': 1,
  'Champion': 2,
  'Technical Evaluator': 3,
  'Influencer': 4,
  'Blocker/Skeptic': 5,
  'Unclassified': 6,
};

const TEMP_RANK: Record<string, number> = {
  hot: 1,
  warm: 2,
  cold: 3,
  gone_dark: 4,
};

// GET /api/accounts/:accountId/stakeholders
stakeholderRoutes.get('/accounts/:accountId/stakeholders', async (c) => {
  const accountId = c.req.param('accountId');
  const rows = await db
    .select()
    .from(stakeholders)
    .where(eq(stakeholders.account_id, accountId));

  rows.sort((a, b) => {
    const aRank = TYPE_RANK[a.type ?? 'Unclassified'] ?? 6;
    const bRank = TYPE_RANK[b.type ?? 'Unclassified'] ?? 6;
    if (aRank !== bRank) return aRank - bRank;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return c.json(rows);
});

// POST /api/accounts/:accountId/stakeholders
stakeholderRoutes.post('/accounts/:accountId/stakeholders', async (c) => {
  const accountId = c.req.param('accountId');
  const body = await c.req.json() as Record<string, unknown>;

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'name is required' }, 400);
  }

  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const id = `s-${accountId}-${now}-${rand}`;

  const row: typeof stakeholders.$inferInsert = {
    id,
    account_id: accountId,
    name: body.name.trim(),
    title: typeof body.title === 'string' ? body.title : null,
    type: typeof body.type === 'string' ? body.type : 'Unclassified',
    champion_confirmed: typeof body.championConfirmed === 'boolean' ? body.championConfirmed : false,
    linkedin_url: typeof body.linkedinUrl === 'string' ? body.linkedinUrl : null,
    email: typeof body.email === 'string' ? body.email.toLowerCase() : null,
    priorities: typeof body.priorities === 'string' ? body.priorities : null,
    messaging: typeof body.messaging === 'string' ? body.messaging : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    temperature: typeof body.temperature === 'string' ? body.temperature : 'warm',
    last_touched: typeof body.lastTouched === 'string' ? body.lastTouched : null,
    source: 'manual',
    created_at: now,
    updated_at: now,
  };

  await db.insert(stakeholders).values(row);
  const created = (await db.select().from(stakeholders).where(eq(stakeholders.id, id)))[0];
  return c.json(created, 201);
});

// PUT /api/stakeholders/:id
stakeholderRoutes.put('/stakeholders/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(stakeholders).where(eq(stakeholders.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const patch: Partial<typeof stakeholders.$inferInsert> = { updated_at: Date.now() };

  if ('name' in body && typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if ('title' in body) patch.title = body.title as string | null;
  if ('type' in body) patch.type = body.type as string | null;
  if ('championConfirmed' in body) patch.champion_confirmed = body.championConfirmed as boolean;
  if ('email' in body) {
    patch.email = typeof body.email === 'string' ? body.email.toLowerCase() : null;
  }
  if ('linkedinUrl' in body) patch.linkedin_url = body.linkedinUrl as string | null;
  if ('priorities' in body) patch.priorities = body.priorities as string | null;
  if ('messaging' in body) patch.messaging = body.messaging as string | null;
  if ('notes' in body) patch.notes = body.notes as string | null;
  if ('temperature' in body) patch.temperature = body.temperature as string | null;
  if ('lastTouched' in body) patch.last_touched = body.lastTouched as string | null;

  await db.update(stakeholders).set(patch).where(eq(stakeholders.id, id));
  const updated = (await db.select().from(stakeholders).where(eq(stakeholders.id, id)))[0];
  return c.json(updated);
});

// DELETE /api/stakeholders/:id
stakeholderRoutes.delete('/stakeholders/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(stakeholders).where(eq(stakeholders.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.delete(stakeholders).where(eq(stakeholders.id, id));
  return c.json({ success: true });
});

// POST /api/stakeholders/:sourceId/merge  body: { targetId }
stakeholderRoutes.post('/stakeholders/:sourceId/merge', async (c) => {
  const sourceId = c.req.param('sourceId');
  const body = await c.req.json() as { targetId?: string };

  if (!body.targetId) return c.json({ error: 'targetId is required' }, 400);
  const targetId = body.targetId;

  const [source, target] = await Promise.all([
    db.select().from(stakeholders).where(eq(stakeholders.id, sourceId)).then(r => r[0]),
    db.select().from(stakeholders).where(eq(stakeholders.id, targetId)).then(r => r[0]),
  ]);

  if (!source) return c.json({ error: 'Source not found' }, 404);
  if (!target) return c.json({ error: 'Target not found' }, 404);
  if (source.account_id !== target.account_id) {
    return c.json({ error: 'Stakeholders must belong to the same account' }, 400);
  }

  function longer(a: string | null, b: string | null): string | null {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    return a.length >= b.length ? a : b;
  }

  // For notes: concatenate if both have content and differ
  let mergedNotes: string | null;
  if (source.notes && target.notes && source.notes.trim() !== target.notes.trim()) {
    mergedNotes = `${target.notes}\n\n--- merged from previous entry ---\n\n${source.notes}`;
  } else {
    mergedNotes = longer(target.notes, source.notes);
  }

  const sourceTypeRank = TYPE_RANK[source.type ?? 'Unclassified'] ?? 6;
  const targetTypeRank = TYPE_RANK[target.type ?? 'Unclassified'] ?? 6;
  const mergedType = sourceTypeRank < targetTypeRank ? source.type : target.type;

  const sourceTempRank = TEMP_RANK[source.temperature ?? 'gone_dark'] ?? 4;
  const targetTempRank = TEMP_RANK[target.temperature ?? 'gone_dark'] ?? 4;
  const mergedTemp = sourceTempRank < targetTempRank ? source.temperature : target.temperature;

  const sourceLT = source.last_touched ?? '';
  const targetLT = target.last_touched ?? '';
  const mergedLastTouched = sourceLT > targetLT ? sourceLT : targetLT || null;

  const patch: Partial<typeof stakeholders.$inferInsert> = {
    name: longer(target.name, source.name) ?? target.name,
    title: longer(target.title, source.title),
    type: mergedType,
    champion_confirmed: (source.champion_confirmed ?? false) || (target.champion_confirmed ?? false),
    email: longer(target.email, source.email),
    linkedin_url: longer(target.linkedin_url, source.linkedin_url),
    priorities: longer(target.priorities, source.priorities),
    messaging: longer(target.messaging, source.messaging),
    notes: mergedNotes,
    temperature: mergedTemp,
    last_touched: mergedLastTouched || null,
    updated_at: Date.now(),
  };

  await db.update(stakeholders).set(patch).where(eq(stakeholders.id, targetId));
  await db.delete(stakeholders).where(eq(stakeholders.id, sourceId));

  const merged = (await db.select().from(stakeholders).where(eq(stakeholders.id, targetId)))[0];
  return c.json(merged);
});
