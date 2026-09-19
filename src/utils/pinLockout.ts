/**
 * Bloqueio progressivo da tela de PIN. Um PIN de 4 dígitos tem só 10.000
 * combinações, então sem limite dá para testar todas. Depois de algumas
 * tentativas erradas seguidas o app espera um tempo que cresce a cada erro.
 *
 * A contagem só zera quando o PIN certo é digitado (ou o desbloqueio por
 * biometria funciona): esperar o bloqueio acabar não perdoa os erros.
 */

export interface LockoutState {
  /** Tentativas erradas seguidas desde o último desbloqueio. */
  failures: number;
  /** Até quando (ms desde 1970) o PIN fica bloqueado; 0 = não está bloqueado. */
  lockedUntil: number;
}

export const EMPTY_LOCKOUT: LockoutState = { failures: 0, lockedUntil: 0 };

/** A tentativa errada de número LOCK_AT aciona o primeiro bloqueio. */
export const LOCK_AT = 5;

// 5º erro: 30 s; 6º: 1 min; 7º: 5 min; 8º: 15 min; do 9º em diante: 1 h.
const LOCK_STEPS_MS = [
  30 * 1000,
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
];

/** Duração do bloqueio depois de `failures` erros seguidos (0 se ainda não bloqueia). */
export function lockDurationMs(failures: number): number {
  if (failures < LOCK_AT) return 0;
  return LOCK_STEPS_MS[Math.min(failures - LOCK_AT, LOCK_STEPS_MS.length - 1)];
}

/** Estado depois de mais um PIN errado digitado em `now`. */
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failures = state.failures + 1;
  const duration = lockDurationMs(failures);
  return { failures, lockedUntil: duration > 0 ? now + duration : 0 };
}

/**
 * Quanto falta de bloqueio. Nunca passa da duração do bloqueio atual: se o
 * relógio do aparelho for atrasado por engano, o app não fica preso por horas.
 */
export function remainingLockMs(state: LockoutState, now: number): number {
  if (state.lockedUntil <= 0) return 0;
  const remaining = state.lockedUntil - now;
  return Math.max(0, Math.min(remaining, lockDurationMs(state.failures)));
}

/** Quantas tentativas erradas ainda passam antes do primeiro bloqueio (0 depois que ele começa). */
export function attemptsBeforeFirstLock(state: LockoutState): number {
  return Math.max(0, LOCK_AT - state.failures);
}

/** "0:27", "5:00" ou "1:00:00". */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/** "30 segundos", "1 minuto", "1 hora"... para avisos em texto corrido. */
export function describeDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hora" : `${hours} horas`;
}
