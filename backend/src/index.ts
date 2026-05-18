import { config } from 'dotenv';
config({ override: true });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { runMigrations } from './db/migrate';
import { healthRoutes } from './routes/health';
import { accountRoutes } from './routes/accounts';
import { stakeholderRoutes } from './routes/stakeholders';

async function main() {
  await runMigrations();

  const app = new Hono();
  app.use('*', cors({ origin: 'http://localhost:5173' }));
  app.route('/api', healthRoutes);
  app.route('/api', accountRoutes);
  app.route('/api', stakeholderRoutes);

  const port = 3001;
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

main().catch(err => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
