import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
  }

  const providerToken = authHeader.replace('Bearer ', '');

  const body = await request.json();
  const { liveChatId, message } = body;

  if (!liveChatId || !message) {
    return NextResponse.json({ error: 'liveChatId and message are required' }, { status: 400 });
  }

  const res = await fetch(
    'https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: message,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('Failed to send chat message:', errorData);
    return NextResponse.json(
      { error: 'Failed to send message', details: errorData },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({ success: true, message: data });
}
