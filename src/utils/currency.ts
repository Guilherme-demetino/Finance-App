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

/**
 * Máscara de moeda para campos de texto: recebe o que o usuário digitou
 * (dígitos crus, ex: "150") e devolve formatado como "1,50" enquanto ele
 * digita (interpreta os dígitos como centavos).
 */
export function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";

  const amount = (Number(numbers) / 100).toFixed(2);
  const parts = amount.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}
