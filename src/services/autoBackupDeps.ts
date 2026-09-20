import { Directory, File } from "expo-file-system";

import { getMeta, setMeta } from "../database/appMeta";
import { readBackupData } from "../database/backup";
import type { AutoBackupDeps } from "./autoBackup";
import { protectBackupText } from "./backupProtection";
import { realBackupProtectionDeps } from "./backupProtectionDeps";

/** As dependências de verdade: banco do app e a pasta escolhida pelo usuário (seletor de pastas do Android). */
export const realAutoBackupDeps: AutoBackupDeps = {
  getMeta,
  setMeta,
  readData: readBackupData,
  protectBackup: (text) => protectBackupText(realBackupProtectionDeps, text),
  async writeBackup(folderUri, fileName, text) {
    const file = new Directory(folderUri).createFile(fileName, "application/json");
    file.write(text);
  },
  async listBackupNames(folderUri) {
    return new Directory(folderUri).list().map((entry) => entry.name);
  },
  async deleteBackup(folderUri, fileName) {
    const entry = new Directory(folderUri)
      .list()
      .find((item) => item.name === fileName);
    if (entry instanceof File) entry.delete();
  },
  now: () => new Date(),
};
