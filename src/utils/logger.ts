/**
 * Ponto único para registrar erros que o app captura e trata (geralmente
 * mostrando um aviso ao usuário). Centralizar aqui permite mudar o destino
 * depois, por exemplo enviar para um serviço de falhas, sem mexer em cada catch.
 *
 * Usa console.error: no app instalado não aparece nada na tela, e no
 * desenvolvimento o LogBox destaca o erro.
 */
export function logError(context: string, error?: unknown): void {
  console.error(context, error);
}
