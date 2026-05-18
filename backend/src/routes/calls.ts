import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/client';
import { calls, stakeholders, questions, pains, pain_sources } from '../db/schema';
import { parseFile } from '../lib/parseFile';
import { callClaude } from '../ai/client';
import { CALL_PARSE_SYSTEM, extractMetadata } from '../ai/prompts/parseCall';
import { fuzzyMatchName, fuzzyMatchText } from '../lib/fuzzyMatch';
import type { ParsedQuestion, ParsedPain } from '../ai/prompts/parseCall';

export const callRoutes = new Hono();

// ---- attendee seeding helper ----

type StakeholderRow = typeof stakeholders.$inferSelect;

async function seedAttendees(
  accountId: string,
  attendees: Array<{ name: string; title: string; company: string }>,
  existingStakeholders: StakeholderRow[]
): Promise<{ seeded: number; merged: number; updatedList: StakeholderRow[] }> {
  let seeded = 0;
  let merged = 0;
  const updated = [...existingStakeholders];

  for (const attendee of attendees) {
    if (!attendee.name.trim()) continue;

    const isMatch = fuzzyMatchName(attendee.name, updated.map(s => s.name)) !== null;
    if (isMatch) {
      merged++;
    } else {
      const now = Date.now();
      const rand = Math.random().toString(36).slice(2, 7);
      const id = `s-${accountId}-${now}-${rand}`;

      const row: typeof stakeholders.$inferInsert = {
        id,
        account_id: accountId,
        name: attendee.name.trim(),
        title: attendee.title || null,
        type: 'Unclassified',
        source: 'call-attendee',
        created_at: now,
        updated_at: now,
      };

      await db.insert(stakeholders).values(row);
      updated.push(row as StakeholderRow);
      seeded++;
    }
  }

  return { seeded, merged, updatedList: updated };
}

// ---- question seeding helpers ----

type QuestionRow = typeof questions.$inferSelect;

async function seedQuestions(
  accountId: string,
  callId: string,
  callDate: string | null,
  parsedQuestions: ParsedQuestion[],
  accountStakeholders: StakeholderRow[]
): Promise<number> {
  let seeded = 0;
  for (const pq of parsedQuestions) {
    if (!pq.asker_name.trim() || !pq.question_text.trim()) continue;
    const matchedStakeholder = fuzzyMatchName(pq.asker_name, accountStakeholders.map(s => s.name));
    const stakeholderId = matchedStakeholder
      ? (accountStakeholders.find(s => s.name === matchedStakeholder)?.id ?? null)
      : null;

    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    const id = `q-${accountId}-${now}-${rand}`;

    await db.insert(questions).values({
      id,
      account_id: accountId,
      call_id: callId,
      asker_name: pq.asker_name.trim(),
      asker_stakeholder_id: stakeholderId,
      question_text: pq.question_text.trim(),
      status: 'open',
      asked_at: callDate ?? null,
      created_at: now,
      updated_at: now,
    });
    seeded++;
  }
  return seeded;
}

