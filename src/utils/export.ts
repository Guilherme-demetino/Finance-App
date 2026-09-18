import type { TransactionRow } from "../types";
import { formatCurrency } from "./currency";

/**
 * Gera o HTML do relatório em PDF. As cores aqui são fixas (tema claro
 * de impressão) e propositalmente independentes da paleta escura do
 * app — é um documento pensado para ser impresso/lido em papel.
 */
export function buildTransactionsHtmlReport(params: {
  userName: string;
  selectedMonth: string;
  selectedYear: string;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  transactions: TransactionRow[];
}): string {
  const {
    userName,
    selectedMonth,
    selectedYear,
    totalIncome,
    totalExpense,
    totalBalance,
    transactions,
  } = params;

  const rows = transactions
    .map(
      (t) => `
        <tr>
          <td>${t.date}</td>
          <td>${t.description}</td>
          <td>${t.category_id || "Geral"}</td>
          <td>${t.type === "income" ? "Receita" : "Despesa"}</td>
          <td class="${t.type === "income" ? "income" : "expense"}">
            ${formatCurrency(t.amount, { forceSign: t.type === "income" ? "+" : "-" })}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica', Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1E1E1E; font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          .info { margin-bottom: 20px; font-size: 14px; color: #555; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f4f4f4; padding: 15px; border-radius: 8px; }
          .summary-item { font-size: 14px; font-weight: bold; }
          .income { color: #10B981; }
          .expense { color: #EF4444; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #2A2A2A; color: #fff; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Relatório Financeiro — ${selectedMonth} de ${selectedYear}</h1>
        <div class="info">
          <p><strong>Usuário:</strong> ${userName}</p>
          <p><strong>Data de geração:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        <div class="summary">
          <div class="summary-item">Receitas: <span class="income">${formatCurrency(totalIncome)}</span></div>
          <div class="summary-item">Despesas: <span class="expense">${formatCurrency(totalExpense)}</span></div>
          <div class="summary-item">Saldo: ${formatCurrency(totalBalance)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function csvEscape(value: string): string {
  const safeValue = String(value ?? "");
  if (/[;"\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/** Gera um CSV (separado por `;`) com todas as transações, para backup. */
export function buildTransactionsCsv(transactions: TransactionRow[]): string {
  const header = "Data;Descrição;Categoria;Tipo;Valor";
  const rows = transactions.map((t) => {
    const tipo = t.type === "income" ? "Receita" : "Despesa";
    const valor = Number(t.amount).toFixed(2).replace(".", ",");
    return [
      csvEscape(t.date),
      csvEscape(t.description || "Sem descrição"),
      csvEscape(t.category_id || "Geral"),
      csvEscape(tipo),
      csvEscape(valor),
    ].join(";");
  });

  // BOM UTF-8 na frente, pra acentos abrirem certo no Excel
  return "﻿" + [header, ...rows].join("\n");
}
