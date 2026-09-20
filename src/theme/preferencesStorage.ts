import { getMeta, setMeta } from "../database/appMeta";
import { logError } from "../utils/logger";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_KEYS,
  parsePreferences,
  type ThemePreferences,
} from "./preferences";

/** Lê as preferências salvas no banco (tabela app_meta, que sobrevive a "Zerar dados"). Falha volta ao padrão. */
export async function loadPreferences(): Promise<ThemePreferences> {
  try {
    return parsePreferences({
      mode: await getMeta(PREFERENCE_KEYS.mode),
      highContrast: await getMeta(PREFERENCE_KEYS.highContrast),
      fontScale: await getMeta(PREFERENCE_KEYS.fontScale),
    });
  } catch (error) {
    logError("Erro ao ler as preferências de aparência:", error);
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: ThemePreferences): Promise<void> {
  try {
    await setMeta(PREFERENCE_KEYS.mode, preferences.mode);
    await setMeta(PREFERENCE_KEYS.highContrast, preferences.highContrast ? "1" : "0");
    await setMeta(PREFERENCE_KEYS.fontScale, String(preferences.fontScale));
  } catch (error) {
    logError("Erro ao salvar as preferências de aparência:", error);
  }
}
