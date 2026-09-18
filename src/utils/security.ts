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
