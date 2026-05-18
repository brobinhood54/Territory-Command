import { Hono } from 'hono';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { gameplans, accounts, stakeholders, calls, questions, pains, pain_sources } from '../db/schema';
import { callClaude } from '../ai/client';
import { GAMEPLAN_SYSTEM } from '../ai/prompts/gameplan';
import type { GameplanOutput } from '../ai/prompts/gameplan';

export const gameplanRoutes = new Hono();

// ---- JSON repair helper ----

function repairJson(raw: string): string {
  let s = raw.trim();
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // Find outermost braces
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s;
}

// ---- context builder ----

async function buildAccountDigest(accountId: string): Promise<{
  digest: string;
  signature: string;
}> {
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

  const openQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.account_id, accountId))
    .orderBy(asc(questions.asked_at));
  const openOnly = openQuestions.filter(q => q.status === 'open');

  const allPains = await db
    .select()
    .from(pains)
    .where(eq(pains.account_id, accountId));

  // For each pain, fetch top 3 sources by date
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
    painDetails.push({
      summary: pain.summary,
      category: pain.category,
      confidence: pain.confidence,
      sources,
    });
  }

  // Build signature
  const signature = `calls:${recentCalls.length}|questions:${openOnly.length}open|pains:${allPains.length}|stakeholders:${allStakeholders.length}`;

  // Build digest
  const lines: string[] = [];

  lines.push('## ACCOUNT');
  lines.push(`Name: ${account.name}`);
  if (account.industry) lines.push(`Industry: ${account.industry}`);
  if (account.status) lines.push(`Status: ${account.status}`);
  if (account.state) lines.push(`State: ${account.state}`);
  if (account.fortune_500) lines.push('Fortune 500: yes');
  else if (account.fortune_1000) lines.push('Fortune 1000: yes');
  if (account.open_opps) lines.push(`Open opps: ${account.open_opps}`);
  if (account.amount) lines.push(`Deal amount: $${account.amount.toLocaleString()}`);
  if (account.last_activity) lines.push(`Last activity: ${account.last_activity}`);
  if (account.prior_context) lines.push(`Prior context: ${account.prior_context}`);
  lines.push('');

  lines.push('## STAKEHOLDERS');
  if (allStakeholders.length === 0) {
    lines.push('None mapped yet.');
  } else {
    for (const s of allStakeholders) {
      const parts = [`[${s.id}] ${s.name}`];
      if (s.title) parts.push(s.title);
      if (s.type) parts.push(`type=${s.type}`);
      if (s.champion_confirmed) parts.push('champion=confirmed');
      if (s.temperature) parts.push(`temp=${s.temperature}`);
      if (s.priorities) parts.push(`priorities: ${s.priorities}`);
      if (s.notes) parts.push(`notes: ${s.notes}`);
      lines.push(parts.join(' | '));
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
  if (openOnly.length === 0) {
    lines.push('No open questions.');
  } else {
    for (const q of openOnly) {
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

  return { digest: lines.join('\n'), signature };
}

// ---- POST /api/accounts/:accountId/gameplans/generate ----

gameplanRoutes.post('/accounts/:accountId/gameplans/generate', async (c) => {
  const accountId = c.req.param('accountId');
  const started = Date.now();

  let digest: string;
  let signature: string;
  try {
    const result = await buildAccountDigest(accountId);
    digest = result.digest;
    signature = result.signature;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Account not found') return c.json({ error: 'Account not found' }, 404);
    return c.json({ error: `Failed to build account digest: ${msg}` }, 500);
  }

  const model = 'claude-opus-4-7';
  let rawOutput: string;
  try {
    rawOutput = await callClaude({
      system: GAMEPLAN_SYSTEM,
      user: digest,
      model,
      maxTokens: 8192,
      timeoutMs: 300000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Opus call failed: ${msg}` }, 500);
  }

  // Parse JSON, with one repair attempt
  let parsed: GameplanOutput;
  try {
    parsed = JSON.parse(rawOutput) as GameplanOutput;
  } catch {
    const repaired = repairJson(rawOutput);
    try {
      parsed = JSON.parse(repaired) as GameplanOutput;
    } catch {
      return c.json({
        error: 'Opus returned output that could not be parsed as JSON after repair attempt.',
        raw: rawOutput,
      }, 500);
    }
  }

  const latencyMs = Date.now() - started;
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  const id = `gp-${accountId}-${now}-${rand}`;

  await db.insert(gameplans).values({
    id,
    account_id: accountId,
    content: JSON.stringify(parsed),
    model_used: model,
    generated_at: now,
    generated_with_data_signature: signature,
    latency_ms: latencyMs,
    // input_tokens and output_tokens: callClaude logs them but doesn't return them
    // We'll add a rough estimate via character count; exact counts require SDK changes
    input_tokens: null,
    output_tokens: null,
  });

  // Enforce 5-version cap: delete oldest if total > 5
  const allForAccount = await db
    .select({ id: gameplans.id, generated_at: gameplans.generated_at })
    .from(gameplans)
    .where(eq(gameplans.account_id, accountId))
    .orderBy(asc(gameplans.generated_at));

  if (allForAccount.length > 5) {
    const toDelete = allForAccount.slice(0, allForAccount.length - 5);
    for (const row of toDelete) {
      await db.delete(gameplans).where(eq(gameplans.id, row.id));
    }
  }

  const inserted = (await db.select().from(gameplans).where(eq(gameplans.id, id)))[0];
  return c.json(inserted);
});

// ---- GET /api/accounts/:accountId/gameplans ----

gameplanRoutes.get('/accounts/:accountId/gameplans', async (c) => {
  const accountId = c.req.param('accountId');
  const rows = await db
    .select({
      id: gameplans.id,
      account_id: gameplans.account_id,
      model_used: gameplans.model_used,
      generated_at: gameplans.generated_at,
      latency_ms: gameplans.latency_ms,
      input_tokens: gameplans.input_tokens,
      output_tokens: gameplans.output_tokens,
      generated_with_data_signature: gameplans.generated_with_data_signature,
    })
    .from(gameplans)
    .where(eq(gameplans.account_id, accountId))
    .orderBy(desc(gameplans.generated_at));
  return c.json(rows);
});

// ---- GET /api/gameplans/:id ----

gameplanRoutes.get('/gameplans/:id', async (c) => {
  const id = c.req.param('id');
  const row = (await db.select().from(gameplans).where(eq(gameplans.id, id)))[0];
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// ---- DELETE /api/gameplans/:id ----

gameplanRoutes.delete('/gameplans/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(gameplans).where(eq(gameplans.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);
  await db.delete(gameplans).where(eq(gameplans.id, id));
  return c.json({ success: true });
});
