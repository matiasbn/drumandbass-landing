// SoundCloud helpers. SoundCloud closed its public API years ago, so — like the
// presskit track import — we scrape. A track page embeds a `window.__sc_hydration`
// JSON array; the entry with `hydratable: "sound"` is THE track, and its
// `display_date` is the publication date SoundCloud shows. This is brittle by
// nature (depends on SoundCloud's HTML), so callers must tolerate a null return.

const SC_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export function isSoundcloudUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('soundcloud.com');
  } catch {
    return false;
  }
}

/**
 * Fetch a SoundCloud track's publication date (ISO string) by scraping its page.
 * Returns null if the URL isn't a SoundCloud track, the fetch fails, or the
 * hydration data can't be parsed.
 */
export async function fetchSoundcloudDisplayDate(url: string): Promise<string | null> {
  if (!isSoundcloudUrl(url)) return null;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': SC_DESKTOP_UA, Accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return null;

    const hydration = JSON.parse(match[1]) as Array<{
      hydratable?: string;
      data?: { display_date?: string; created_at?: string };
    }>;

    const sound = hydration.find((item) => item.hydratable === 'sound');
    const date = sound?.data?.display_date || sound?.data?.created_at;
    return date ?? null;
  } catch {
    return null;
  }
}
