import type { BackupProtectionDeps } from "../services/backupProtection";

/** Cofre de mentira (um valor em memória) e aleatoriedade repetível. Cada instância é um "aparelho". */
export function createFakeProtectionDeps(seed = 1) {
  let counter = seed * 1000;
  const state = {
    secret: null as string | null,
    readError: null as Error | null,
    writeError: null as Error | null,
    writes: 0,
  };

  const deps: BackupProtectionDeps = {
    async readSecret() {
      if (state.readError) throw state.readError;
      return state.secret;
    },
    async writeSecret(value) {
      if (state.writeError) throw state.writeError;
      state.writes += 1;
      state.secret = value;
    },
    async deleteSecret() {
      state.secret = null;
    },
    randomBytes: (length) => Uint8Array.from({ length }, () => (counter++ * 131 + 17) % 256),
  };

  return { deps, state };
}