async function reparseQuestions(
  accountId: string,
  callId: string,
  callDate: string | null,
  parsedQuestions: ParsedQuestion[],
  accountStakeholders: StakeholderRow[]
): Promise<{ inserted: number; preserved: number }> {
  const existingOnCall: QuestionRow[] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.call_id, callId), eq(questions.account_id, accountId)));

  const matchedExistingIds = new Set<string>();
  let inserted = 0;
  let preserved = 0;

  for (const pq of parsedQuestions) {
    if (!pq.asker_name.trim() || !pq.question_text.trim()) continue;

    const matchedText = fuzzyMatchText(
      pq.question_text,
      existingOnCall.filter(q => !matchedExistingIds.has(q.id)).map(q => q.question_text)
    );

    const existingMatch = matchedText
      ? existingOnCall.find(q => !matchedExistingIds.has(q.id) && q.question_text === matchedText)
      : null;

    const matchedStakeholder = fuzzyMatchName(pq.asker_name, accountStakeholders.map(s => s.name));
    const stakeholderId = matchedStakeholder
      ? (accountStakeholders.find(s => s.name === matchedStakeholder)?.id ?? null)
      : null;

    if (existingMatch) {
      matchedExistingIds.add(existingMatch.id);
      // Preserve status/resolution; update question_text and stakeholder link
      await db.update(questions).set({
        question_text: pq.question_text.trim(),
        asker_stakeholder_id: stakeholderId,
        updated_at: Date.now(),
      }).where(eq(questions.id, existingMatch.id));
      preserved++;
    } else {
      const now = Date.now();
      const rand = Math.random().toString(36).slice(2, 7);
      const id = `q-${accountId}-${now}-${rand}`;
      await db.insert(questions).values({
        id,
        account_id: accountId,
        call_id: callId,
        asker_name: pq.asker_name.trim(),
        asker_stakeholder_id: stakeholderId,
        question_text: pq.question_text.trim(),
        status: 'open',
        asked_at: callDate ?? null,
        created_at: now,
        updated_at: now,
      });
      inserted++;
    }
  }

  // Re-run stakeholder attribution on unmatched existing questions
  for (const eq_ of existingOnCall) {
    if (matchedExistingIds.has(eq_.id)) continue;
    const matchedStakeholder = fuzzyMatchName(eq_.asker_name, accountStakeholders.map(s => s.name));
    const stakeholderId = matchedStakeholder
      ? (accountStakeholders.find(s => s.name === matchedStakeholder)?.id ?? null)
      : null;
    if (stakeholderId !== eq_.asker_stakeholder_id) {
      await db.update(questions).set({
        asker_stakeholder_id: stakeholderId,
        updated_at: Date.now(),
      }).where(eq(questions.id, eq_.id));
    }
  }

  return { inserted, preserved };
}

// ---- pain seeding helpers ----

type PainRow = typeof pains.$inferSelect;
type PainSourceRow = typeof pain_sources.$inferSelect;

// Fuzzy-match a new pain summary against existing pains on this account.
// Use a higher threshold (0.75) than questions because pain summaries are short.
const PAIN_DEDUP_THRESHOLD = 0.75;

async function seedPains(
  accountId: string,
  callId: string,
  callDate: string | null,
  parsedPains: ParsedPain[],
  accountStakeholders: StakeholderRow[]
): Promise<number> {
  const existingPains: PainRow[] = await db
    .select()
    .from(pains)
    .where(eq(pains.account_id, accountId));

  let seeded = 0;

  for (const pp of parsedPains) {
    if (!pp.summary.trim() || !pp.quote.trim()) continue;

    // Try to match the incoming summary against all existing pain summaries on this account
    const matchedSummary = fuzzyMatchText(
      pp.summary,
      existingPains.map(p => p.summary),
      PAIN_DEDUP_THRESHOLD
    );
    const matchedPain = matchedSummary
      ? existingPains.find(p => p.summary === matchedSummary) ?? null
      : null;

    // Fuzzy-match voicer to a stakeholder
    const matchedStakeholderName = fuzzyMatchName(pp.voicer_name, accountStakeholders.map(s => s.name));
    const voicerStakeholderId = matchedStakeholderName
      ? (accountStakeholders.find(s => s.name === matchedStakeholderName)?.id ?? null)
      : null;

    const now = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 7);

    if (matchedPain) {
      // Pain already exists: add a new source, update last_heard_at if newer
      const sourceId = `ps-${callId}-${now}-${rand()}`;
      await db.insert(pain_sources).values({
        id: sourceId,
        pain_id: matchedPain.id,
        call_id: callId,
        voicer_name: pp.voicer_name.trim(),
        voicer_stakeholder_id: voicerStakeholderId,
        quote: pp.quote.trim(),
        confidence: pp.confidence,
        created_at: now,
      });

      if (callDate && (!matchedPain.last_heard_at || callDate > matchedPain.last_heard_at)) {
        await db.update(pains).set({ last_heard_at: callDate, updated_at: now })
          .where(eq(pains.id, matchedPain.id));
        // Keep in-memory list in sync
        matchedPain.last_heard_at = callDate;
      }
    } else {
      // New pain: insert pain row then source row
      const painId = `p-${accountId}-${now}-${rand()}`;
      const newPain: typeof pains.$inferInsert = {
        id: painId,
        account_id: accountId,
        summary: pp.summary.trim(),
        category: pp.category,
        confidence: pp.confidence,
        first_heard_at: callDate ?? null,
        last_heard_at: callDate ?? null,
        created_at: now,
        updated_at: now,
      };
      await db.insert(pains).values(newPain);
      existingPains.push(newPain as PainRow);

      const sourceId = `ps-${callId}-${now}-${rand()}`;
      await db.insert(pain_sources).values({
        id: sourceId,
        pain_id: painId,
        call_id: callId,
        voicer_name: pp.voicer_name.trim(),
        voicer_stakeholder_id: voicerStakeholderId,
        quote: pp.quote.trim(),
        confidence: pp.confidence,
        created_at: now,
      });

      seeded++;
    }
  }

  return seeded;
}

