import { getDatabase } from "./sqlite";
import type { UserRow } from "../types";

export async function getUser(): Promise<UserRow | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<UserRow>("SELECT * FROM users LIMIT 1");
  return rows[0] ?? null;
}

export async function updateUserName(name: string): Promise<void> {
  const db = await getDatabase();
  db.runSync("UPDATE users SET name = ? WHERE id = 1", name);
}

/** Cria o usuário (id fixo 1) se ainda não existir, ou apenas atualiza o nome. */
export async function upsertUserName(name: string): Promise<void> {
  const db = await getDatabase();
  db.runSync("INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)", name);
  db.runSync("UPDATE users SET name = ? WHERE id = 1", name);
}

/**
 * Atualiza o avatar do usuário. Instalações antigas podem ter a tabela
 * `users` criada antes da coluna `avatar` existir — o ALTER TABLE aqui
 * garante que ela exista antes do UPDATE (é um no-op se já existir).
 */
export async function updateUserAvatar(
  avatarUri: string,
  fallbackName: string,
): Promise<void> {
  const db = await getDatabase();

  try {
    db.runSync("ALTER TABLE users ADD COLUMN avatar TEXT;");
  } catch {
    // coluna já existe — instalação recente, nada a fazer
  }

  db.runSync("INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)", fallbackName);
  db.runSync("UPDATE users SET avatar = ? WHERE id = 1", avatarUri);
}
