/**
 * One-time script to import Bassheadz Excel into newsletter_subscribers.
 *
 * Usage:
 *   npx tsx scripts/import-bassheadz.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Uses service role key to bypass RLS.
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const filePath = path.resolve(__dirname, '../Bassheadz Chile  (Respuestas).xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

function extractInstagram(raw: string | undefined): string | null {
  if (!raw) return null;
  // Extract username from Instagram URL or plain text
  const match = raw.match(/instagram\.com\/([^/?]+)/);
  if (match) return `@${match[1].replace(/^@/, '')}`;
  const trimmed = raw.trim();
  return trimmed ? (trimmed.startsWith('@') ? trimmed : `@${trimmed}`) : null;
}

function splitName(fullName: string): { name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { name: parts[0] || '', last_name: '' };
  const name = parts[0];
  const last_name = parts.slice(1).join(' ');
  return { name, last_name };
}

async function main() {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const fullName = (row['Nombre y Apellido'] || '').toString().trim();
    const email = (row['Correo'] || '').toString().trim().toLowerCase();
    const instagramRaw = (row['Instagram (link completo -> https://www.instagram.com/juanito.perez/)'] || '').toString();

    if (!email) {
      console.log(`SKIP: no email for "${fullName}"`);
      skipped++;
      continue;
    }

    const { name, last_name } = splitName(fullName);
    const instagram = extractInstagram(instagramRaw);

    // Check if exists
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      console.log(`SKIP: ${email} already exists`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ name, last_name, email, instagram });

    if (error) {
      console.log(`ERROR: ${email} — ${error.message}`);
      errors++;
    } else {
      console.log(`OK: ${email} (${name} ${last_name})`);
      inserted++;
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
}

main();
