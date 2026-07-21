import { NextResponse } from 'next/server';
import { getStreamings } from '@/src/lib/cms';
import { DEFAULT_CLUB_VIDEO_ID } from '@/src/lib/clubStream';

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // youtube.com/watch?v=VIDEO_ID
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }
    // youtube.com/live/VIDEO_ID
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.startsWith('/live/')) {
      return parsed.pathname.split('/live/')[1]?.split(/[?&#]/)[0] || null;
    }
    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split(/[?&#]/)[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export const revalidate = 60;

export async function GET() {
  try {
    const override = process.env.CLUB_STREAM;
    if (override) {
      const youtubeVideoId = extractYouTubeVideoId(override) ?? override;
      return NextResponse.json({
        isLive: !!youtubeVideoId,
        youtubeVideoId,
        title: null,
      });
    }

    const streamings = await getStreamings();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const liveStreaming = streamings.find((streaming) => {
      const streamDate = streaming.date.slice(0, 10);
      const streamEndDate = streaming.endDate ? streaming.endDate.slice(0, 10) : streamDate;
      return todayStr >= streamDate && todayStr <= streamEndDate;
    });

    if (!liveStreaming) {
      // Sin transmisión: el club igual reproduce un video por defecto (ambiente).
      // isLive queda en false a propósito — los rounds siguen atados al stream real.
      return NextResponse.json({
        isLive: false,
        youtubeVideoId: DEFAULT_CLUB_VIDEO_ID,
        title: null,
      });
    }

    const youtubeVideoId = extractYouTubeVideoId(liveStreaming.youtubeUrl);

    return NextResponse.json({
      isLive: !!youtubeVideoId,
      youtubeVideoId,
      title: liveStreaming.name ?? null,
    });
  } catch (error) {
    console.error('Error fetching live status:', error);
    // Ante un fallo, el club igual tiene su video por defecto.
    return NextResponse.json({ isLive: false, youtubeVideoId: DEFAULT_CLUB_VIDEO_ID, title: null });
  }
}
