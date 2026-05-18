import { Hono } from 'hono';
import { eq, and, isNull, ne, desc, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { pre_call_plans, accounts, stakeholders, calls, questions, pains, pain_sources } from '../db/schema';
import { callClaude } from '../ai/client';
import { PRE_CALL_PLAN_SYSTEM } from '../ai/prompts/preCallPlan';
import type { PreCallPlanContent } from '../ai/prompts/preCallPlan';

export const preCallPlanRoutes = new Hono();

// ---- JSON repair helper (same pattern as gameplans.ts) ----

function repairJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s;
}

// ---- account context builder for pre-call plans ----

async function buildPlanDigest(accountId: string, plan: typeof pre_call_plans.$inferSelect): Promise<string> {
  const account = (await db.select().from(accounts).where(eq(accounts.id, accountId)))[0];
  if (!account) throw new Error('Account not found');

  const allStakeholders = await db
    .select()
    .from(stakeholders)
    .where(eq(stakeholders.account_id, accountId));

  const recentCalls = await db
    .select()
    .from(calls)
    .where(eq(calls.account_id, accountId))
    .orderBy(desc(calls.date), desc(calls.created_at))
    .limit(10);

  const openQuestions = (await db
    .select()
    .from(questions)
    .where(eq(questions.account_id, accountId))
    .orderBy(asc(questions.asked_at)))
    .filter(q => q.status === 'open');

  const allPains = await db
    .select()
    .from(pains)
    .where(eq(pains.account_id, accountId));

  const painDetails: Array<{
    summary: string;
    category: string;
    confidence: string;
    sources: Array<{ voicer_name: string; quote: string; call_title: string | null; call_date: string | null }>;
  }> = [];
  for (const pain of allPains) {
    const sources = await db
      .select({
        voicer_name: pain_sources.voicer_name,
        quote: pain_sources.quote,
        call_title: calls.title,
        call_date: calls.date,
      })
      .from(pain_sources)
      .innerJoin(calls, eq(pain_sources.call_id, calls.id))
      .where(eq(pain_sources.pain_id, pain.id))
      .orderBy(desc(calls.date))
      .limit(3);
    painDetails.push({ summary: pain.summary, category: pain.category, confidence: pain.confidence, sources });
  }

  // Resolve attendee stakeholder ids to names + profiles
  let attendeeIds: string[] = [];
  try {
    attendeeIds = plan.attendee_stakeholder_ids ? JSON.parse(plan.attendee_stakeholder_ids) as string[] : [];
  } catch {
    attendeeIds = [];
  }
  const attendeeStakeholders = allStakeholders.filter(s => attendeeIds.includes(s.id));
  const additionalNames = plan.additional_attendees
    ? plan.additional_attendees.split(',').map(n => n.trim()).filter(Boolean)
    : [];

  const lines: string[] = [];

  lines.push('## ACCOUNT');
  lines.push(`Name: ${account.name}`);
  if (account.industry) lines.push(`Industry: ${account.industry}`);
  if (account.status) lines.push(`Status: ${account.status}`);
  if (account.fortune_500) lines.push('Fortune 500: yes');
  else if (account.fortune_1000) lines.push('Fortune 1000: yes');
  if (account.open_opps) lines.push(`Open opps: ${account.open_opps}`);
  if (account.amount) lines.push(`Deal amount: $${account.amount.toLocaleString()}`);
  if (account.prior_context) lines.push(`Prior context: ${account.prior_context}`);
  lines.push('');

  lines.push('## THIS MEETING');
  lines.push(`Title: ${plan.title}`);
  lines.push(`Type: ${plan.meeting_type}`);
  if (plan.planned_date) lines.push(`Planned date: ${plan.planned_date}`);
  if (plan.goal) lines.push(`Goal (user-provided): ${plan.goal}`);
  lines.push('');

  lines.push('## MEETING ATTENDEES (from stakeholder map)');
  if (attendeeStakeholders.length === 0) {
    lines.push('None selected from the stakeholder map.');
  } else {
    for (const s of attendeeStakeholders) {
      const parts = [`[${s.id}] ${s.name}`];
      if (s.title) parts.push(s.title);
      if (s.type) parts.push(`type=${s.type}`);
      if (s.champion_confirmed) parts.push('champion=confirmed');
      if (s.temperature) parts.push(`temp=${s.temperature}`);
      if (s.priorities) parts.push(`priorities: ${s.priorities}`);
      if (s.messaging) parts.push(`messaging: ${s.messaging}`);
      if (s.notes) parts.push(`notes: ${s.notes}`);
      lines.push(parts.join(' | '));
    }
  }
  if (additionalNames.length > 0) {
    lines.push('');
    lines.push('## ADDITIONAL ATTENDEES (not in stakeholder map)');
    for (const name of additionalNames) {
      lines.push(`- ${name}`);
    }
  }
  lines.push('');

  lines.push('## RECENT CALLS (last 10, newest first)');
  if (recentCalls.length === 0) {
    lines.push('No calls logged yet.');
  } else {
    for (const c of recentCalls) {
      lines.push(`### ${c.title ?? 'Untitled'} (${c.date ?? 'no date'}) health=${c.health ?? 'unknown'}`);
      if (c.summary) lines.push(c.summary);
      lines.push('');
    }
  }

  lines.push('## OPEN QUESTIONS');
  if (openQuestions.length === 0) {
    lines.push('No open questions.');
  } else {
    for (const q of openQuestions) {
      lines.push(`- [${q.asker_name}] ${q.question_text} (asked ${q.asked_at ?? 'unknown date'})`);
    }
  }
  lines.push('');

  lines.push('## PAIN POINTS');
  if (painDetails.length === 0) {
    lines.push('No pain points extracted yet.');
  } else {
    for (const p of painDetails) {
      lines.push(`### [${p.category.toUpperCase()}] ${p.summary} (confidence=${p.confidence})`);
      for (const src of p.sources) {
        lines.push(`  - ${src.voicer_name} in "${src.call_title ?? 'unknown call'}" (${src.call_date ?? '?'}): "${src.quote}"`);
      }
    }
  }

  return lines.join('\n');
}

