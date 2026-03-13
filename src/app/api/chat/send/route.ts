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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Failed to send chat message:', res.status, data);
    return NextResponse.json(
      { error: 'Failed to send message', details: data },
      { status: res.status }
    );
  }

  console.log('[chat/send] YouTube response:', JSON.stringify({ status: res.status, id: data.id, snippet: data.snippet }));

  // Validate YouTube actually created the message (returns an id)
  if (!data.id) {
    console.error('YouTube returned 200 but no message id:', data);
    return NextResponse.json(
      { error: 'Message may not have been sent', details: data },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, messageId: data.id });
}
