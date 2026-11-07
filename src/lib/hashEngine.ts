/** 哈希与 HMAC（Web Crypto） */

export const HASH_ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
export type HashAlgo = (typeof HASH_ALGOS)[number]

const CRYPTO_NAME: Record<string, string> = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-384': 'SHA-384',
  'SHA-512': 'SHA-512',
}

export async function digestData(algo: HashAlgo, data: Uint8Array): Promise<string> {
  if (algo === 'MD5') {
    const { md5Bytes } = await import('./md5')
    return toHex(md5Bytes(data))
  }
  const name = CRYPTO_NAME[algo]
  const buf = await crypto.subtle.digest(name, data as BufferSource)
  return toHex(new Uint8Array(buf))
}

export async function digestText(algo: HashAlgo, text: string): Promise<string> {
  return digestData(algo, new TextEncoder().encode(text))
}

export async function digestFile(algo: HashAlgo, file: File | Blob): Promise<string> {
  return digestData(algo, new Uint8Array(await file.arrayBuffer()))
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export async function hmac(
  algo: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512',
  secret: string,
  message: string,
  output: 'hex' | 'base64' = 'hex',
): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: algo }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(sig)
  return output === 'hex' ? toHex(bytes) : toBase64(bytes)
}
