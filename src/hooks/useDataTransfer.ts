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
import { recordManualBackup } from "../services/autoBackup";
import { realAutoBackupDeps } from "../services/autoBackupDeps";
import {
  adoptProtection,
  BackupProtectionError,
  protectBackupText,
  unlockBackup,
  type ProtectionKey,
} from "../services/backupProtection";
import { realBackupProtectionDeps } from "../services/backupProtectionDeps";
import { resetBudgetAlertState } from "../services/budgetAlerts";
import { realBudgetAlertDeps } from "../services/budgetAlertsDeps";
import { syncDueReminders } from "../services/dueReminders";
import { realDueReminderDeps } from "../services/dueRemindersDeps";
import { readBackupData, replaceAllData } from "../database/backup";
import { getAllCreditCards } from "../database/creditCards";
import {
  getAllTransactions,
  importTransactions,
} from "../database/transactions";
import { ignoreCardPayments } from "../utils/cardImport";
import {
  backupFileName,
  BACKUP_FORMAT,
  buildBackupFile,
  countBackup,
  parseBackup,
  serializeBackup,
  type BackupCounts,
  type BackupFile,
} from "../utils/backup/backup";
import {
  buildTransactionsCsv,
  buildTransactionsHtmlReport,
} from "../utils/export";
import { decodeText } from "../utils/statements/fileText";
import type { CsvImportPlan } from "../utils/statements/importCsv";
import { logError } from "../utils/logger";
import { yieldToUi } from "../utils/yieldToUi";
import { clearPin } from "../utils/security";
import { planImportFromBytes } from "../utils/statements/statementImport";

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
    /** A chave do arquivo aberto pela senha, para continuar protegendo depois de restaurar (se o usuário quis). */
    adopt: ProtectionKey | null;
  } | null>(null);
  // Arquivo protegido que ainda espera a senha, e o estado da abertura.
  const [pendingPassword, setPendingPassword] = useState<{ text: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
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
      // Com a proteção por senha ligada o arquivo sai cifrado; se não der para cifrar, não sai (nunca aberto).
      const text = await protectBackupText(
        realBackupProtectionDeps,
        serializeBackup(buildBackupFile(await readBackupData(), now)),
      );

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
        // Só serve para o lembrete de backup; se falhar, o backup em si já foi entregue.
        await recordManualBackup(realAutoBackupDeps).catch(() => {});
      } else {
        showAlert(
          "Erro",
          "O compartilhamento não está disponível neste dispositivo.",
        );
      }
    } catch (error) {
      logError("Erro ao gerar o backup completo:", error);
      showAlert(
        "Erro",
        error instanceof BackupProtectionError ? error.message : "Não foi possível gerar o backup.",
      );
    }
  };

  /** Valida o conteúdo já aberto e prepara a confirmação. */
  const prepareRestore = async (text: string, adopt: ProtectionKey | null) => {
    const result = parseBackup(text);
    if (!result.ok) {
      showAlert("Backup inválido", result.error);
      return;
    }

    setPendingRestore({
      backup: result.backup,
      current: countBackup(await readBackupData()),
      adopt,
    });
  };

  /**
   * Lê e valida o arquivo; nada é alterado até o usuário confirmar. Um backup protegido
   * abre sozinho se a chave deste aparelho é a dele; senão pede a senha.
   */
  const handleRestoreBackup = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: "*/*" });
      if (picked.canceled) return;

      setIsReadingImport(true);
      const text = await picked.result.text();
      const unlocked = await unlockBackup(realBackupProtectionDeps, text);

      if (unlocked.status === "invalid") {
        showAlert("Backup inválido", unlocked.error);
      } else if (unlocked.status === "needs-password") {
        setPasswordError(null);
        setPendingPassword({ text });
      } else if (unlocked.status === "wrong-password") {
        showAlert("Backup inválido", "Senha incorreta ou arquivo alterado.");
      } else {
        await prepareRestore(unlocked.text, unlocked.status === "opened" ? unlocked.adoptable : null);
      }
    } catch (error) {
      logError("Erro ao ler o backup:", error);
      showAlert("Erro", "Não foi possível ler o arquivo selecionado.");
    } finally {
      setIsReadingImport(false);
    }
  };

  /** A senha digitada para abrir o backup protegido (pode levar alguns segundos: é o custo da chave). */
  const submitRestorePassword = async (password: string, keepProtection: boolean) => {
    const pending = pendingPassword;
    if (!pending) return;

    setIsUnlocking(true);
    setPasswordError(null);
    try {
      await yieldToUi();
      const unlocked = await unlockBackup(realBackupProtectionDeps, pending.text, password);
      if (unlocked.status === "wrong-password") {
        setPasswordError("Senha incorreta ou arquivo alterado.");
      } else if (unlocked.status === "opened") {
        setPendingPassword(null);
        await prepareRestore(unlocked.text, keepProtection ? unlocked.adoptable : null);
      } else {
        setPendingPassword(null);
        showAlert("Backup inválido", "Não foi possível abrir esse arquivo.");
      }
    } catch (error) {
      logError("Erro ao abrir o backup protegido:", error);
      setPasswordError("Não foi possível abrir o backup. Tente de novo.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const cancelRestorePassword = () => {
    setPendingPassword(null);
    setPasswordError(null);
  };

  const confirmRestore = async () => {
    const restore = pendingRestore;
    setPendingRestore(null);
    if (!restore) return;

    try {
      await replaceAllData(restore.backup.data);
      // Dados novos: os alertas de orçamento recomeçam do ponto de partida, sem avisar o que já vinha assim.
      await resetBudgetAlertState(realBudgetAlertDeps).catch((error) =>
        logError("Erro ao reiniciar os alertas de orçamento:", error),
      );

      // Continua protegendo com a mesma senha (se o usuário quis). Não falha a restauração, que já foi feita.
      let keptProtection = false;
      if (restore.adopt) {
        try {
          await adoptProtection(realBackupProtectionDeps, restore.adopt);
          keptProtection = true;
        } catch (error) {
          logError("Erro ao manter a proteção do backup:", error);
        }
      }

      reloadDashboard();
      showAlert(
        "Sucesso",
        keptProtection
          ? "Backup restaurado. Os dados do app foram substituídos e seus próximos backups continuam protegidos com a mesma senha."
          : "Backup restaurado. Os dados do app foram substituídos.",
      );
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

      // O pagamento da fatura do cartão só vira despesa quando é pago na aba Cartões: aqui fica de fora.
      const plan = ignoreCardPayments(result.plan, (await getAllCreditCards()).length > 0);
      if (plan.toImport.length === 0) {
        showAlert(
          "Nada para importar",
          plan.totalRows === 0
            ? plan.ignoredTransfers
              ? "O arquivo só tem movimentações de caixinha/investimento, que não são importadas."
              : "O arquivo não tem nenhuma transação."
            : (plan.cardPaymentsIgnored
                ? `O arquivo só tem pagamento de fatura de cartão, que entra quando você paga a fatura na aba Cartões${plan.duplicates > 0 ? ", e transações que já estão no app" : ""}.`
                : `Todas as transações válidas do arquivo já estão no app${plan.invalid > 0 ? ` (${plan.invalid} linhas inválidas foram ignoradas)` : ""}.`),
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
      await resetBudgetAlertState(realBudgetAlertDeps).catch((error) =>
        logError("Erro ao reiniciar os alertas de orçamento:", error),
      );
      // Sem dívidas nem parcelas, os lembretes agendados não fazem mais sentido.
      syncDueReminders(realDueReminderDeps).catch((error) =>
        logError("Erro ao cancelar os lembretes de vencimento:", error),
      );
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
    pendingPassword,
    passwordError,
    isUnlocking,
    submitRestorePassword,
    cancelRestorePassword,
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
