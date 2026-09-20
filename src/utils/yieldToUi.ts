/**
 * Deixa o React desenhar o "Gerando chave…" antes de um trabalho longo que segura o JavaScript
 * (o scrypt leva alguns segundos). Sem isso o aviso nem chega a aparecer.
 */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 80));
}
