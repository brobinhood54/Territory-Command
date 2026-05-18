import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const src = resolve(process.cwd(), 'data', 'tc.sqlite');
const backupDir = resolve(process.cwd(), 'data', 'backups');

if (!existsSync(src)) {
  console.error('No database found at', src);
  console.error('Run db:migrate first.');
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = resolve(backupDir, `tc-${timestamp}.sqlite`);
cpSync(src, dest);
console.log('Backup created:', dest);
