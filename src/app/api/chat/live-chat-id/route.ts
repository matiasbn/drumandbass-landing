import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

let cachedLiveChatId: string | null = null;
let cachedVideoId: string | null = null;

export async function GET(request: NextRequest) {
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  const videoId = request.nextUrl.searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  // Return cached value if same video
  if (cachedLiveChatId && cachedVideoId === videoId) {
    return NextResponse.json({ liveChatId: cachedLiveChatId });
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );

  if (!res.ok) {
    console.error('Failed to fetch video details:', await res.text());
    return NextResponse.json({ error: 'Failed to fetch video details' }, { status: 502 });
  }

  const data = await res.json();
  const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;

  if (!liveChatId) {
    return NextResponse.json({ error: 'No active live chat found' }, { status: 404 });
  }

  cachedLiveChatId = liveChatId;
  cachedVideoId = videoId;

  return NextResponse.json({ liveChatId });
}
