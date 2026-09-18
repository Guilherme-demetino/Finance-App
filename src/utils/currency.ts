interface FormatCurrencyOptions {
  /** Força o prefixo de sinal ("+" ou "-") independente do valor recebido. */
  forceSign?: "+" | "-";
}

/**
 * Formata um número como moeda brasileira (R$ 1.234,56), sempre com
 * separador de milhar e duas casas decimais. Valores negativos usam
 * "- R$" (em vez de "R$ -"), seguindo a convenção do resto do app.
 */
export function formatCurrency(
  value: number,
  options?: FormatCurrencyOptions,
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const magnitude = Math.abs(safeValue).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let signPrefix = "";
  if (options?.forceSign) {
    signPrefix = `${options.forceSign} `;
  } else if (safeValue < 0) {
    signPrefix = "- ";
  }

  return `${signPrefix}R$ ${magnitude}`;
}
