import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Shared server-side cache to avoid per-user polling
let cachedMessages: YouTubeChatMessage[] = [];
let cachedLiveChatId: string | null = null;
let cachedVideoId: string | null = null;
let nextPageToken: string | undefined;
let pollingIntervalMillis = 6000;
let lastPollTime = 0;

interface YouTubeChatMessage {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  messageText: string;
  publishedAt: string;
}

async function getLiveChatId(videoId: string): Promise<string | null> {
  if (cachedLiveChatId && cachedVideoId === videoId) {
    return cachedLiveChatId;
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );

  if (!res.ok) {
    console.error('Failed to fetch video details:', await res.text());
    return null;
  }

  const data = await res.json();
  const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;

  if (liveChatId) {
    cachedLiveChatId = liveChatId;
    cachedVideoId = videoId;
  }

  return liveChatId;
}

async function pollMessages(liveChatId: string): Promise<void> {
  const now = Date.now();
  if (now - lastPollTime < pollingIntervalMillis) {
    return; // Use cached data
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages');
  url.searchParams.set('liveChatId', liveChatId);
  url.searchParams.set('part', 'snippet,authorDetails');
  url.searchParams.set('key', YOUTUBE_API_KEY!);
  if (nextPageToken) {
    url.searchParams.set('pageToken', nextPageToken);
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    console.error('Failed to fetch chat messages:', await res.text());
    return;
  }

  const data = await res.json();

  nextPageToken = data.nextPageToken;
  pollingIntervalMillis = data.pollingIntervalMillis ?? 6000;
  lastPollTime = now;

  const newMessages: YouTubeChatMessage[] = (data.items ?? []).map(
    (item: Record<string, Record<string, string>>) => ({
      id: item.id,
      authorDisplayName: item.authorDetails.displayName,
      authorProfileImageUrl: item.authorDetails.profileImageUrl,
      messageText: item.snippet.displayMessage,
      publishedAt: item.snippet.publishedAt,
    })
  );

  if (nextPageToken && cachedMessages.length > 0) {
    // Append only new messages
    cachedMessages = [...cachedMessages, ...newMessages].slice(-200);
  } else {
    // Initial load
    cachedMessages = newMessages.slice(-200);
  }
}

export async function GET(request: NextRequest) {
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  const videoId = request.nextUrl.searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  // Reset cache if video changed
  if (videoId !== cachedVideoId) {
    cachedMessages = [];
    cachedLiveChatId = null;
    nextPageToken = undefined;
    lastPollTime = 0;
  }

  const liveChatId = await getLiveChatId(videoId);
  if (!liveChatId) {
    return NextResponse.json({ error: 'No active live chat found' }, { status: 404 });
  }

  await pollMessages(liveChatId);

  return NextResponse.json({
    messages: cachedMessages,
    liveChatId,
    pollingIntervalMillis,
  });
}