async function reparsePains(
  accountId: string,
  callId: string,
  callDate: string | null,
  parsedPains: ParsedPain[],
  accountStakeholders: StakeholderRow[]
): Promise<{ inserted: number; preserved: number }> {
  // Load all existing pain_sources for this call
  const existingSourcesOnCall: PainSourceRow[] = await db
    .select()
    .from(pain_sources)
    .where(eq(pain_sources.call_id, callId));

  // Load all existing pains for this account (for cross-call dedup)
  const existingPains: PainRow[] = await db
    .select()
    .from(pains)
    .where(eq(pains.account_id, accountId));

  const matchedSourceIds = new Set<string>();
  let inserted = 0;
  let preserved = 0;

  for (const pp of parsedPains) {
    if (!pp.summary.trim() || !pp.quote.trim()) continue;

    // First: try to match against an existing source on this call by quote similarity
    const unmatchedSources = existingSourcesOnCall.filter(s => !matchedSourceIds.has(s.id));
    const matchedQuote = fuzzyMatchText(pp.quote, unmatchedSources.map(s => s.quote), 0.6);
    const matchedSource = matchedQuote
      ? unmatchedSources.find(s => s.quote === matchedQuote) ?? null
      : null;

    const matchedStakeholderName = fuzzyMatchName(pp.voicer_name, accountStakeholders.map(s => s.name));
    const voicerStakeholderId = matchedStakeholderName
      ? (accountStakeholders.find(s => s.name === matchedStakeholderName)?.id ?? null)
      : null;

    const now = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 7);

    if (matchedSource) {
      // Update the existing source's fields; leave parent pain summary alone
      matchedSourceIds.add(matchedSource.id);
      await db.update(pain_sources).set({
        voicer_name: pp.voicer_name.trim(),
        voicer_stakeholder_id: voicerStakeholderId,
        quote: pp.quote.trim(),
        confidence: pp.confidence,
      }).where(eq(pain_sources.id, matchedSource.id));
      preserved++;
    } else {
      // New pain mention: run full upload logic (dedup against all account pains, create if needed)
      const matchedSummary = fuzzyMatchText(
        pp.summary,
        existingPains.map(p => p.summary),
        PAIN_DEDUP_THRESHOLD
      );
      const matchedPain = matchedSummary
        ? existingPains.find(p => p.summary === matchedSummary) ?? null
        : null;

      if (matchedPain) {
        const sourceId = `ps-${callId}-${now}-${rand()}`;
        await db.insert(pain_sources).values({
          id: sourceId,
          pain_id: matchedPain.id,
          call_id: callId,
          voicer_name: pp.voicer_name.trim(),
          voicer_stakeholder_id: voicerStakeholderId,
          quote: pp.quote.trim(),
          confidence: pp.confidence,
          created_at: now,
        });
        if (callDate && (!matchedPain.last_heard_at || callDate > matchedPain.last_heard_at)) {
          await db.update(pains).set({ last_heard_at: callDate, updated_at: now })
            .where(eq(pains.id, matchedPain.id));
          matchedPain.last_heard_at = callDate;
        }
      } else {
        const painId = `p-${accountId}-${now}-${rand()}`;
        const newPain: typeof pains.$inferInsert = {
          id: painId,
          account_id: accountId,
          summary: pp.summary.trim(),
          category: pp.category,
          confidence: pp.confidence,
          first_heard_at: callDate ?? null,
          last_heard_at: callDate ?? null,
          created_at: now,
          updated_at: now,
        };
        await db.insert(pains).values(newPain);
        existingPains.push(newPain as PainRow);

        const sourceId = `ps-${callId}-${now}-${rand()}`;
        await db.insert(pain_sources).values({
          id: sourceId,
          pain_id: painId,
          call_id: callId,
          voicer_name: pp.voicer_name.trim(),
          voicer_stakeholder_id: voicerStakeholderId,
          quote: pp.quote.trim(),
          confidence: pp.confidence,
          created_at: now,
        });
        inserted++;
      }
    }
  }

  // Recompute first/last heard for any pain that had sources on this call
  const touchedPainIds = new Set(existingSourcesOnCall.map(s => s.pain_id));
  for (const painId of touchedPainIds) {
    const allSources = await db
      .select({ call_id: pain_sources.call_id })
      .from(pain_sources)
      .where(eq(pain_sources.pain_id, painId));

    const callIds = allSources.map(s => s.call_id);
    if (callIds.length === 0) continue;

    // Fetch dates for all calls
    const callDates: string[] = [];
    for (const cid of callIds) {
      const row = existingPains.find(() => false); // placeholder
      void row;
      const callRow = (await db.select({ date: calls.date }).from(calls).where(eq(calls.id, cid)))[0];
      if (callRow?.date) callDates.push(callRow.date);
    }

    if (callDates.length > 0) {
      const sorted = [...callDates].sort();
      await db.update(pains).set({
        first_heard_at: sorted[0],
        last_heard_at: sorted[sorted.length - 1],
        updated_at: Date.now(),
      }).where(eq(pains.id, painId));
    }
  }

  return { inserted, preserved };
}

