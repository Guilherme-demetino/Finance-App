import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { scryptAsync } from "@noble/hashes/scrypt";

/**
 * Criptografia do backup por senha. Lógica pura: a aleatoriedade entra de fora
 * (`RandomBytes`), então os testes são repetíveis e nada aqui depende do aparelho.
 *
 * - Cifra: XChaCha20-Poly1305 (autenticada: uma senha errada ou um arquivo alterado
 *   são detectados, nunca viram lixo silencioso). O nonce de 24 bytes é aleatório
 *   a cada arquivo.
 * - Chave: scrypt a partir da senha. Os parâmetros e o sal ficam no cabeçalho do
 *   arquivo, então dá para reforçar o custo no futuro sem quebrar backups antigos.
 * - O cabeçalho inteiro entra como dado autenticado: mexer nos parâmetros do
 *   arquivo também invalida a abertura.
 */

export const ENCRYPTED_BACKUP_FORMAT = "meu-financeiro-backup-criptografado";
export const ENCRYPTED_BACKUP_VERSION = 1;
const CIPHER = "xchacha20poly1305";

export const MIN_PASSWORD_LENGTH = 8;

const KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 24;

/**
 * Custo do scrypt para chaves novas: 32 MiB de memória. É o que o celular aguenta
 * sem esperar demais (o scrypt em JavaScript no Hermes é lento); fica no arquivo,
 * então subir depois não quebra os backups já feitos.
 */
export const DEFAULT_SCRYPT = { N: 2 ** 15, r: 8, p: 1 } as const;

// Limites aceitos ao LER um arquivo: um cabeçalho malicioso não pode pedir gigabytes de memória.
const MAX_N = 2 ** 16;
const MIN_N = 2 ** 10;
const MAX_R = 8;
const MAX_P = 4;

export type RandomBytes = (length: number) => Uint8Array;

export interface KdfParams {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
  /** Base64. */
  salt: string;
}

export interface EncryptedBackup {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: number;
  cipher: typeof CIPHER;
  kdf: KdfParams;
  /** Base64. */
  nonce: string;
  /** Base64 (texto cifrado + etiqueta de autenticação). */
  ciphertext: string;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("Senha incorreta ou arquivo alterado.");
    this.name = "WrongPasswordError";
  }
}

// ------------------------------------------------------------------ texto e bytes

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }
  return out;
}

/** Base64 estrito (com preenchimento); null se o texto não for base64 válido. */
export function fromBase64(text: string): Uint8Array | null {
  if (typeof text !== "string" || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  let pos = 0;
  for (let i = 0; i < text.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => (text[i + k] === "=" ? 0 : B64.indexOf(text[i + k])));
    const value = (chunk[0] << 18) | (chunk[1] << 12) | (chunk[2] << 6) | chunk[3];
    if (pos < bytes.length) bytes[pos++] = (value >> 16) & 255;
    if (pos < bytes.length) bytes[pos++] = (value >> 8) & 255;
    if (pos < bytes.length) bytes[pos++] = value & 255;
  }
  return bytes;
}

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let code: number;
    let extra: number;
    if (b < 0x80) [code, extra] = [b, 0];
    else if (b >= 0xf0) [code, extra] = [b & 7, 3];
    else if (b >= 0xe0) [code, extra] = [b & 15, 2];
    else [code, extra] = [b & 31, 1];
    for (let k = 1; k <= extra; k++) code = (code << 6) | ((bytes[i + k] ?? 0) & 63);
    out += String.fromCodePoint(code);
    i += extra + 1;
  }
  return out;
}

// ------------------------------------------------------------------------ senha

/** Mesma senha, mesmo texto: NFKC junta "é" digitado de jeitos diferentes por teclados diferentes. */
export function normalizePassword(password: string): string {
  try {
    return password.normalize("NFKC");
  } catch {
    return password;
  }
}

