import * as SecureStore from "expo-secure-store";

import { EMPTY_LOCKOUT, type LockoutState } from "./pinLockout";

const PIN_STORAGE_KEY = "finance_app_pin";
const LOCKOUT_STORAGE_KEY = "finance_app_pin_lockout";

export async function getStoredPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_STORAGE_KEY);
}

export async function savePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin);
  // PIN novo, contagem nova.
  await clearLockoutState();
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
  await clearLockoutState();
}

export async function hasPinConfigured(): Promise<boolean> {
  const pin = await getStoredPin();
  return !!pin;
}

/**
 * Contador de tentativas erradas do PIN. Fica no SecureStore junto do PIN, então
 * sobrevive a fechar e abrir o app: sem isso, bastaria reiniciar para zerar.
 */
export async function getLockoutState(): Promise<LockoutState> {
  try {
    const raw = await SecureStore.getItemAsync(LOCKOUT_STORAGE_KEY);
    if (!raw) return EMPTY_LOCKOUT;

    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    if (
      typeof parsed.failures !== "number" ||
      typeof parsed.lockedUntil !== "number" ||
      !Number.isFinite(parsed.failures) ||
      !Number.isFinite(parsed.lockedUntil)
    ) {
      return EMPTY_LOCKOUT;
    }
    return { failures: parsed.failures, lockedUntil: parsed.lockedUntil };
  } catch {
    return EMPTY_LOCKOUT;
  }
}

export async function saveLockoutState(state: LockoutState): Promise<void> {
  await SecureStore.setItemAsync(LOCKOUT_STORAGE_KEY, JSON.stringify(state));
}

export async function clearLockoutState(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCKOUT_STORAGE_KEY);
}
