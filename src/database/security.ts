import { getDatabase } from "./sqlite";

/**
 * Lê o PIN legado (texto puro, de antes do expo-secure-store), se existir.
 * Usado só para a migração automática de instalações antigas.
 */
export async function getLegacyPin(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pin: string }>(
    "SELECT pin FROM security LIMIT 1",
  );
  return row?.pin ?? null;
}

/** Remove o registro legado depois que o PIN já foi migrado pro SecureStore. */
export async function clearLegacyPin(): Promise<void> {
  const db = await getDatabase();
  db.runSync("DELETE FROM security");
}
