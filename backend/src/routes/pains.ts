import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { pains, pain_sources, calls, stakeholders } from '../db/schema';

export const painRoutes = new Hono();

// GET /api/accounts/:accountId/pains
painRoutes.get('/accounts/:accountId/pains', async (c) => {
  const accountId = c.req.param('accountId');

  const rows = await db
    .select()
    .from(pains)
    .where(eq(pains.account_id, accountId));

  // For each pain, count sources and collect distinct voicers
  const enriched = await Promise.all(rows.map(async (pain) => {
    const sources = await db
      .select()
      .from(pain_sources)
      .where(eq(pain_sources.pain_id, pain.id));

    const mention_count = sources.length;

    // Distinct voicers: deduplicate by stakeholder_id when present, else by voicer_name
    const seen = new Set<string>();
    const voicers: Array<{ voicer_name: string; voicer_stakeholder_id: string | null }> = [];
    for (const s of sources) {
      const key = s.voicer_stakeholder_id ?? `name:${s.voicer_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        voicers.push({ voicer_name: s.voicer_name, voicer_stakeholder_id: s.voicer_stakeholder_id });
      }
    }

    return { ...pain, mention_count, voicers };
  }));

  // Sort: mention_count desc, then last_heard_at desc
  enriched.sort((a, b) => {
    if (b.mention_count !== a.mention_count) return b.mention_count - a.mention_count;
    const aDate = a.last_heard_at ?? '';
    const bDate = b.last_heard_at ?? '';
    return bDate < aDate ? -1 : bDate > aDate ? 1 : 0;
  });

  return c.json(enriched);
});

// GET /api/pains/:id
painRoutes.get('/pains/:id', async (c) => {
  const id = c.req.param('id');
  const pain = (await db.select().from(pains).where(eq(pains.id, id)))[0];
  if (!pain) return c.json({ error: 'Not found' }, 404);

  const sources = await db
    .select({
      id: pain_sources.id,
      pain_id: pain_sources.pain_id,
      call_id: pain_sources.call_id,
      voicer_name: pain_sources.voicer_name,
      voicer_stakeholder_id: pain_sources.voicer_stakeholder_id,
      quote: pain_sources.quote,
      confidence: pain_sources.confidence,
      created_at: pain_sources.created_at,
      call_title: calls.title,
      call_date: calls.date,
    })
    .from(pain_sources)
    .innerJoin(calls, eq(pain_sources.call_id, calls.id))
    .where(eq(pain_sources.pain_id, id));

  return c.json({ ...pain, sources });
});

// PUT /api/pains/:id
painRoutes.put('/pains/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pains).where(eq(pains.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const VALID_CATEGORIES = new Set(['nhi', 'agentic', 'compliance', 'operational', 'strategic']);
  const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
  const patch: Partial<typeof pains.$inferInsert> = { updated_at: Date.now() };

  if ('summary' in body && typeof body.summary === 'string' && body.summary.trim()) {
    patch.summary = body.summary.trim();
  }
  if ('category' in body && typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)) {
    patch.category = body.category;
  }
  if ('confidence' in body && typeof body.confidence === 'string' && VALID_CONFIDENCE.has(body.confidence)) {
    patch.confidence = body.confidence;
  }

  await db.update(pains).set(patch).where(eq(pains.id, id));
  const updated = (await db.select().from(pains).where(eq(pains.id, id)))[0];
  return c.json(updated);
});

// DELETE /api/pains/:id
painRoutes.delete('/pains/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pains).where(eq(pains.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  // FK-safe: delete sources first, then parent
  await db.delete(pain_sources).where(eq(pain_sources.pain_id, id));
  await db.delete(pains).where(eq(pains.id, id));
  return c.json({ success: true });
});

// POST /api/pains/:sourceId/merge  body: { targetId }
painRoutes.post('/pains/:sourceId/merge', async (c) => {
  const sourceId = c.req.param('sourceId');
  const body = await c.req.json() as { targetId?: string };
  const targetId = body.targetId;

  if (!targetId) return c.json({ error: 'targetId required' }, 400);
  if (sourceId === targetId) return c.json({ error: 'Cannot merge a pain into itself' }, 400);

  const source = (await db.select().from(pains).where(eq(pains.id, sourceId)))[0];
  if (!source) return c.json({ error: 'Source pain not found' }, 404);

  const target = (await db.select().from(pains).where(eq(pains.id, targetId)))[0];
  if (!target) return c.json({ error: 'Target pain not found' }, 404);

  if (source.account_id !== target.account_id) {
    return c.json({ error: 'Cannot merge pains from different accounts' }, 400);
  }

  // Re-point all source's pain_sources to the target
  await db
    .update(pain_sources)
    .set({ pain_id: targetId })
    .where(eq(pain_sources.pain_id, sourceId));

  // Update target's first/last heard dates to span both
  const minFirst = [source.first_heard_at, target.first_heard_at]
    .filter(Boolean)
    .sort()[0] ?? null;
  const maxLast = [source.last_heard_at, target.last_heard_at]
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  await db.update(pains).set({
    first_heard_at: minFirst,
    last_heard_at: maxLast,
    updated_at: Date.now(),
  }).where(eq(pains.id, targetId));

  // Delete the source pain (sources are already re-pointed)
  await db.delete(pains).where(eq(pains.id, sourceId));

  const updated = (await db.select().from(pains).where(eq(pains.id, targetId)))[0];
  return c.json(updated);
});
