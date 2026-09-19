import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";

import { useAlert } from "../context/AlertContext";
import { useReloadDashboard } from "../context/DashboardProviders";
import { usePeriod } from "../context/PeriodContext";
import { useProfile } from "../context/ProfileContext";
import {
  useTransactionsData,
  useTransactionsMutations,
} from "../context/TransactionsContext";
import { resetDatabase } from "../database/sqlite";
import { readBackupData, replaceAllData } from "../database/backup";
import {
  getAllTransactions,
  importTransactions,
} from "../database/transactions";
import {
  backupFileName,
  BACKUP_FORMAT,
  buildBackupFile,
  countBackup,
  parseBackup,
  serializeBackup,
  type BackupCounts,
  type BackupFile,
} from "../utils/backup";
import {
  buildTransactionsCsv,
  buildTransactionsHtmlReport,
} from "../utils/export";
import { decodeText } from "../utils/fileText";
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
  const [pendingRestore, setPendingRestore] = useState<{
    backup: BackupFile;
    current: BackupCounts;
  } | null>(null);
  const reloadDashboard = useReloadDashboard();

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

  /** Backup completo do app (arquivo JSON): vai para o compartilhamento, onde dá para guardar no Drive. */
  const handleExportBackup = async () => {
    try {
      const now = new Date();
      const text = serializeBackup(buildBackupFile(await readBackupData(), now));

      const file = new File(Paths.cache, backupFileName(now));
      if (file.exists) file.delete();
      file.create();
      file.write(text);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/json",
          dialogTitle: "Salvar backup completo",
          UTI: "public.json",
        });
      } else {
        showAlert(
          "Erro",
          "O compartilhamento não está disponível neste dispositivo.",
        );
      }
    } catch (error) {
      logError("Erro ao gerar o backup completo:", error);
      showAlert("Erro", "Não foi possível gerar o backup.");
    }
  };

  /** Lê e valida o arquivo; nada é alterado até o usuário confirmar. */
  const handleRestoreBackup = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: "*/*" });
      if (picked.canceled) return;

      setIsReadingImport(true);
      const result = parseBackup(await picked.result.text());
      if (!result.ok) {
        showAlert("Backup inválido", result.error);
        return;
      }

      setPendingRestore({
        backup: result.backup,
        current: countBackup(await readBackupData()),
      });
    } catch (error) {
      logError("Erro ao ler o backup:", error);
      showAlert("Erro", "Não foi possível ler o arquivo selecionado.");
    } finally {
      setIsReadingImport(false);
    }
  };

  const confirmRestore = async () => {
    const restore = pendingRestore;
    setPendingRestore(null);
    if (!restore) return;

    try {
      await replaceAllData(restore.backup.data);
      reloadDashboard();
      showAlert("Sucesso", "Backup restaurado. Os dados do app foram substituídos.");
    } catch (error) {
      logError("Erro ao restaurar o backup:", error);
      showAlert(
        "Erro",
        "Não foi possível restaurar o backup. Nada foi alterado nos dados do app.",
      );
    }
  };

  const handleImportFile = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: "*/*" });
      if (picked.canceled) return;

      setIsReadingImport(true);
      const bytes = new Uint8Array(await picked.result.arrayBuffer());

      // Um backup completo não é extrato: em vez de "formato desconhecido", diz o caminho certo.
      const head = decodeText(bytes.slice(0, 200));
      if (head.trimStart().startsWith("{") && head.includes(BACKUP_FORMAT)) {
        showAlert(
          "Esse é um backup completo",
          'Para usar esse arquivo, abra o menu e escolha "Restaurar backup".',
        );
        return;
      }
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
    handleExportBackup,
    handleRestoreBackup,
    pendingRestore,
    setPendingRestore,
    confirmRestore,
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
