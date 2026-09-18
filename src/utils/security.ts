import * as SecureStore from "expo-secure-store";

const PIN_STORAGE_KEY = "finance_app_pin";

export async function getStoredPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_STORAGE_KEY);
}

export async function savePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
}

export async function hasPinConfigured(): Promise<boolean> {
  const pin = await getStoredPin();
  return !!pin;
}

// Sinalizador em memória (não persistido) usado pra evitar que o app peça
// PIN/biometria de novo quando o próprio app abre uma tela do sistema (ex:
// galeria de fotos) — isso dispara o mesmo ciclo background->active de
// quando o usuário troca de app de verdade, mas aqui não deve travar.
let suppressNextLock = false;

/** Chamar logo antes de abrir uma tela do sistema (galeria, câmera, etc). */
export function suppressAppLockOnce(): void {
  suppressNextLock = true;
}

/**
 * Consome o sinalizador (se estiver ligado, desliga e retorna true). Deve
 * ser chamado no listener que decide se re-trava o app ao voltar do
 * background.
 */
export function consumeAppLockSuppression(): boolean {
  if (suppressNextLock) {
    suppressNextLock = false;
    return true;
  }
  return false;
}
