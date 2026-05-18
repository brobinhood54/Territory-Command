import { libsqlClient } from './client';

export async function runMigrations(): Promise<void> {
  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      state TEXT,
      status TEXT DEFAULT 'Prospect',
      fortune_500 INTEGER DEFAULT 0,
      fortune_1000 INTEGER DEFAULT 0,
      open_opps INTEGER DEFAULT 0,
      last_activity TEXT,
      prior_context TEXT,
      sf_id TEXT,
      website TEXT,
      linkedin_url TEXT,
      amount REAL,
      archived INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS stakeholders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      title TEXT,
      type TEXT DEFAULT 'Unclassified',
      champion_confirmed INTEGER DEFAULT 0,
      linkedin_url TEXT,
      email TEXT,
      priorities TEXT,
      messaging TEXT,
      notes TEXT,
      temperature TEXT,
      last_touched TEXT,
      source TEXT DEFAULT 'manual',
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      title TEXT,
      date TEXT,
      summary TEXT,
      health TEXT DEFAULT 'unknown',
      health_reason TEXT,
      customer_attendees TEXT,
      raw_transcript TEXT,
      source_file TEXT,
      source_kind TEXT DEFAULT 'transcript',
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS pains (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      first_heard_at TEXT,
      last_heard_at TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS pain_sources (
      id TEXT PRIMARY KEY,
      pain_id TEXT NOT NULL REFERENCES pains(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      voicer_name TEXT NOT NULL,
      voicer_stakeholder_id TEXT REFERENCES stakeholders(id),
      quote TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      created_at INTEGER NOT NULL
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS gameplans (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      content TEXT NOT NULL,
      model_used TEXT,
      generated_at INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      latency_ms INTEGER,
      generated_with_data_signature TEXT
    )
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      asker_name TEXT NOT NULL,
      asker_stakeholder_id TEXT REFERENCES stakeholders(id),
      question_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolution_text TEXT,
      resolution_call_id TEXT REFERENCES calls(id),
      asked_at TEXT,
      resolved_at TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration complete. Tables ready.');
      libsqlClient.close();
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