// ---- POST /api/accounts/:accountId/pre-call-plans ----

preCallPlanRoutes.post('/accounts/:accountId/pre-call-plans', async (c) => {
  const accountId = c.req.param('accountId');
  const body = await c.req.json() as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return c.json({ error: 'title is required' }, 400);

  const meeting_type = typeof body.meeting_type === 'string' ? body.meeting_type : 'other';
  const planned_date = typeof body.planned_date === 'string' ? body.planned_date : null;
  const goal = typeof body.goal === 'string' ? body.goal.trim() : null;
  const attendee_stakeholder_ids = Array.isArray(body.attendee_stakeholder_ids)
    ? JSON.stringify(body.attendee_stakeholder_ids)
    : '[]';
  const additional_attendees = typeof body.additional_attendees === 'string'
    ? body.additional_attendees.trim()
    : null;

  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const id = `pcp-${accountId}-${now}-${rand}`;

  await db.insert(pre_call_plans).values({
    id,
    account_id: accountId,
    title,
    meeting_type,
    planned_date,
    goal,
    attendee_stakeholder_ids,
    additional_attendees,
    content: null,
    status: 'draft',
    linked_call_id: null,
    generated_at: null,
    model_used: null,
    input_tokens: null,
    output_tokens: null,
    latency_ms: null,
    created_at: now,
    updated_at: now,
  });

  const inserted = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  return c.json(inserted, 201);
});

// ---- POST /api/pre-call-plans/:id/generate ----

