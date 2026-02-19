import { NextResponse } from 'next/server';
import { getStreamings } from '@/src/lib/contentful';

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
    const streamings = await getStreamings();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const liveStreaming = streamings.find((streaming) => {
      const streamDate = streaming.date.slice(0, 10);
      const streamEndDate = streaming.endDate ? streaming.endDate.slice(0, 10) : streamDate;
      return todayStr >= streamDate && todayStr <= streamEndDate;
    });

    if (!liveStreaming) {
      return NextResponse.json({ isLive: false, youtubeVideoId: null, title: null });
    }

    const youtubeVideoId = extractYouTubeVideoId(liveStreaming.youtubeUrl);

    return NextResponse.json({
      isLive: !!youtubeVideoId,
      youtubeVideoId,
      title: liveStreaming.name ?? null,
    });
  } catch (error) {
    console.error('Error fetching live status:', error);
    return NextResponse.json({ isLive: false, youtubeVideoId: null, title: null });
  }
}