/** Mensagem de erro se a senha (e a confirmação, quando dada) não servir; null se estiver ok. */
export function validatePassword(password: string, confirmation?: string): string | null {
  if ([...normalizePassword(password)].length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Uma frase longa é melhor que uma senha curta e complicada.`;
  }
  if (confirmation !== undefined && confirmation !== password) {
    return "As duas senhas não são iguais.";
  }
  return null;
}

// ------------------------------------------------------------------------ chave

export function createKdfParams(
  randomBytes: RandomBytes,
  overrides: Partial<Pick<KdfParams, "N" | "r" | "p">> = {},
): KdfParams {
  return { name: "scrypt", ...DEFAULT_SCRYPT, ...overrides, salt: toBase64(randomBytes(SALT_BYTES)) };
}

/** A chave da senha. Demora (é de propósito) e segura o JavaScript até terminar. */
export async function deriveKey(password: string, kdf: KdfParams): Promise<Uint8Array> {
  const salt = fromBase64(kdf.salt);
  if (!salt) throw new Error("Sal inválido.");
  return scryptAsync(utf8Encode(normalizePassword(password)), salt, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    dkLen: KEY_BYTES,
  });
}

// ------------------------------------------------------------ cifrar e decifrar

/** Tudo o que identifica o arquivo e o jeito de abri-lo: autenticado junto com o conteúdo. */
function headerAad(envelope: Pick<EncryptedBackup, "format" | "version" | "cipher" | "kdf">): Uint8Array {
  const { kdf } = envelope;
  return utf8Encode(
    [envelope.format, envelope.version, envelope.cipher, kdf.name, kdf.N, kdf.r, kdf.p, kdf.salt].join("|"),
  );
}

/** Texto do backup (JSON) → envelope cifrado (JSON). */
export function encryptBackupText(
  plaintext: string,
  key: Uint8Array,
  kdf: KdfParams,
  randomBytes: RandomBytes,
): string {
  const header = { format: ENCRYPTED_BACKUP_FORMAT, version: ENCRYPTED_BACKUP_VERSION, cipher: CIPHER, kdf } as const;
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce, headerAad(header)).encrypt(utf8Encode(plaintext));
  const envelope: EncryptedBackup = { ...header, nonce: toBase64(nonce), ciphertext: toBase64(ciphertext) };
  return JSON.stringify(envelope);
}

export type ParsedEnvelope =
  | { ok: true; envelope: EncryptedBackup }
  /** "not-encrypted": é outro tipo de arquivo (o chamador segue o caminho normal). */
  | { ok: false; reason: "not-encrypted" | "invalid" | "newer"; error: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

/** Lê e valida o envelope. Só diz "not-encrypted" quando o arquivo nem se apresenta como um backup protegido. */
export function parseEncryptedBackup(text: string): ParsedEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not-encrypted", error: "Não é um backup protegido." };
  }
  if (!isObject(raw) || raw.format !== ENCRYPTED_BACKUP_FORMAT) {
    return { ok: false, reason: "not-encrypted", error: "Não é um backup protegido." };
  }

  const invalid = (detail: string): ParsedEnvelope => ({
    ok: false,
    reason: "invalid",
    error: `Backup protegido inválido: ${detail}.`,
  });

  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1) {
    return invalid("versão desconhecida");
  }
  if (raw.version > ENCRYPTED_BACKUP_VERSION) {
    return {
      ok: false,
      reason: "newer",
      error: "Esse backup foi criado por uma versão mais nova do app. Atualize o app e tente de novo.",
    };
  }
  if (raw.cipher !== CIPHER) return invalid("cifra desconhecida");

  const kdf = raw.kdf;
  if (!isObject(kdf) || kdf.name !== "scrypt") return invalid("parâmetros da chave");
  const { N, r, p, salt } = kdf as Record<string, unknown>;
  if (
    typeof N !== "number" || !isPowerOfTwo(N) || N < MIN_N || N > MAX_N ||
    typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > MAX_R ||
    typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > MAX_P
  ) {
    return invalid("parâmetros da chave fora do aceito");
  }
  const saltBytes = typeof salt === "string" ? fromBase64(salt) : null;
  if (!saltBytes || saltBytes.length !== SALT_BYTES) return invalid("sal");

  const nonce = typeof raw.nonce === "string" ? fromBase64(raw.nonce) : null;
  if (!nonce || nonce.length !== NONCE_BYTES) return invalid("nonce");
  const ciphertext = typeof raw.ciphertext === "string" ? fromBase64(raw.ciphertext) : null;
  // 16 bytes de etiqueta de autenticação, no mínimo.
  if (!ciphertext || ciphertext.length < 16) return invalid("conteúdo");

  return {
    ok: true,
    envelope: {
      format: ENCRYPTED_BACKUP_FORMAT,
      version: raw.version,
      cipher: CIPHER,
      kdf: { name: "scrypt", N, r, p, salt: salt as string },
      nonce: raw.nonce as string,
      ciphertext: raw.ciphertext as string,
    },
  };
}

/** Só o "isso é um backup protegido?", para decidir o caminho antes de pedir a senha. */
export function isEncryptedBackup(text: string): boolean {
  const parsed = parseEncryptedBackup(text);
  return parsed.ok || parsed.reason !== "not-encrypted";
}

/** Abre o envelope com a chave; WrongPasswordError se a chave não bate ou o arquivo foi mexido. */
export function decryptBackupText(envelope: EncryptedBackup, key: Uint8Array): string {
  const nonce = fromBase64(envelope.nonce);
  const ciphertext = fromBase64(envelope.ciphertext);
  if (!nonce || !ciphertext) throw new WrongPasswordError();
  try {
    return utf8Decode(xchacha20poly1305(key, nonce, headerAad(envelope)).decrypt(ciphertext));
  } catch {
    throw new WrongPasswordError();
  }
}

// -------------------------------------------------------------- chave guardada

export function keyToBase64(key: Uint8Array): string {
  return toBase64(key);
}

export function keyFromBase64(text: string): Uint8Array | null {
  const bytes = fromBase64(text);
  return bytes && bytes.length === KEY_BYTES ? bytes : null;
}

/** A chave guardada abre este envelope? (mesmo sal e mesmos parâmetros da chave) */
export function sameKdf(a: KdfParams, b: KdfParams): boolean {
  return a.name === b.name && a.N === b.N && a.r === b.r && a.p === b.p && a.salt === b.salt;
}
