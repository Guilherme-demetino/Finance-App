import {
  createKdfParams,
  decryptBackupText,
  deriveKey,
  encryptBackupText,
  keyFromBase64,
  keyToBase64,
  parseEncryptedBackup,
  sameKdf,
  validatePassword,
  WrongPasswordError,
  type EncryptedBackup,
  type KdfParams,
  type RandomBytes,
} from "../utils/backup/encryption";
import { logError } from "../utils/logger";

/**
 * Proteção dos backups por senha. A senha nunca é guardada: só a chave derivada
 * dela (mais os parâmetros e o sal), no cofre do sistema. Assim o backup automático
 * do dia segue sem pedir a senha, e o arquivo continua abrindo em outro aparelho
 * com a senha (os parâmetros viajam no próprio arquivo).
 */

export interface BackupProtectionDeps {
  readSecret(): Promise<string | null>;
  writeSecret(value: string): Promise<void>;
  deleteSecret(): Promise<void>;
  randomBytes: RandomBytes;
}

export const PROTECTION_FAILED_MESSAGE =
  "Não foi possível proteger o backup com senha. Abra o menu > Proteger Backups com Senha, desative e ative de novo.";

/** A proteção está ligada mas não dá para cifrar: o backup NÃO pode sair sem senha. */
export class BackupProtectionError extends Error {
  constructor() {
    super(PROTECTION_FAILED_MESSAGE);
    this.name = "BackupProtectionError";
  }
}

export interface ProtectionKey {
  kdf: KdfParams;
  key: Uint8Array;
}

export type ProtectionStatus = "off" | "on" | "broken";

type StoredState = { status: "off" } | { status: "broken" } | { status: "on"; protection: ProtectionKey };

const isKdf = (value: unknown): value is KdfParams => {
  if (typeof value !== "object" || value === null) return false;
  const kdf = value as Record<string, unknown>;
  return (
    kdf.name === "scrypt" &&
    typeof kdf.N === "number" &&
    typeof kdf.r === "number" &&
    typeof kdf.p === "number" &&
    typeof kdf.salt === "string"
  );
};

async function readState(deps: BackupProtectionDeps): Promise<StoredState> {
  const raw = await deps.readSecret();
  if (raw === null || raw === "") return { status: "off" };
  try {
    const parsed = JSON.parse(raw) as { kdf?: unknown; key?: unknown };
    const key = typeof parsed.key === "string" ? keyFromBase64(parsed.key) : null;
    if (!isKdf(parsed.kdf) || !key) return { status: "broken" };
    return { status: "on", protection: { kdf: parsed.kdf, key } };
  } catch {
    return { status: "broken" };
  }
}

async function store(deps: BackupProtectionDeps, protection: ProtectionKey): Promise<void> {
  await deps.writeSecret(JSON.stringify({ kdf: protection.kdf, key: keyToBase64(protection.key) }));
}

export async function getProtectionStatus(deps: BackupProtectionDeps): Promise<ProtectionStatus> {
  return (await readState(deps)).status;
}

export type EnableResult = { ok: true } | { ok: false; error: string };

/**
 * Liga a proteção (ou troca a senha): gera um sal novo, deriva a chave e guarda.
 * Demora alguns segundos. Backups antigos continuam abrindo só com a senha antiga.
 */
export async function enableProtection(
  deps: BackupProtectionDeps,
  password: string,
  confirmation: string,
): Promise<EnableResult> {
  const problem = validatePassword(password, confirmation);
  if (problem) return { ok: false, error: problem };

  const kdf = createKdfParams(deps.randomBytes);
  const key = await deriveKey(password, kdf);
  await store(deps, { kdf, key });
  return { ok: true };
}

/** Desliga: os próximos backups saem sem senha. Os já feitos continuam protegidos. */
export async function disableProtection(deps: BackupProtectionDeps): Promise<void> {
  await deps.deleteSecret();
}

/** Continua a proteger com a chave de um backup aberto pela senha (ex.: depois de restaurar em outro aparelho). */
export async function adoptProtection(deps: BackupProtectionDeps, protection: ProtectionKey): Promise<void> {
  await store(deps, protection);
}

/**
 * O texto do backup como deve ser gravado: cifrado se a proteção está ligada, igual
 * se está desligada. Se está ligada e algo falha, NÃO devolve o texto aberto: lança.
 */
export async function protectBackupText(deps: BackupProtectionDeps, text: string): Promise<string> {
  try {
    const state = await readState(deps);
    if (state.status === "off") return text;
    if (state.status === "broken") throw new BackupProtectionError();
    const { kdf, key } = state.protection;
    return encryptBackupText(text, key, kdf, deps.randomBytes);
  } catch (error) {
    if (error instanceof BackupProtectionError) throw error;
    logError("Erro ao proteger o backup com senha:", error);
    throw new BackupProtectionError();
  }
}

export type UnlockResult =
  /** Arquivo sem senha (backup comum ou outro tipo de arquivo): segue o caminho normal. */
  | { status: "plain"; text: string }
  | { status: "invalid"; error: string }
  | { status: "needs-password" }
  | { status: "wrong-password" }
  /** `adoptable`: a chave que abriu, se ainda não for a guardada (para continuar protegendo). */
  | { status: "opened"; text: string; adoptable: ProtectionKey | null };

/**
 * Abre o arquivo escolhido para restaurar. Se a chave guardada neste aparelho é a
 * deste arquivo, abre sozinho; senão pede a senha.
 */
export async function unlockBackup(
  deps: BackupProtectionDeps,
  text: string,
  password?: string,
): Promise<UnlockResult> {
  const parsed = parseEncryptedBackup(text);
  if (!parsed.ok) {
    return parsed.reason === "not-encrypted" ? { status: "plain", text } : { status: "invalid", error: parsed.error };
  }
  const envelope: EncryptedBackup = parsed.envelope;

  const state = await readState(deps);
  if (state.status === "on" && sameKdf(state.protection.kdf, envelope.kdf)) {
    try {
      return { status: "opened", text: decryptBackupText(envelope, state.protection.key), adoptable: null };
    } catch (error) {
      if (!(error instanceof WrongPasswordError)) throw error;
      // Não abriu com a chave guardada: cai no pedido de senha.
    }
  }

  if (password === undefined) return { status: "needs-password" };

  const key = await deriveKey(password, envelope.kdf);
  try {
    return { status: "opened", text: decryptBackupText(envelope, key), adoptable: { kdf: envelope.kdf, key } };
  } catch (error) {
    if (error instanceof WrongPasswordError) return { status: "wrong-password" };
    throw error;
  }
}
