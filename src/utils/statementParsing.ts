import type { TransactionType } from "../types";

/** Minúsculas e sem acentos, pra comparar cabeçalhos e descrições de bancos diferentes. */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toDateString(day: number, month: number, year: number): string | null {
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!isRealDate) return null;

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/**
 * Lê uma data em vários formatos de banco (DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA,
 * DD.MM.AAAA, AAAA-MM-DD), ignorando uma hora depois dela, e devolve
 * DD/MM/AAAA. Retorna null se não for uma data real.
 */
export function parseFlexibleDate(raw: string): string | null {
  const text = raw.trim();

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
  if (iso) return toDateString(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    return toDateString(Number(br[1]), Number(br[2]), year);
  }

  return null;
}

export type AmountSign = "negative" | "positive" | "none";

export interface ParsedAmount {
  /** Valor absoluto, com duas casas. */
  amount: number;
  /** Sinal escrito no arquivo: "-", "(...)" ou "D" = negative; "+" ou "C" = positive. */
  sign: AmountSign;
}

/**
 * Lê valores como "R$ 1.234,56", "-1.234,56", "1234.56", "1,234.56",
 * "(123,45)", "123,45-", "123,45 D" ou "123,45 C". Zero e texto sem número
 * retornam null.
 */
export function parseSignedAmount(raw: string): ParsedAmount | null {
  let text = raw.trim();
  if (!text) return null;

  let sign: AmountSign = "none";

  if (/^\(.*\)$/.test(text)) {
    sign = "negative";
    text = text.slice(1, -1);
  }

  const suffix = text.match(/\s*([DCdc])$/);
  if (suffix) {
    sign = suffix[1].toUpperCase() === "D" ? "negative" : "positive";
    text = text.slice(0, suffix.index);
  }

  if (/[-−]\s*$/.test(text)) {
    sign = "negative";
    text = text.replace(/[-−]\s*$/, "");
  }
  if (/^\s*[-−]/.test(text) || /^[^\d]*[-−]\s*\d/.test(text)) {
    sign = "negative";
  } else if (/^\s*\+/.test(text) && sign === "none") {
    sign = "positive";
  }

  const cleaned = text.replace(/[^\d,.]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    // Os dois aparecem: o que vier por último é o separador decimal.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Só vírgula: decimal, a não ser que se repita (1,234,567 = milhar).
    normalized =
      cleaned.indexOf(",") !== lastComma
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(",", ".");
  } else if (lastDot !== -1) {
    // Só ponto: decimal se tiver 1-2 casas depois; senão é milhar (1.234).
    const decimals = cleaned.length - lastDot - 1;
    normalized =
      decimals <= 2 && cleaned.indexOf(".") === lastDot
        ? cleaned
        : cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value === 0) return null;

  return { amount: Math.round(Math.abs(value) * 100) / 100, sign };
}

const INCOME_STRONG = [
  "recebid",
  "estorno",
  "reembolso",
  "cashback",
  "salario",
  "rendimento",
  "deposito",
  "proventos",
  "resgate",
  "pix rec",
  "transf rec",
];

const EXPENSE_HINTS = [
  "compra",
  "pagamento",
  "pgto",
  "debito",
  "enviad",
  "saque",
  "tarifa",
  "boleto",
  "fatura",
  "cobranca",
  "anuidade",
  "iof",
  "juros",
  "multa",
  "parcela",
  "assinatura",
  "pix env",
  "transf env",
];

/**
 * Chuta se um lançamento sem sinal é receita ou despesa pelo texto da
 * descrição ("recebido", "salário" → receita; "compra", "pagamento" →
 * despesa). Sem pistas, considera despesa, que é o caso mais comum.
 */
export function guessTypeFromDescription(description: string): TransactionType {
  const text = normalizeText(description);
  if (INCOME_STRONG.some((word) => text.includes(word))) return "income";
  if (EXPENSE_HINTS.some((word) => text.includes(word))) return "expense";
  if (text.includes("credito")) return "income";
  return "expense";
}

const CATEGORY_KEYWORDS: { category: string; words: string[] }[] = [
  {
    category: "Alimentação",
    words: [
      "mercado",
      "supermercado",
      "padaria",
      "restaurante",
      "lanchonete",
      "lanche",
      "ifood",
      "rappi",
      "pizzaria",
      "acougue",
      "hortifruti",
      "cafeteria",
      "burger",
      "mcdonald",
    ],
  },
  {
    category: "Transporte",
    words: [
      "uber",
      "99 ",
      "99app",
      "posto",
      "combustivel",
      "gasolina",
      "estacionamento",
      "pedagio",
      "sem parar",
      "metro",
      "onibus",
    ],
  },
  {
    category: "Saúde",
    words: [
      "farmacia",
      "drogaria",
      "drogasil",
      "hospital",
      "clinica",
      "laboratorio",
      "plano de saude",
      "unimed",
      "dentista",
    ],
  },
  {
    category: "Lazer",
    words: [
      "netflix",
      "spotify",
      "cinema",
      "steam",
      "prime video",
      "disney",
      "hbo max",
      "youtube",
      "playstation",
      "xbox",
    ],
  },
  {
    category: "Moradia",
    words: [
      "aluguel",
      "condominio",
      "energia",
      "enel",
      "cemig",
      "sabesp",
      "copel",
      "internet",
      "vivo",
      "claro",
      "tim ",
    ],
  },
];

const INTERNAL_TRANSFER_HINTS = [
  "rdb",
  "caixinha",
  "dinheiro guardado",
  "dinheiro resgatado",
  "dinheiro retirado",
  "resgate planejado",
];

/**
 * Movimentação do próprio dinheiro entre a conta e uma caixinha/investimento
 * (ex: "Aplicação RDB", "Resgate RDB", "Dinheiro guardado"). Não é receita
 * nem despesa de verdade, então a importação ignora.
 */
export function isInternalTransfer(description: string): boolean {
  const text = ` ${normalizeText(description)} `;
  return INTERNAL_TRANSFER_HINTS.some((hint) => text.includes(` ${hint}`));
}

/**
 * Sugere uma das categorias padrão do app a partir de palavras da
 * descrição. Toda receita importada entra como "Salário"; despesa sem pista
 * clara usa "Geral".
 */
export function guessCategory(
  description: string,
  type: TransactionType,
): string {
  const text = ` ${normalizeText(description)} `;
  if (type === "income") return "Salário";

  const match = CATEGORY_KEYWORDS.find(({ words }) =>
    words.some((word) => text.includes(word)),
  );
  return match?.category ?? "Geral";
}
