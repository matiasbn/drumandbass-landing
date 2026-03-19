import { NextRequest, NextResponse } from 'next/server';

const SC_MOBILE_HEADERS = {
  Accept: 'text/html',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
};

function extractUsername(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('soundcloud.com')) return null;
    // e.g. /zerodaydnb or /zerodaydnb/
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const username = extractUsername(url);
  if (!username) {
    return NextResponse.json({ error: 'URL de SoundCloud inválida' }, { status: 400 });
  }

  try {
    // Fetch the mobile version of the profile — it returns HTML with track data
    const res = await fetch(`https://m.soundcloud.com/${username}`, {
      headers: SC_MOBILE_HEADERS,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'No se pudo acceder al perfil de SoundCloud' },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Extract tracks from aria-label + href pairs in the mobile HTML
    const pattern = new RegExp(
      `aria-label="([^"]+)"[^>]*href="\\/${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/([^"]+)"`,
      'g'
    );

    const tracks: { id: string; title: string; url: string }[] = [];
    const seen = new Set<string>();
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const slug = match[2];
      if (!seen.has(slug)) {
        seen.add(slug);
        tracks.push({
          id: slug,
          title: match[1],
          url: `https://soundcloud.com/${username}/${slug}`,
        });
      }
    }

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error('SoundCloud scrape error:', err);
    return NextResponse.json(
      { error: 'No se pudieron obtener los tracks de SoundCloud' },
      { status: 500 }
    );
  }
}
