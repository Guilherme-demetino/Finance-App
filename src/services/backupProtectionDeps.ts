import { uuid } from "expo-modules-core";
import * as SecureStore from "expo-secure-store";

import { createRandomBytes } from "../utils/backup/randomBytes";
import type { BackupProtectionDeps } from "./backupProtection";

const SECRET_KEY = "finance_app_backup_key";

/**
 * As dependências de verdade: o cofre do sistema (SecureStore, o mesmo do PIN) e os bytes
 * aleatórios do gerador seguro do Android, pelo UUID v4 do expo-modules-core.
 */
export const realBackupProtectionDeps: BackupProtectionDeps = {
  readSecret: () => SecureStore.getItemAsync(SECRET_KEY),
  writeSecret: (value) => SecureStore.setItemAsync(SECRET_KEY, value),
  deleteSecret: () => SecureStore.deleteItemAsync(SECRET_KEY),
  randomBytes: createRandomBytes(() => uuid.v4()),
};
