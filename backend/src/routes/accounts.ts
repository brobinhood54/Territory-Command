import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts } from '../db/schema';

export const accountRoutes = new Hono();

accountRoutes.get('/accounts', async (c) => {
  const rows = await db.select().from(accounts).where(eq(accounts.archived, false));
  return c.json(rows);
});

accountRoutes.get('/accounts/:id', async (c) => {
  const id = c.req.param('id');
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  const row = rows[0] ?? null;
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
