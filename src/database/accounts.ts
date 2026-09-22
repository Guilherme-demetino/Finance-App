import { getDatabase } from "./sqlite";
import type { AccountRow } from "../types";

/**
 * Nome usado quando nenhuma conta é escolhida (transações antigas, importadas ou geradas por outra tela — dívidas,
 * extrato). Não existe como linha formal em `accounts` até o usuário criar uma conta com esse nome.
 */
export const DEFAULT_ACCOUNT_NAME = "Conta principal";

export async function getAllAccounts(): Promise<AccountRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<AccountRow>("SELECT * FROM accounts ORDER BY id ASC");
}

export async function createAccount(name: string, color: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT INTO accounts (name, color) VALUES (?, ?)", [name.trim(), color]);
}

/**
 * Apaga uma conta. Como o nome dela é só texto nas transações e nos cartões (sem chave estrangeira, igual às
 * categorias), o que já foi lançado continua existindo — só deixa de aparecer atrelado a uma conta formal.
 */
export async function deleteAccount(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM accounts WHERE id = ?", [id]);
}