// ---- POST /api/accounts/:accountId/calls/upload ----

callRoutes.post('/accounts/:accountId/calls/upload', async (c) => {
  const accountId = c.req.param('accountId');

  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody({ all: true });
  } catch {
    return c.json({ error: 'Failed to parse multipart form data' }, 400);
  }

  const rawFiles = body['files'];
  let fileList: File[];
  if (Array.isArray(rawFiles)) {
    fileList = rawFiles.filter((f): f is File => f instanceof File);
  } else if (rawFiles instanceof File) {
    fileList = [rawFiles];
  } else {
    return c.json({ error: 'No files provided. Send files under the "files" field.' }, 400);
  }

  if (fileList.length === 0) {
    return c.json({ error: 'No valid files found in the upload.' }, 400);
  }

  if (fileList.length > 10) {
    return c.json({ error: 'Maximum 10 files per upload.' }, 400);
  }

  // Load existing stakeholders once; seedAttendees keeps this list updated between files
  let existingStakeholders = await db
    .select()
    .from(stakeholders)
    .where(eq(stakeholders.account_id, accountId));

  const results: Array<Record<string, unknown>> = [];

  for (const file of fileList) {
    const filename = file.name;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseFile(buffer, filename);

      const rawAiOutput = await callClaude({
        system: CALL_PARSE_SYSTEM,
        user: parsed.text,
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        timeoutMs: 120000,
      });

      const { plainText, metadata } = extractMetadata(rawAiOutput);

      const now = Date.now();
      const rand = Math.random().toString(36).slice(2, 7);
      const id = `call-${accountId}-${now}-${rand}`;

      const row: typeof calls.$inferInsert = {
        id,
        account_id: accountId,
        title: metadata.title || filename,
        date: metadata.date ?? null,
        summary: plainText,
        health: metadata.health ?? 'unknown',
        customer_attendees: JSON.stringify(metadata.customer_attendees ?? []),
        raw_transcript: parsed.text,
        source_file: filename,
        source_kind: parsed.kind,
        created_at: now,
        updated_at: now,
      };

      await db.insert(calls).values(row);

      const { seeded, merged, updatedList } = await seedAttendees(
        accountId,
        metadata.customer_attendees ?? [],
        existingStakeholders
      );
      existingStakeholders = updatedList;

      const questionsSeeded = await seedQuestions(
        accountId,
        id,
        metadata.date ?? null,
        metadata.questions ?? [],
        existingStakeholders
      );

      const painsSeeded = await seedPains(
        accountId,
        id,
        metadata.date ?? null,
        metadata.pains ?? [],
        existingStakeholders
      );

      const created = (await db.select().from(calls).where(eq(calls.id, id)))[0];
      results.push({ ok: true, filename, call: created, attendeesSeeded: seeded, attendeesMerged: merged, questionsSeeded, painsSeeded });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[calls/upload] failed for "${filename}":`, message);
      results.push({ ok: false, filename, error: message });
    }
  }

  const succeeded = results.filter(r => r['ok'] === true).length;
  const failed = results.filter(r => r['ok'] === false).length;

  return c.json({ results, summary: { succeeded, failed } });
});

// ---- GET /api/accounts/:accountId/calls ----

callRoutes.get('/accounts/:accountId/calls', async (c) => {
  const accountId = c.req.param('accountId');

  const rows = await db
    .select({
      id: calls.id,
      account_id: calls.account_id,
      title: calls.title,
      date: calls.date,
      summary: calls.summary,
      health: calls.health,
      health_reason: calls.health_reason,
      customer_attendees: calls.customer_attendees,
      source_file: calls.source_file,
      source_kind: calls.source_kind,
      created_at: calls.created_at,
      updated_at: calls.updated_at,
    })
    .from(calls)
    .where(eq(calls.account_id, accountId))
    .orderBy(desc(calls.date), desc(calls.created_at));

  return c.json(rows);
});

// ---- GET /api/calls/:id ----

callRoutes.get('/calls/:id', async (c) => {
  const id = c.req.param('id');
  const row = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// ---- PUT /api/calls/:id ----

callRoutes.put('/calls/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json() as Record<string, unknown>;
  const patch: Partial<typeof calls.$inferInsert> = { updated_at: Date.now() };

  if ('title' in body && typeof body.title === 'string') patch.title = body.title;
  if ('date' in body) {
    patch.date = typeof body.date === 'string' ? body.date : null;
  }
  if ('summary' in body && typeof body.summary === 'string') patch.summary = body.summary;
  if ('health' in body && typeof body.health === 'string') {
    const h = body.health.toLowerCase();
    if (h === 'green' || h === 'yellow' || h === 'red' || h === 'unknown') {
      patch.health = h;
    }
  }

  await db.update(calls).set(patch).where(eq(calls.id, id));
  const updated = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  return c.json(updated);
});

// ---- DELETE /api/calls/:id ----

callRoutes.delete('/calls/:id', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.delete(calls).where(eq(calls.id, id));
  return c.json({ success: true });
});

// ---- POST /api/calls/:id/reparse ----

callRoutes.post('/calls/:id/reparse', async (c) => {
  const id = c.req.param('id');
  const existing = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  if (!existing) return c.json({ error: 'Not found' }, 404);

  if (!existing.raw_transcript) {
    return c.json({ error: 'No raw transcript stored for this call. Cannot reparse.' }, 400);
  }

  const rawAiOutput = await callClaude({
    system: CALL_PARSE_SYSTEM,
    user: existing.raw_transcript,
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    timeoutMs: 120000,
  });

  const { plainText, metadata } = extractMetadata(rawAiOutput);

  const now = Date.now();
  await db.update(calls).set({
    title: metadata.title || existing.title,
    date: metadata.date ?? null,
    summary: plainText,
    health: metadata.health ?? 'unknown',
    customer_attendees: JSON.stringify(metadata.customer_attendees ?? []),
    updated_at: now,
  }).where(eq(calls.id, id));

  const existingStakeholders = await db
    .select()
    .from(stakeholders)
    .where(eq(stakeholders.account_id, existing.account_id));

  const { seeded, merged, updatedList } = await seedAttendees(
    existing.account_id,
    metadata.customer_attendees ?? [],
    existingStakeholders
  );

  const { inserted: questionsInserted, preserved: questionsPreserved } = await reparseQuestions(
    existing.account_id,
    id,
    metadata.date ?? null,
    metadata.questions ?? [],
    updatedList
  );

  const { inserted: painsInserted, preserved: painsPreserved } = await reparsePains(
    existing.account_id,
    id,
    metadata.date ?? null,
    metadata.pains ?? [],
    updatedList
  );

  const updated = (await db.select().from(calls).where(eq(calls.id, id)))[0];
  return c.json({ call: updated, attendeesSeeded: seeded, attendeesMerged: merged, questionsInserted, questionsPreserved, painsInserted, painsPreserved });
});
