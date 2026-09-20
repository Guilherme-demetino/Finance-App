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
 * Divide um valor total em N parcelas de valor igual, em centavos, para
 * não perder nem sobrar centavo por arredondamento — a diferença cai
 * inteira na última parcela.
 */
export function splitAmountIntoInstallments(
  total: number,
  count: number,
): number[] {
  if (count <= 1) return [total];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  const installments = new Array(count).fill(baseCents / 100);
  installments[count - 1] = (baseCents + remainderCents) / 100;
  return installments;
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

/**
 * O número de um campo de valor como o app o mostra ("1.250,50" → 1250.5). Vazio ou ilegível
 * devolve null (campo sem valor), nunca 0: 0 seria um limite de verdade.
 */
export function parseCurrencyInput(text: string): number | null {
  const cleaned = text.trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
