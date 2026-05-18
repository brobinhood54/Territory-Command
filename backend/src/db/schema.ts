import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  state: text('state'),
  status: text('status').default('Prospect'),
  fortune_500: integer('fortune_500', { mode: 'boolean' }),
  fortune_1000: integer('fortune_1000', { mode: 'boolean' }),
  open_opps: integer('open_opps').default(0),
  last_activity: text('last_activity'),
  prior_context: text('prior_context'),
  sf_id: text('sf_id'),
  website: text('website'),
  linkedin_url: text('linkedin_url'),
  amount: real('amount'),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  created_at: integer('created_at'),
  updated_at: integer('updated_at'),
});

export const stakeholders = sqliteTable('stakeholders', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  name: text('name').notNull(),
  title: text('title'),
  type: text('type').default('Unclassified'),
  champion_confirmed: integer('champion_confirmed', { mode: 'boolean' }).default(false),
  linkedin_url: text('linkedin_url'),
  email: text('email'),
  priorities: text('priorities'),
  messaging: text('messaging'),
  notes: text('notes'),
  temperature: text('temperature'),
  last_touched: text('last_touched'),
  source: text('source').default('manual'),
  created_at: integer('created_at'),
  updated_at: integer('updated_at'),
});

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  call_id: text('call_id').references(() => calls.id).notNull(),
  asker_name: text('asker_name').notNull(),
  asker_stakeholder_id: text('asker_stakeholder_id').references(() => stakeholders.id),
  question_text: text('question_text').notNull(),
  status: text('status').default('open').notNull(),
  resolution_text: text('resolution_text'),
  resolution_call_id: text('resolution_call_id').references(() => calls.id),
  asked_at: text('asked_at'),
  resolved_at: text('resolved_at'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const pains = sqliteTable('pains', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  summary: text('summary').notNull(),
  category: text('category').notNull(),
  confidence: text('confidence').notNull().default('medium'),
  first_heard_at: text('first_heard_at'),
  last_heard_at: text('last_heard_at'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const pain_sources = sqliteTable('pain_sources', {
  id: text('id').primaryKey(),
  pain_id: text('pain_id').references(() => pains.id).notNull(),
  call_id: text('call_id').references(() => calls.id).notNull(),
  voicer_name: text('voicer_name').notNull(),
  voicer_stakeholder_id: text('voicer_stakeholder_id').references(() => stakeholders.id),
  quote: text('quote').notNull(),
  confidence: text('confidence').notNull().default('medium'),
  created_at: integer('created_at').notNull(),
});

export const gameplans = sqliteTable('gameplans', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  content: text('content').notNull(),
  model_used: text('model_used'),
  generated_at: integer('generated_at'),
  input_tokens: integer('input_tokens'),
  output_tokens: integer('output_tokens'),
  latency_ms: integer('latency_ms'),
  generated_with_data_signature: text('generated_with_data_signature'),
});

export const pre_call_plans = sqliteTable('pre_call_plans', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  title: text('title').notNull(),
  meeting_type: text('meeting_type').notNull(),
  planned_date: text('planned_date'),
  goal: text('goal'),
  attendee_stakeholder_ids: text('attendee_stakeholder_ids'),
  additional_attendees: text('additional_attendees'),
  content: text('content'),
  status: text('status').notNull().default('draft'),
  linked_call_id: text('linked_call_id'),
  generated_at: integer('generated_at'),
  model_used: text('model_used'),
  input_tokens: integer('input_tokens'),
  output_tokens: integer('output_tokens'),
  latency_ms: integer('latency_ms'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
});

export const calls = sqliteTable('calls', {
  id: text('id').primaryKey(),
  account_id: text('account_id').references(() => accounts.id).notNull(),
  title: text('title'),
  date: text('date'),
  summary: text('summary'),
  health: text('health').default('unknown'),
  health_reason: text('health_reason'),
  customer_attendees: text('customer_attendees'),
  raw_transcript: text('raw_transcript'),
  source_file: text('source_file'),
  source_kind: text('source_kind').default('transcript'),
  created_at: integer('created_at'),
  updated_at: integer('updated_at'),
});
