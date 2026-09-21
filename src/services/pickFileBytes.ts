import { File } from "expo-file-system";

/** Abre o seletor de arquivos do aparelho e devolve o conteúdo do escolhido; null se o usuário cancelou. */
export async function pickFileBytes(): Promise<Uint8Array | null> {
  const picked = await File.pickFileAsync({ mimeTypes: "*/*" });
  if (picked.canceled) return null;
  return new Uint8Array(await picked.result.arrayBuffer());
}
