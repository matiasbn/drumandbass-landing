#!/usr/bin/env node
// Backup de datos de Supabase vía REST (PostgREST + Storage API).
//
// Exporta TODAS las filas de TODAS las tablas del esquema public a JSON
// (una carpeta backups/<timestamp>/ con un archivo por tabla + manifest),
// más el listado de objetos de cada bucket de Storage (metadata; los binarios
// no se descargan). Complemento liviano de pg_dump: cubre los DATOS; el
// esquema ya vive en el repo (supabase-schema.sql + supabase/migrations/).
//
// Requisitos (en .env.local o el entorno):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SECRET_KEY  — Dashboard → Project Settings → API keys (sb_secret_…
//     o la legacy service_role). Salta el RLS para leerlo todo. NO commitearla.
//
//   node scripts/backup-db.mjs

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // sin .env.local: se exige que las vars vengan del entorno
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (.env.local o entorno).');
  process.exit(1);
}

const headers = { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` };

async function getJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 300));
  return res;
}

// Lista de tablas del esquema public según el propio PostgREST (OpenAPI).
async function listTables() {
  const res = await getJson(`${SUPABASE_URL}/rest/v1/`, {
    headers: { Accept: 'application/openapi+json' },
  });
  const spec = await res.json();
  return Object.keys(spec.definitions || {}).sort();
}

// Descarga todas las filas de una tabla, paginando de a 1000.
async function dumpTable(table) {
  const rows = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const res = await getJson(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { Range: `${offset}-${offset + PAGE - 1}` },
    });
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function listBuckets() {
  const res = await getJson(`${SUPABASE_URL}/storage/v1/bucket`);
  return res.json();
}

// Listado (metadata) de todos los objetos de un bucket, paginado.
async function listObjects(bucket) {
  const objects = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const res = await getJson(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await res.json();
    objects.push(...page);
    if (page.length < PAGE) break;
  }
  return objects;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = resolve(root, 'backups', stamp);
mkdirSync(outDir, { recursive: true });

const manifest = { created_at: new Date().toISOString(), supabase_url: SUPABASE_URL, tables: {}, buckets: {} };

const tables = await listTables();
console.log(`Tablas en public: ${tables.join(', ')}\n`);

for (const table of tables) {
  try {
    const rows = await dumpTable(table);
    writeFileSync(resolve(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table] = rows.length;
    console.log(`  ✓ ${table}: ${rows.length} filas`);
  } catch (err) {
    manifest.tables[table] = `ERROR: ${err.message}`;
    console.warn(`  ⚠ ${table}: ${err.message}`);
  }
}

try {
  const buckets = await listBuckets();
  for (const b of buckets) {
    const objects = await listObjects(b.name);
    writeFileSync(resolve(outDir, `storage-${b.name}.json`), JSON.stringify(objects, null, 2));
    manifest.buckets[b.name] = objects.length;
    console.log(`  ✓ storage/${b.name}: ${objects.length} objetos (solo metadata)`);
  }
} catch (err) {
  console.warn(`  ⚠ storage: ${err.message}`);
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n✓ Backup en ${outDir}`);