preCallPlanRoutes.post('/pre-call-plans/:id/generate', async (c) => {
  const id = c.req.param('id');
  const plan = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!plan) return c.json({ error: 'Not found' }, 404);

  let digest: string;
  try {
    digest = await buildPlanDigest(plan.account_id, plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Failed to build account digest: ${msg}` }, 500);
  }

  const started = Date.now();
  const model = 'claude-sonnet-4-6';
  let rawOutput: string;
  try {
    rawOutput = await callClaude({
      system: PRE_CALL_PLAN_SYSTEM,
      user: digest,
      model,
      maxTokens: 4000,
      timeoutMs: 120000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Sonnet call failed: ${msg}` }, 500);
  }

  let parsed: PreCallPlanContent;
  try {
    parsed = JSON.parse(rawOutput) as PreCallPlanContent;
  } catch {
    const repaired = repairJson(rawOutput);
    try {
      parsed = JSON.parse(repaired) as PreCallPlanContent;
    } catch {
      return c.json({
        error: 'Sonnet returned output that could not be parsed as JSON after repair attempt.',
        raw: rawOutput,
      }, 500);
    }
  }

  const latencyMs = Date.now() - started;
  const now = Date.now();

  await db.update(pre_call_plans).set({
    content: JSON.stringify(parsed),
    status: 'generated',
    generated_at: now,
    model_used: model,
    latency_ms: latencyMs,
    updated_at: now,
  }).where(eq(pre_call_plans.id, id));

  const updated = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  return c.json(updated);
});

// ---- GET /api/accounts/:accountId/pre-call-plans ----

preCallPlanRoutes.get('/accounts/:accountId/pre-call-plans', async (c) => {
  const accountId = c.req.param('accountId');

  const rows = await db
    .select({
      id: pre_call_plans.id,
      account_id: pre_call_plans.account_id,
      title: pre_call_plans.title,
      meeting_type: pre_call_plans.meeting_type,
      planned_date: pre_call_plans.planned_date,
      goal: pre_call_plans.goal,
      attendee_stakeholder_ids: pre_call_plans.attendee_stakeholder_ids,
      additional_attendees: pre_call_plans.additional_attendees,
      status: pre_call_plans.status,
      linked_call_id: pre_call_plans.linked_call_id,
      generated_at: pre_call_plans.generated_at,
      model_used: pre_call_plans.model_used,
      input_tokens: pre_call_plans.input_tokens,
      output_tokens: pre_call_plans.output_tokens,
      latency_ms: pre_call_plans.latency_ms,
      created_at: pre_call_plans.created_at,
      updated_at: pre_call_plans.updated_at,
    })
    .from(pre_call_plans)
    .where(eq(pre_call_plans.account_id, accountId))
    .orderBy(desc(pre_call_plans.planned_date), asc(pre_call_plans.status));

  return c.json(rows);
});

// ---- GET /api/pre-call-plans/:id ----

preCallPlanRoutes.get('/pre-call-plans/:id', async (c) => {
  const id = c.req.param('id');
  const row = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// ---- PUT /api/pre-call-plans/:id ----

preCallPlanRoutes.put('/pre-call-plans/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const patch: Partial<typeof pre_call_plans.$inferInsert> = { updated_at: Date.now() };

  if ('title' in body && typeof body.title === 'string') patch.title = body.title.trim();
  if ('meeting_type' in body && typeof body.meeting_type === 'string') patch.meeting_type = body.meeting_type;
  if ('planned_date' in body) patch.planned_date = typeof body.planned_date === 'string' ? body.planned_date : null;
  if ('goal' in body) patch.goal = typeof body.goal === 'string' ? body.goal.trim() : null;
  if ('attendee_stakeholder_ids' in body && Array.isArray(body.attendee_stakeholder_ids)) {
    patch.attendee_stakeholder_ids = JSON.stringify(body.attendee_stakeholder_ids);
  }
  if ('additional_attendees' in body) {
    patch.additional_attendees = typeof body.additional_attendees === 'string' ? body.additional_attendees.trim() : null;
  }

  await db.update(pre_call_plans).set(patch).where(eq(pre_call_plans.id, id));
  const updated = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  return c.json(updated);
});

// ---- DELETE /api/pre-call-plans/:id ----

preCallPlanRoutes.delete('/pre-call-plans/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(pre_call_plans).where(eq(pre_call_plans.id, id));
  return c.json({ success: true });
});

// ---- POST /api/pre-call-plans/:id/link-call ----

