import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import type { DebtDraft, InstallmentDraft, RecurringDraft } from "../types";
import { formatCurrency } from "./currency";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface OnboardingEntry {
  id: string;
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  amountText: string;
  onRemove: () => void;
}

interface EntryColors {
  income: string;
  expense: string;
}

/** Linhas do passo "Contas e receitas fixas" do onboarding, uma por item já adicionado. */
export function buildRecurringEntries(
  items: RecurringDraft[],
  colors: EntryColors,
  onRemove: (id: string) => void,
): OnboardingEntry[] {
  return items.map((item) => ({
    id: item.id,
    icon: item.type === "income" ? "arrow-down-outline" : "arrow-up-outline",
    color: item.type === "income" ? colors.income : colors.expense,
    title: item.title,
    subtitle: `Todo dia ${item.day} • ${item.category}`,
    amountText: formatCurrency(item.amount),
    onRemove: () => onRemove(item.id),
  }));
}

/** Linhas do passo "Compras parceladas" do onboarding, uma por item já adicionado. */
export function buildInstallmentEntries(
  items: InstallmentDraft[],
  colors: EntryColors,
  onRemove: (id: string) => void,
): OnboardingEntry[] {
  return items.map((item) => {
    const remaining = item.total - item.startNumber + 1;
    return {
      id: item.id,
      icon: "card-outline" as IconName,
      color: colors.expense,
      title: item.title,
      subtitle: `${remaining} ${remaining === 1 ? "parcela restante" : "parcelas restantes"} • próxima em ${item.firstDate}`,
      amountText: `${formatCurrency(item.installmentAmount)}/mês`,
      onRemove: () => onRemove(item.id),
    };
  });
}

/** Linhas do passo "Dívidas e empréstimos" do onboarding, uma por item já adicionado. */
export function buildDebtEntries(
  items: DebtDraft[],
  colors: EntryColors,
  onRemove: (id: string) => void,
): OnboardingEntry[] {
  return items.map((item) => ({
    id: item.id,
    icon: (item.type === "lent" ? "arrow-down-outline" : "arrow-up-outline") as IconName,
    color: item.type === "lent" ? colors.income : colors.expense,
    title: item.person,
    subtitle: `${item.type === "lent" ? "Te deve" : "Você deve"}${item.dueDate ? ` • até ${item.dueDate}` : ""}`,
    amountText: formatCurrency(item.amount),
    onRemove: () => onRemove(item.id),
  }));
}
