import { createSupabaseServer } from '@/src/lib/supabase-server';
import { createZip, type ZipEntry } from '@/src/lib/zip';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'artista'
  );
}

function extFromUrl(url: string): string | null {
  const path = url.split('?')[0];
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: pkProfile } = await supabase
    .from('pk_profiles')
    .select('user_id')
    .eq('slug', slug)
    .single();

  if (!pkProfile) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { data: presskit } = await supabase
    .from('presskits')
    .select('artist_name, logo_urls, published')
    .eq('user_id', pkProfile.user_id)
    .eq('published', true)
    .single();

  const logoUrls: string[] = presskit?.logo_urls ?? [];
  if (!presskit || logoUrls.length === 0) {
    return NextResponse.json({ error: 'Sin logos' }, { status: 404 });
  }

  const artistSlug = slugify(presskit.artist_name || slug);

  const entries: ZipEntry[] = [];
  await Promise.all(
    logoUrls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = new Uint8Array(await res.arrayBuffer());
        const type = res.headers.get('content-type')?.split(';')[0].trim();
        const ext = (type && EXT_BY_TYPE[type]) || extFromUrl(url) || 'png';
        entries.push({ name: `${artistSlug}-logo-${i + 1}.${ext}`, data: buf });
      } catch {
        /* skip unreachable logo */
      }
    })
  );

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No se pudieron descargar los logos' }, { status: 502 });
  }

  // Keep zip order stable (Promise.all resolves out of order).
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const zip = createZip(entries);
  const zipBytes = new Uint8Array(zip);

  return new NextResponse(zipBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${artistSlug}-logos.zip"`,
      'Content-Length': String(zipBytes.length),
      'Cache-Control': 'no-store',
    },
  });
}
