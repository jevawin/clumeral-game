// HMAC helpers for signing random puzzle tokens.
// Uses Web Crypto API (available in Cloudflare Workers).

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), ALGORITHM, false, ['sign', 'verify']);
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Sign a random seed, returning `seed.hmac` token string. */
export async function signToken(seed: number, secret: string): Promise<string> {
  const key = await getKey(secret);
  const data = new TextEncoder().encode(String(seed));
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return `${seed}.${toHex(sig)}`;
}

/** Parse and verify a `seed.hmac` token. Returns the seed if valid, null otherwise. */
export async function verifyToken(token: string, secret: string): Promise<number | null> {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return null;

  const seedStr = token.slice(0, dotIdx);
  const hmacHex = token.slice(dotIdx + 1);
  const seed = Number(seedStr);
  if (!Number.isFinite(seed) || seed !== Math.floor(seed)) return null;

  const key = await getKey(secret);
  const data = new TextEncoder().encode(seedStr);
  const sig = fromHex(hmacHex);
  const valid = await crypto.subtle.verify('HMAC', key, sig.buffer as ArrayBuffer, data);

  return valid ? seed : null;
}