preCallPlanRoutes.post('/pre-call-plans/:id/link-call', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const callId = typeof body.callId === 'string' ? body.callId : null;
  if (!callId) return c.json({ error: 'callId is required' }, 400);

  await db.update(pre_call_plans).set({
    linked_call_id: callId,
    status: 'completed',
    updated_at: Date.now(),
  }).where(eq(pre_call_plans.id, id));

  const updated = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  return c.json(updated);
});

// ---- POST /api/pre-call-plans/:id/unlink-call ----

preCallPlanRoutes.post('/pre-call-plans/:id/unlink-call', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const newStatus = existing.content ? 'generated' : 'draft';

  await db.update(pre_call_plans).set({
    linked_call_id: null,
    status: newStatus,
    updated_at: Date.now(),
  }).where(eq(pre_call_plans.id, id));

  const updated = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, id)))[0];
  return c.json(updated);
});

// ---- auto-link helper (called from calls upload) ----

import { fuzzyMatchName } from '../lib/fuzzyMatch';

export async function autoLinkPreCallPlans(
  accountId: string,
  callId: string,
  callDate: string | null,
  callCustomerAttendees: Array<{ name: string; title: string; company: string }>,
  callStakeholderIds: string[]
): Promise<Array<typeof pre_call_plans.$inferSelect>> {
  if (!callDate) return [];

  const candidates = await db
    .select()
    .from(pre_call_plans)
    .where(
      and(
        eq(pre_call_plans.account_id, accountId),
        isNull(pre_call_plans.linked_call_id),
        ne(pre_call_plans.status, 'completed')
      )
    );

  const linked: Array<typeof pre_call_plans.$inferSelect> = [];

  interface ScoredCandidate {
    plan: typeof pre_call_plans.$inferSelect;
    dateDiff: number;
    overlap: number;
  }

  const qualified: ScoredCandidate[] = [];

  for (const plan of candidates) {
    if (!plan.planned_date) continue;

    // Date proximity: within +/- 7 days
    const callMs = new Date(callDate).getTime();
    const planMs = new Date(plan.planned_date).getTime();
    const diffDays = Math.abs((callMs - planMs) / 86400000);
    if (diffDays > 7) continue;

    // Attendee overlap: plan stakeholder ids vs call stakeholder ids
    let planIds: string[] = [];
    try {
      planIds = plan.attendee_stakeholder_ids ? JSON.parse(plan.attendee_stakeholder_ids) as string[] : [];
    } catch {
      planIds = [];
    }

    const additionalNames = plan.additional_attendees
      ? plan.additional_attendees.split(',').map(n => n.trim()).filter(Boolean)
      : [];

    const totalPlanAttendees = planIds.length + additionalNames.length;
    if (totalPlanAttendees === 0) continue;

    let matchCount = 0;
    let strongFuzzyMatch = false;

    // Check stakeholder id overlap
    for (const pid of planIds) {
      if (callStakeholderIds.includes(pid)) matchCount++;
    }

    // Check additional attendee name fuzzy matches against call attendee names
    const callAttendeeNames = callCustomerAttendees.map(a => a.name);
    for (const addName of additionalNames) {
      const match = fuzzyMatchName(addName, callAttendeeNames);
      if (match) {
        matchCount++;
        if (additionalNames.length === 1) strongFuzzyMatch = true;
      }
    }

    const overlapFraction = matchCount / totalPlanAttendees;

    if (overlapFraction >= 0.5 || strongFuzzyMatch) {
      qualified.push({ plan, dateDiff: diffDays, overlap: overlapFraction });
    }
  }

  if (qualified.length === 0) return [];

  // Pick the plan with the closest planned_date; break ties by overlap
  qualified.sort((a, b) => a.dateDiff - b.dateDiff || b.overlap - a.overlap);
  const best = qualified[0];

  const now = Date.now();
  await db.update(pre_call_plans).set({
    linked_call_id: callId,
    status: 'completed',
    updated_at: now,
  }).where(eq(pre_call_plans.id, best.plan.id));

  const updated = (await db.select().from(pre_call_plans).where(eq(pre_call_plans.id, best.plan.id)))[0];
  linked.push(updated);

  return linked;
}
