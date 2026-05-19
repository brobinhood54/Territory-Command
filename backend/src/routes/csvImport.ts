import { Hono } from 'hono';
import Papa from 'papaparse';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { libsqlClient } from '../db/client';
import { detectColumnMapping } from '../lib/csvColumnMap';

export const csvImportRoutes = new Hono();

const DATA_DIR = resolve(process.cwd(), 'data');
const DB_PATH = resolve(DATA_DIR, 'tc.sqlite');
const BACKUPS_DIR = resolve(DATA_DIR, 'backups');
const PREVIEW_ROW_COUNT = 5;

csvImportRoutes.post('/csv-import/preview', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Failed to parse form data' }, 400);
  }

  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided under the "file" field.' }, 400);
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return c.json({ error: 'Could not read file contents.' }, 400);
  }

  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  if (parsed.data.length < 2) {
    return c.json({ error: 'CSV must have at least a header row and one data row.' }, 400);
  }

  const headers = parsed.data[0] as string[];
  const dataRows = (parsed.data as string[][]).slice(1);
  const mapping = detectColumnMapping(headers);

  return c.json({
    headers,
    previewRows: dataRows.slice(0, PREVIEW_ROW_COUNT),
    totalRows: dataRows.length,
    mapping,
  });
});

function parseBoolField(val: string | undefined | null): boolean | null {
  if (!val) return null;
  const v = val.trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1' || v === 'x') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return null;
}

function parseNumField(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function parseIntField(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = parseInt(val.replace(/[$,\s]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function makeId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
  const rand = Math.random().toString(36).slice(2, 6);
  return `a-${slug}-${rand}`;
}

interface AccountRow {
  id: string;
  name: string;
  sf_id: string | null;
  industry: string | null;
  state: string | null;
  status: string;
  fortune_500: boolean | null;
  fortune_1000: boolean | null;
  open_opps: number;
  amount: number | null;
  website: string | null;
  linkedin_url: string | null;
}

csvImportRoutes.post('/csv-import/commit', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Failed to parse form data' }, 400);
  }

  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided.' }, 400);
  }

  const mappingRaw = body['mapping'];
  if (typeof mappingRaw !== 'string') {
    return c.json({ error: 'No mapping provided.' }, 400);
  }

  let mapping: Record<string, string | null>;
  try {
    mapping = JSON.parse(mappingRaw) as Record<string, string | null>;
  } catch {
    return c.json({ error: 'Invalid mapping JSON.' }, 400);
  }

  const nameCol = mapping['name'];
  if (!nameCol) {
    return c.json({ error: 'Name column is not mapped.' }, 400);
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return c.json({ error: 'Could not read file contents.' }, 400);
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (rows.length === 0) {
    return c.json({ error: 'No data rows found in CSV.' }, 400);
  }

  // Build account rows before touching the DB so we catch bad data early.
  const now = Date.now();
  const accountRows: AccountRow[] = [];

  for (const row of rows) {
    const rawName = row[nameCol]?.trim();
    if (!rawName) continue;

    const sfIdCol = mapping['sf_id'];
    const rawSfId = sfIdCol ? row[sfIdCol]?.trim() || null : null;

    accountRows.push({
      id: makeId(rawName),
      name: rawName,
      sf_id: rawSfId,
      industry: mapping['industry'] ? row[mapping['industry']]?.trim() || null : null,
      state: mapping['state'] ? row[mapping['state']]?.trim() || null : null,
      status: (mapping['status'] ? row[mapping['status']]?.trim() : null) ?? 'Prospect',
      fortune_500: mapping['fortune_500'] ? parseBoolField(row[mapping['fortune_500']]) : null,
      fortune_1000: mapping['fortune_1000'] ? parseBoolField(row[mapping['fortune_1000']]) : null,
      open_opps: (mapping['open_opps'] ? parseIntField(row[mapping['open_opps']]) : null) ?? 0,
      amount: mapping['amount'] ? parseNumField(row[mapping['amount']]) : null,
      website: mapping['website'] ? row[mapping['website']]?.trim() || null : null,
      linkedin_url: mapping['linkedin_url'] ? row[mapping['linkedin_url']]?.trim() || null : null,
    });
  }

  if (accountRows.length === 0) {
    return c.json({ error: 'No valid account rows found (all rows were missing a name).' }, 400);
  }

  // Create pre-import snapshot before any writes.
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotFilename = `tc-pre-csv-import-${ts}.sqlite`;
  const snapshotPath = resolve(BACKUPS_DIR, snapshotFilename);
  try {
    await fs.copyFile(DB_PATH, snapshotPath);
  } catch (err) {
    console.error('[csv-import/commit] Snapshot failed:', err);
    return c.json({ error: 'Could not create pre-import snapshot. Import aborted.' }, 500);
  }

  // Atomic batch: cascade wipe all dependent tables, then insert fresh accounts.
  const statements: { sql: string; args?: unknown[] }[] = [
    { sql: 'DELETE FROM gameplans' },
    { sql: 'DELETE FROM pre_call_plans' },
    { sql: 'DELETE FROM pain_sources' },
    { sql: 'DELETE FROM pains' },
    { sql: 'DELETE FROM questions' },
    { sql: 'DELETE FROM calls' },
    { sql: 'DELETE FROM stakeholders' },
    { sql: 'DELETE FROM accounts' },
  ];

  for (const r of accountRows) {
    statements.push({
      sql: `INSERT INTO accounts
              (id, name, sf_id, industry, state, status,
               fortune_500, fortune_1000, open_opps, amount,
               website, linkedin_url, prior_context, archived,
               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id, r.name, r.sf_id, r.industry, r.state, r.status,
        r.fortune_500, r.fortune_1000, r.open_opps, r.amount,
        r.website, r.linkedin_url,
        '',  // prior_context
        0,   // archived
        now, now,
      ],
    });
  }

  try {
    await libsqlClient.batch(statements as Parameters<typeof libsqlClient.batch>[0]);
  } catch (err) {
    console.error('[csv-import/commit] Batch failed:', err);
    return c.json({
      error: err instanceof Error
        ? err.message
        : `Import batch failed. Restore from snapshot: ${snapshotFilename}`,
    }, 500);
  }

  return c.json({
    ok: true,
    accounts_inserted: accountRows.length,
    snapshot_path: `backend/data/backups/${snapshotFilename}`,
  });
});
