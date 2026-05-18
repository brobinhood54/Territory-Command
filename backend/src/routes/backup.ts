import { Hono } from 'hono';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { db, libsqlClient } from '../db/client';
import { accounts, stakeholders, calls } from '../db/schema';

export const backupRoutes = new Hono();

const DATA_DIR = resolve(process.cwd(), 'data');
const DB_PATH = resolve(DATA_DIR, 'tc.sqlite');
const BACKUPS_DIR = resolve(DATA_DIR, 'backups');

function isoTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ---- GET /api/export ----

backupRoutes.get('/export', async (c) => {
  const [allAccounts, allStakeholders, allCalls] = await Promise.all([
    db.select().from(accounts),
    db.select().from(stakeholders),
    db.select().from(calls),
  ]);

  const ts = new Date().toISOString();
  const fileTs = ts.replace(/[:.]/g, '-').replace('T', '-').slice(0, 19);
  const filename = `territory-command-backup-${fileTs}.json`;

  const bundle = {
    tc_format_version: 1,
    exported_at: ts,
    accounts: allAccounts,
    stakeholders: allStakeholders,
    calls: allCalls,
  };

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// ---- POST /api/import ----

backupRoutes.post('/import', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Failed to parse multipart form data' }, 400);
  }

  const file = body['file'];
  if (!(file instanceof File)) {
    return c.json({ error: 'No file provided. Send JSON under the "file" field.' }, 400);
  }

  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return c.json({ error: 'Could not read file contents.' }, 400);
  }

  let bundle: unknown;
  try {
    bundle = JSON.parse(raw);
  } catch {
    return c.json({ error: 'File is not valid JSON.' }, 400);
  }

  if (typeof bundle !== 'object' || bundle === null) {
    return c.json({ error: 'File must be a JSON object.' }, 400);
  }

  const b = bundle as Record<string, unknown>;

  if (!('tc_format_version' in b)) {
    return c.json({ error: 'Missing tc_format_version. This file was not exported by Territory Command.' }, 400);
  }

  if (b['tc_format_version'] !== 1) {
    return c.json({
      error: `Unsupported format version ${b['tc_format_version']}, this app expects version 1.`,
    }, 400);
  }

  if (!Array.isArray(b['accounts'])) return c.json({ error: 'Missing or invalid "accounts" array.' }, 400);
  if (!Array.isArray(b['stakeholders'])) return c.json({ error: 'Missing or invalid "stakeholders" array.' }, 400);
  if (!Array.isArray(b['calls'])) return c.json({ error: 'Missing or invalid "calls" array.' }, 400);

  const importAccounts = b['accounts'] as Record<string, unknown>[];
  const importStakeholders = b['stakeholders'] as Record<string, unknown>[];
  const importCalls = b['calls'] as Record<string, unknown>[];

  for (const row of importAccounts) {
    if (typeof row['id'] !== 'string' || !row['id']) {
      return c.json({ error: `Account row is missing required field "id".` }, 400);
    }
    if (typeof row['name'] !== 'string' || !row['name']) {
      return c.json({ error: `Account row "${row['id']}" is missing required field "name".` }, 400);
    }
  }

  for (const row of importStakeholders) {
    if (typeof row['id'] !== 'string' || !row['id']) {
      return c.json({ error: `Stakeholder row is missing required field "id".` }, 400);
    }
    if (typeof row['account_id'] !== 'string' || !row['account_id']) {
      return c.json({ error: `Stakeholder row "${row['id']}" is missing required field "account_id".` }, 400);
    }
  }

  for (const row of importCalls) {
    if (typeof row['id'] !== 'string' || !row['id']) {
      return c.json({ error: `Call row is missing required field "id".` }, 400);
    }
    if (typeof row['account_id'] !== 'string' || !row['account_id']) {
      return c.json({ error: `Call row "${row['id']}" is missing required field "account_id".` }, 400);
    }
  }

  // Backup the current DB before touching it
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  const backupPath = resolve(BACKUPS_DIR, `tc-pre-import-${isoTimestamp()}.sqlite`);
  try {
    await fs.copyFile(DB_PATH, backupPath);
  } catch (err) {
    console.error('[import] Could not create pre-import backup:', err);
    return c.json({ error: 'Could not create pre-import backup. Import aborted.' }, 500);
  }

  // Run all deletes and inserts atomically via libsql batch
  try {
    const statements: { sql: string; args?: unknown[] }[] = [
      { sql: 'DELETE FROM calls' },
      { sql: 'DELETE FROM stakeholders' },
      { sql: 'DELETE FROM accounts' },
    ];

    for (const row of importAccounts) {
      statements.push({
        sql: `INSERT INTO accounts (id, name, industry, state, status, fortune_500, fortune_1000, open_opps, last_activity, prior_context, sf_id, website, linkedin_url, amount, archived, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row['id'] ?? null, row['name'] ?? null, row['industry'] ?? null, row['state'] ?? null,
          row['status'] ?? 'Prospect', row['fortune_500'] ?? null, row['fortune_1000'] ?? null,
          row['open_opps'] ?? null, row['last_activity'] ?? null, row['prior_context'] ?? null,
          row['sf_id'] ?? null, row['website'] ?? null, row['linkedin_url'] ?? null,
          row['amount'] ?? null, row['archived'] ?? null, row['created_at'] ?? null, row['updated_at'] ?? null,
        ],
      });
    }

    for (const row of importStakeholders) {
      statements.push({
        sql: `INSERT INTO stakeholders (id, account_id, name, title, type, champion_confirmed, linkedin_url, email, priorities, messaging, notes, temperature, last_touched, source, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row['id'] ?? null, row['account_id'] ?? null, row['name'] ?? null, row['title'] ?? null,
          row['type'] ?? 'Unclassified', row['champion_confirmed'] ?? null, row['linkedin_url'] ?? null,
          row['email'] ?? null, row['priorities'] ?? null, row['messaging'] ?? null,
          row['notes'] ?? null, row['temperature'] ?? null, row['last_touched'] ?? null,
          row['source'] ?? 'manual', row['created_at'] ?? null, row['updated_at'] ?? null,
        ],
      });
    }

    for (const row of importCalls) {
      statements.push({
        sql: `INSERT INTO calls (id, account_id, title, date, summary, health, health_reason, customer_attendees, raw_transcript, source_file, source_kind, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row['id'] ?? null, row['account_id'] ?? null, row['title'] ?? null, row['date'] ?? null,
          row['summary'] ?? null, row['health'] ?? 'unknown', row['health_reason'] ?? null,
          row['customer_attendees'] ?? null, row['raw_transcript'] ?? null, row['source_file'] ?? null,
          row['source_kind'] ?? 'transcript', row['created_at'] ?? null, row['updated_at'] ?? null,
        ],
      });
    }

    await libsqlClient.batch(statements as Parameters<typeof libsqlClient.batch>[0]);
  } catch (err) {
    console.error('[import] Batch insert failed, restoring from backup:', err);
    try {
      await fs.copyFile(backupPath, DB_PATH);
    } catch (restoreErr) {
      console.error('[import] Restore failed:', restoreErr);
    }
    return c.json({
      error: err instanceof Error ? err.message : 'Import failed. Database was restored from backup.',
    }, 500);
  }

  return c.json({
    ok: true,
    summary: {
      accounts: importAccounts.length,
      stakeholders: importStakeholders.length,
      calls: importCalls.length,
    },
  });
});

// ---- POST /api/backup ----

backupRoutes.post('/backup', async (c) => {
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    const filename = `tc-${isoTimestamp()}.sqlite`;
    const destPath = resolve(BACKUPS_DIR, filename);
    await fs.copyFile(DB_PATH, destPath);
    const stat = await fs.stat(destPath);
    return c.json({
      ok: true,
      path: `backend/data/backups/${filename}`,
      size_bytes: stat.size,
    });
  } catch (err) {
    console.error('[backup] Failed:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Backup failed' }, 500);
  }
});
