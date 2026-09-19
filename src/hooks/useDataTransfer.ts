import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";

import { useAlert } from "../context/AlertContext";
import { usePeriod } from "../context/PeriodContext";
import { useProfile } from "../context/ProfileContext";
import {
  useTransactionsData,
  useTransactionsMutations,
} from "../context/TransactionsContext";
import { resetDatabase } from "../database/sqlite";
import {
  getAllTransactions,
  importTransactions,
} from "../database/transactions";
import {
  buildTransactionsCsv,
  buildTransactionsHtmlReport,
} from "../utils/export";
import type { CsvImportPlan } from "../utils/importCsv";
import { logError } from "../utils/logger";
import { clearPin } from "../utils/security";
import { planImportFromBytes } from "../utils/statementImport";

/**
 * Exportar (PDF/CSV), importar, trocar o PIN e zerar o app: tudo que o menu do
 * perfil dispara. Só o menu usa, então fica num hook em vez de num contexto.
 * Fechar o próprio menu é com quem chama.
 */
export function useDataTransfer() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { selectedMonth, selectedYear } = usePeriod();
  const { userName } = useProfile();
  const { transactions, totalIncome, totalExpense, totalBalance } =
    useTransactionsData();
  const { refreshTransactions } = useTransactionsMutations();

  const [pendingImport, setPendingImport] = useState<CsvImportPlan | null>(
    null,
  );
  const [isReadingImport, setIsReadingImport] = useState(false);
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);

  const handleExportPDF = async () => {
    try {
      if (transactions.length === 0) {
        showAlert("Atenção", "Não há transações neste período para exportar.");
        return;
      }

      const htmlContent = buildTransactionsHtmlReport({
        userName,
        selectedMonth,
        selectedYear,
        totalIncome,
        totalExpense,
        totalBalance,
        transactions,
      });

      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      logError("Erro ao gerar PDF:", error);
      showAlert("Erro", "Não foi possível gerar o arquivo PDF.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const allTransactions = await getAllTransactions();

      if (!allTransactions || allTransactions.length === 0) {
        showAlert("Atenção", "Não há transações para exportar.");
        return;
      }

      const csvContent = buildTransactionsCsv(allTransactions);

      const fileName = `financas-backup-${Date.now()}.csv`;
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Exportar backup em CSV",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        showAlert(
          "Erro",
          "O compartilhamento não está disponível neste dispositivo.",
        );
      }
    } catch (error) {
      logError("Erro ao gerar CSV:", error);
      showAlert("Erro", "Não foi possível gerar o arquivo CSV.");
    }
  };

  const handleImportFile = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: "*/*" });
      if (picked.canceled) return;

      setIsReadingImport(true);
      const bytes = new Uint8Array(await picked.result.arrayBuffer());
      const existing = await getAllTransactions();
      const result = await planImportFromBytes(bytes, existing);

      if (!result.ok) {
        showAlert("Arquivo inválido", result.error);
        return;
      }

      const { plan } = result;
      if (plan.toImport.length === 0) {
        showAlert(
          "Nada para importar",
          plan.totalRows === 0
            ? plan.ignoredTransfers
              ? "O arquivo só tem movimentações de caixinha/investimento, que não são importadas."
              : "O arquivo não tem nenhuma transação."
            : `Todas as transações válidas do arquivo já estão no app${plan.invalid > 0 ? ` (${plan.invalid} linhas inválidas foram ignoradas)` : ""}.`,
        );
        return;
      }

      setPendingImport(plan);
    } catch (error) {
      logError("Erro ao ler o arquivo de importação:", error);
      showAlert("Erro", "Não foi possível ler o arquivo selecionado.");
    } finally {
      setIsReadingImport(false);
    }
  };

  const confirmImport = async () => {
    const plan = pendingImport;
    setPendingImport(null);
    if (!plan) return;

    try {
      await importTransactions(plan.toImport);
      await refreshTransactions();
      showAlert(
        "Sucesso",
        `${plan.toImport.length} ${plan.toImport.length === 1 ? "transação importada" : "transações importadas"} com sucesso.`,
      );
    } catch (error) {
      logError("Erro ao importar backup:", error);
      showAlert("Erro", "Não foi possível importar as transações.");
    }
  };

  const handleChangePIN = () => {
    // O PIN atual só é sobrescrito quando o novo for confirmado na tela
    // de segurança — se o usuário voltar sem concluir, nada muda.
    router.replace({ pathname: "/security", params: { mode: "change" } });
  };

  const confirmWipeData = async () => {
    setIsWipeConfirmOpen(false);
    try {
      await resetDatabase();
      await clearPin();
      router.replace("/"); // Volta para a tela de boas-vindas
    } catch (error) {
      logError("Erro ao zerar dados:", error);
      showAlert("Erro", "Não foi possível formatar o aplicativo.");
    }
  };

  return {
    handleExportPDF,
    handleExportCSV,
    handleImportFile,
    pendingImport,
    setPendingImport,
    isReadingImport,
    confirmImport,
    handleChangePIN,
    isWipeConfirmOpen,
    setIsWipeConfirmOpen,
    confirmWipeData,
  };
}
