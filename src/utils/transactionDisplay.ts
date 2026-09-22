import { CATEGORY_COLORS } from "../constants/colors";
import type { DisplayTransaction, EnrichedTransaction } from "../types";

/** O formato que as listas mostram (id como texto, cor e ícone já resolvidos). */
export function toDisplayTransaction(item: EnrichedTransaction): DisplayTransaction {
  return {
    id: String(item.id),
    description: item.description || "Sem título",
    amount: item.amount,
    type: item.type,
    date: item.date,
    category: item.category_id,
    color: item.color || CATEGORY_COLORS.categoryNeutral,
    icon: item.type === "income" ? "cash-outline" : "cart-outline",
    recurrenceType: item.recurrence_type,
    recurrenceGroupId: item.recurrence_group_id,
    installmentNumber: item.installment_number,
    installmentTotal: item.installment_total,
    account: item.account,
  };
}
