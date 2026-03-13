const GIF_PREFIX = '[gif:';
const GIF_SUFFIX = ']';

export function isGifMessage(msg: string): boolean {
  return msg.startsWith(GIF_PREFIX) && msg.endsWith(GIF_SUFFIX);
}

export function encodeGifMessage(url: string): string {
  return `${GIF_PREFIX}${url}${GIF_SUFFIX}`;
}

export function decodeGifUrl(msg: string): string {
  return msg.slice(GIF_PREFIX.length, -GIF_SUFFIX.length);
}

export function getBubbleText(msg: string): string {
  return isGifMessage(msg) ? '[GIF]' : msg;
}
