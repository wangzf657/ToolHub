/** 文件加密（AES-256-GCM + PBKDF2） */
import { toBase64 } from './hashEngine'

const MAGIC = new Uint8Array([0x57, 0x5a, 0x46, 0x31]) // "WZF1"
const SALT_LEN = 16
const IV_LEN = 12
const ITERATIONS = 310000

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 加密文件：输出格式 MAGIC + SALT + IV + 密文 */
export async function encryptFile(file: File | Blob, password: string): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(password, salt)
  const plaintext = new Uint8Array(await file.arrayBuffer())
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource),
  )
  const out = new Uint8Array(MAGIC.length + SALT_LEN + IV_LEN + cipher.length)
  let off = 0
  out.set(MAGIC, off); off += MAGIC.length
  out.set(salt, off); off += SALT_LEN
  out.set(iv, off); off += IV_LEN
  out.set(cipher, off)
  return new Blob([out], { type: 'application/octet-stream' })
}

export async function decryptFile(file: File | Blob, password: string): Promise<Blob> {
  const data = new Uint8Array(await file.arrayBuffer())
  let off = 0
  for (const b of MAGIC) {
    if (data[off++] !== b) throw new Error('这不是由本工具加密的文件（文件头不匹配）')
  }
  const salt = data.slice(off, off + SALT_LEN); off += SALT_LEN
  const iv = data.slice(off, off + IV_LEN); off += IV_LEN
  const cipher = data.slice(off)
  const key = await deriveKey(password, salt)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, cipher as BufferSource)
    return new Blob([plain], { type: 'application/octet-stream' })
  } catch {
    throw new Error('解密失败：密码错误或文件已损坏')
  }
}

/** 检查文件是否为本工具加密格式 */
export async function isEncryptedFile(file: File | Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return MAGIC.every((b, i) => head[i] === b)
}

export { toBase64 }
