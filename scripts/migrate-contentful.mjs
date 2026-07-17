#!/usr/bin/env node
// Migración one-shot Contentful → CMS propio (Supabase), assets incluidos.
//
// Por cada entry `event` y `streaming` de Contentful:
//   1. Descarga el flyer desde images.ctfassets.net y lo sube al bucket
//      público 'flyers' de Supabase Storage (no queda NINGUNA URL de
//      ctfassets en la base).
//   2. Upsert de la fila en cms_events / cms_streamings (match por
//      título+fecha), así el script es idempotente: re-correrlo actualiza en
//      vez de duplicar, y repara filas que hubieran quedado con URLs viejas.
//
// Requisitos (en .env.local o el entorno):
//   CONTENTFUL_SPACE_ID / CONTENTFUL_ACCESS_TOKEN  — lectura de Contentful
//   NEXT_PUBLIC_SUPABASE_URL                        — proyecto Supabase
//   SUPABASE_SECRET_KEY                             — Dashboard → Project
//     Settings → API keys → secret key (sb_secret_…; también sirve la legacy
//     service_role). Necesaria para escribir saltándose el RLS admin-only.
//     NO commitearla; puede borrarse de .env.local después de migrar.
//
// Antes de correrlo: aplicar supabase/migrations/20260715000000_create_cms_
// events_streamings.sql en el SQL Editor (crea tablas y bucket).
//
//   node scripts/migrate-contentful.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

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
const SPACE = env.CONTENTFUL_SPACE_ID;
const TOKEN = env.CONTENTFUL_ACCESS_TOKEN;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  !SPACE && 'CONTENTFUL_SPACE_ID',
  !TOKEN && 'CONTENTFUL_ACCESS_TOKEN',
  !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  !SECRET_KEY && 'SUPABASE_SECRET_KEY',
].filter(Boolean);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(', ')} (.env.local o entorno).`);
  console.error('La SUPABASE_SECRET_KEY sale de Dashboard → Project Settings → API keys.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FLYER_BUCKET = 'flyers';

async function fetchEntries(contentType) {
  const url = `https://cdn.contentful.com/spaces/${SPACE}/environments/master/entries?content_type=${contentType}&include=1&limit=1000`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) {
    console.error(`Contentful respondió ${res.status} para ${contentType}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

// Rich text → HTML simple (p, b, i, u, a, br); cualquier otro nodo se aplana.
function richTextToHtml(node) {
  if (!node) return '';
  switch (node.nodeType) {
    case 'document':
      return (node.content || []).map(richTextToHtml).join('');
    case 'paragraph':
      return `<p>${(node.content || []).map(richTextToHtml).join('')}</p>`;
    case 'hyperlink':
      return `<a href="${escapeHtml(node.data?.uri || '')}">${(node.content || []).map(richTextToHtml).join('')}</a>`;
    case 'text': {
      let html = escapeHtml(node.value || '').replace(/\n/g, '<br>');
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') html = `<b>${html}</b>`;
        if (mark.type === 'italic') html = `<i>${html}</i>`;
        if (mark.type === 'underline') html = `<u>${html}</u>`;
      }
      return html;
    }
    default:
      return (node.content || []).map(richTextToHtml).join('');
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 'YYYY-MM-DDTHH:mm' — mantiene la hora "de pared" escrita en Contentful.
const normDate = (d) => (d ? String(d).slice(0, 16) : null);

function assetById(includes, link) {
  if (!link?.sys?.id) return null;
  return (includes?.Asset || []).find((a) => a.sys.id === link.sys.id) || null;
}

// Descarga el asset de ctfassets y lo sube al bucket. Idempotente: el path
// deriva del id del asset en Contentful, y upsert:true lo reemplaza si existe.
async function migrateFlyer(asset) {
  const file = asset?.fields?.file;
  if (!file?.url) return null;

  const sourceUrl = `https:${file.url}`;
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    console.warn(`  ⚠ No se pudo descargar ${sourceUrl} (${res.status}); evento queda sin flyer`);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || file.contentType || 'image/jpeg';
  const ext = extname(new URL(sourceUrl).pathname) || '.jpg';
  const path = `contentful-${asset.sys.id}${ext}`;

  const { error } = await supabase.storage
    .from(FLYER_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    console.error(`  ✗ Error subiendo ${path} al bucket '${FLYER_BUCKET}': ${error.message}`);
    if (/bucket/i.test(error.message)) {
      console.error('  ¿Aplicaste la migración SQL que crea el bucket?');
    }
    process.exit(1);
  }

  const { data: { publicUrl } } = supabase.storage.from(FLYER_BUCKET).getPublicUrl(path);
  const image = file.details?.image;
  console.log(`  ↑ flyer ${path} (${Math.round(bytes.length / 1024)} KB)`);
  return { url: publicUrl, width: image?.width ?? null, height: image?.height ?? null };
}

// Upsert manual por clave natural (title+date / name+date): no hay unique
// constraint en esas columnas, así que se busca el id antes de decidir.
async function upsertRow(table, matchCols, row) {
  let query = supabase.from(table).select('id');
  for (const [col, val] of Object.entries(matchCols)) query = query.eq(col, val);
  const { data: existing, error: selError } = await query.limit(1);
  if (selError) {
    console.error(`  ✗ Error consultando ${table}: ${selError.message}`);
    process.exit(1);
  }

  if (existing?.length) {
    const { error } = await supabase.from(table).update(row).eq('id', existing[0].id);
    if (error) {
      console.error(`  ✗ Error actualizando ${table}: ${error.message}`);
      process.exit(1);
    }
    return 'actualizado';
  }
  const { error } = await supabase.from(table).insert(row);
  if (error) {
    console.error(`  ✗ Error insertando en ${table}: ${error.message}`);
    process.exit(1);
  }
  return 'creado';
}

const [eventsRes, streamingsRes] = await Promise.all([
  fetchEntries('event'),
  fetchEntries('streaming'),
]);

console.log(`Contentful: ${eventsRes.items.length} eventos, ${streamingsRes.items.length} streamings\n`);

for (const item of eventsRes.items) {
  const f = item.fields;
  console.log(`Evento: ${f.title}`);
  const flyer = await migrateFlyer(assetById(eventsRes.includes, f.flyer));

  const status = await upsertRow(
    'cms_events',
    { title: f.title, date: normDate(f.date) },
    {
      title: f.title,
      venue: f.venue ?? null,
      address: f.address ?? null,
      date: normDate(f.date),
      end_date: normDate(f.endDate),
      description_html: f.description ? richTextToHtml(f.description) : null,
      tickets: f.tickets ?? null,
      info: f.info ?? null,
      flyer_url: flyer?.url ?? null,
      flyer_width: flyer?.width ?? null,
      flyer_height: flyer?.height ?? null,
    }
  );
  console.log(`  ✓ ${status}\n`);
}

for (const item of streamingsRes.items) {
  const f = item.fields;
  console.log(`Streaming: ${f.name}`);
  const status = await upsertRow(
    'cms_streamings',
    { name: f.name, date: normDate(f.date) },
    {
      name: f.name,
      youtube_url: f.youtubeUrl,
      date: normDate(f.date),
      end_date: normDate(f.endDate),
    }
  );
  console.log(`  ✓ ${status}\n`);
}

// Chequeo final: no debe quedar ninguna URL de ctfassets en la base.
const { data: leftovers } = await supabase
  .from('cms_events')
  .select('title, flyer_url')
  .ilike('flyer_url', '%ctfassets%');

if (leftovers?.length) {
  console.warn('⚠ Quedan flyers apuntando a ctfassets (edítalos en /admin/eventos):');
  for (const r of leftovers) console.warn(`  - ${r.title}: ${r.flyer_url}`);
} else {
  console.log('✓ Migración completa: ningún flyer apunta a images.ctfassets.net.');
}
