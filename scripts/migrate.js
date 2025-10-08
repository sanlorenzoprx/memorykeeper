/**
 * Simple D1 migration runner for Memorykeeper.
 * Applies SQL files under backend/src/db/migrations in lexicographic order,
 * skipping those already recorded in schema_migrations.
 *
 * Usage:
 *   pnpm db:migrate
 *
 * Env:
 *   D1_NAME (optional) - defaults to "memorykeeper-db"
 */
const { readdirSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const dbName = process.env.D1_NAME || 'memorykeeper-db';
const migrationsDir = join(process.cwd(), 'backend', 'src', 'db', 'migrations');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function getAppliedVersions() {
  const seed = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT
    );
    SELECT version FROM schema_migrations ORDER BY version;
  `.replace(/\n/g, ' ');
  const out = execSync(`wrangler d1 execute ${dbName} --json --command "${seed}"`).toString();
  const parsed = JSON.parse(out);
  const sets = parsed?.results ?? [];
  const rows = Array.isArray(sets) ? (sets[sets.length - 1]?.results || []) : [];
  return rows.map((r) => Number(r.version)).filter((n) => !isNaN(n));
}

function applyMigration(file) {
  const version = Number(file.split('_')[0]);
  if (isNaN(version)) {
    console.warn(`Skipping ${file} (no numeric version prefix)`);
    return;
  }
  const filePath = join(migrationsDir, file);
  console.log(`Applying ${file}...`);
  run(`wrangler d1 execute ${dbName} --file="${filePath}"`);
  const name = file.replace(/"/g, '');
  const cmd = `
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (${version}, "${name}", CURRENT_TIMESTAMP);
  `.replace(/\n/g, ' ');
  run(`wrangler d1 execute ${dbName} --command "${cmd}"`);
}

function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  const applied = new Set(getAppliedVersions());
  for (const f of files) {
    const ver = Number(f.split('_')[0]);
    if (applied.has(ver)) {
      console.log(`Skipping ${f} (already applied)`);
      continue;
    }
    applyMigration(f);
  }
  console.log('Migrations complete.');
}

main();