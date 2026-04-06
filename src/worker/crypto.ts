// Crypto helpers for random puzzle tokens.
// Uses Web Crypto API (available in Cloudflare Workers).
// Tokens are AES-GCM encrypted seeds — opaque to the client.

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
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

/** Encrypt a random seed into an opaque token string. */
export async function signToken(seed: number, secret: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(String(seed));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return toHex(iv.buffer as ArrayBuffer) + '.' + toHex(ciphertext);
}

/** Decrypt a token back to the seed. Returns the seed if valid, null otherwise. */
export async function verifyToken(token: string, secret: string): Promise<number | null> {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return null;

  const ivHex = token.slice(0, dotIdx);
  const ctHex = token.slice(dotIdx + 1);

  try {
    const key = await getKey(secret);
    const iv = fromHex(ivHex);
    const ct = fromHex(ctHex);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ct.buffer as ArrayBuffer,
    );
    const seedStr = new TextDecoder().decode(plaintext);
    const seed = Number(seedStr);
    if (!Number.isFinite(seed) || seed !== Math.floor(seed)) return null;
    return seed;
  } catch {
    return null;
  }
}
