import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import * as schema from './schema';

const dataDir = resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

export const libsqlClient = createClient({
  url: `file:${resolve(dataDir, 'tc.sqlite')}`,
});

export const db = drizzle(libsqlClient, { schema });
