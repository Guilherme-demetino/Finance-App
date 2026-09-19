import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Sharing from "expo-sharing";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { colors } from "../constants/colors";
import type { DebtInput } from "../database/debts";
import { resetDatabase } from "../database/sqlite";
import {
  getAllTransactions,
  importTransactions,
} from "../database/transactions";
import { useBudget } from "../hooks/useBudget";
import { useCategoryBudgets } from "../hooks/useCategoryBudgets";
import { useDebts } from "../hooks/useDebts";
import { useMonthComparison } from "../hooks/useMonthComparison";
import { useSavingsGoals } from "../hooks/useSavingsGoals";
import { useTransactions } from "../hooks/useTransactions";
import { useUserProfile } from "../hooks/useUserProfile";
import type {
  DebtRow,
  DisplayTransaction,
  SavingsGoalRow,
  TransactionType,
} from "../types";
import { MONTH_NAMES } from "../utils/dates";
import {
  buildTransactionsCsv,
  buildTransactionsHtmlReport,
} from "../utils/export";
import type { CsvImportPlan } from "../utils/importCsv";
import { planImportFromBytes } from "../utils/statementImport";
import { clearPin } from "../utils/security";

export const YEARS_LIST = ["2024", "2025", "2026", "2027", "2028"];

interface DashboardContextValue {
  userName: string;
  userImage: string | null;
  isMenuOpen: boolean;
  setIsMenuOpen: (value: boolean) => void;
  isEditingName: boolean;
  setIsEditingName: (value: boolean) => void;
  newName: string;
  setNewName: (value: string) => void;
  pickImage: () => Promise<void>;
  handleUpdateName: () => Promise<void>;

  isLandscapePanoramaOpen: boolean;
  openLandscapePanorama: () => Promise<void>;
  closeLandscapePanorama: () => Promise<void>;

  scrollY: SharedValue<number>;

  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  selectedYear: string;
  setSelectedYear: (value: string) => void;
  isMonthModalOpen: boolean;
  setIsMonthModalOpen: (value: boolean) => void;
  isYearModalOpen: boolean;
  setIsYearModalOpen: (value: boolean) => void;

  transactions: ReturnType<typeof useTransactions>["transactions"];
  saveTransaction: ReturnType<typeof useTransactions>["saveTransaction"];
  isLoadingTransactions: boolean;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  monthsData: ReturnType<typeof useTransactions>["monthsData"];
  formattedTransactions: DisplayTransaction[];

  budget: ReturnType<typeof useBudget>["budget"];
  updateBudget: ReturnType<typeof useBudget>["updateBudget"];
  isEditingBudget: boolean;
  setIsEditingBudget: (value: boolean) => void;

  categoryBudgets: ReturnType<typeof useCategoryBudgets>["categoryBudgets"];
  isLoadingCategoryBudgets: boolean;
  saveCategoryGoal: ReturnType<typeof useCategoryBudgets>["saveCategoryGoal"];
  handleDeleteCategory: (id: number) => Promise<void>;
  refreshCategoryBudgets: ReturnType<
    typeof useCategoryBudgets
  >["refreshCategoryBudgets"];

  comparison: ReturnType<typeof useMonthComparison>["comparison"];
  isLoadingComparison: boolean;

  pendingDebts: DebtRow[];
  settledDebts: DebtRow[];
  totalToReceive: number;
  totalToPay: number;
  isLoadingDebts: boolean;
  isDebtModalOpen: boolean;
  setIsDebtModalOpen: (value: boolean) => void;
  handleAddDebt: (data: DebtInput) => Promise<void>;
  handleSettleDebt: (debt: DebtRow) => Promise<void>;
  handleDeleteDebt: (id: number) => Promise<void>;

  savingsGoals: SavingsGoalRow[];
  isLoadingSavings: boolean;
  isSavingsModalOpen: boolean;
  setIsSavingsModalOpen: (value: boolean) => void;
  depositGoal: SavingsGoalRow | null;
  setDepositGoal: (goal: SavingsGoalRow | null) => void;
  handleAddSavingsGoal: (data: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
  }) => Promise<void>;
  handleChangeSavings: (goal: SavingsGoalRow, delta: number) => Promise<void>;
  handleDeleteSavingsGoal: (id: number) => Promise<void>;

  pendingImport: CsvImportPlan | null;
  setPendingImport: (plan: CsvImportPlan | null) => void;
  handleImportFile: () => Promise<void>;
  isReadingImport: boolean;
  confirmImport: () => Promise<void>;

  alertVisible: boolean;
  alertTitle: string;
  alertMessage: string;
  setAlertVisible: (value: boolean) => void;
  showAlert: (title: string, message: string) => void;

  handleExportPDF: () => Promise<void>;
  handleExportCSV: () => Promise<void>;
  handleDeleteTransaction: (id: string) => Promise<void>;
  handleDeleteAllTransactions: () => Promise<void>;
  handleDeleteSeriesFromId: (groupId: string, fromId: number) => Promise<void>;
  handleDeleteSeries: (groupId: string) => Promise<void>;
  handleChangePIN: () => void;
  handleWipeData: () => void;
  isWipeConfirmOpen: boolean;
  setIsWipeConfirmOpen: (value: boolean) => void;
  confirmWipeData: () => Promise<void>;

  currentMonthNum: string;
  currentYearStr: string;
  currentDay: string;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const today = new Date();
  const currentMonthName = MONTH_NAMES[today.getMonth()];
  const currentYearStr = String(today.getFullYear());
  const currentDay = String(today.getDate()).padStart(2, "0");
  const currentMonthNum = String(today.getMonth() + 1).padStart(2, "0");

  const { userName, userImage, updateName, updateAvatar } = useUserProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<SavingsGoalRow | null>(null);
  const [pendingImport, setPendingImport] = useState<CsvImportPlan | null>(
    null,
  );
  const [isReadingImport, setIsReadingImport] = useState(false);

  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  // Acompanha o quanto a tela rolou pra animar a borda do cabeçalho fixo.
  // Compartilhado entre as abas pra o cabeçalho (renderizado uma vez no
  // layout) reagir ao scroll de qualquer uma delas.
  const scrollY = useSharedValue(0);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  const {
    transactions,
    isLoading: isLoadingTransactions,
    totalIncome,
    totalExpense,
    monthsData,
    saveTransaction,
    removeTransaction,
    removeAllForCurrentPeriod,
    removeSeries,
    removeSeriesFromId,
    refresh: refreshTransactions,
  } = useTransactions(selectedMonth, selectedYear);
  const totalBalance = totalIncome - totalExpense;

  const { budget, updateBudget } = useBudget(selectedMonth, selectedYear);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const {
    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    removeCategory,
    refreshCategoryBudgets,
  } = useCategoryBudgets(selectedMonth, selectedYear, transactions);

  const { comparison, isLoadingComparison } = useMonthComparison(
    selectedMonth,
    selectedYear,
    transactions,
  );

  const {
    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    addDebt,
    settleDebt,
    removeDebt,
  } = useDebts();

  const {
    savingsGoals,
    isLoadingSavings,
    addSavingsGoal,
    changeSavedAmount,
    removeSavingsGoal,
  } = useSavingsGoals();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const openLandscapePanorama = async () => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );
    setIsLandscapePanoramaOpen(true);
  };

  const closeLandscapePanorama = async () => {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
    setIsLandscapePanoramaOpen(false);
  };

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert(
        "Permissão negada",
        "Precisamos de acesso à galeria para alterar sua foto.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        await updateAvatar(result.assets[0].uri);
        showAlert("Sucesso", "Foto de perfil atualizada com sucesso!");
      } catch (error) {
        console.log("Erro ao salvar foto no banco:", error);
        showAlert("Erro", "Não foi possível salvar a imagem.");
      }
    }
  };

  const handleUpdateName = async () => {
    if (newName.trim() === "") {
      showAlert("Atenção", "O nome não pode ficar vazio.");
      return;
    }

    try {
      await updateName(newName);
      setNewName("");
      setIsEditingName(false);
      setIsMenuOpen(false);
      showAlert("Sucesso", "Nome alterado com sucesso!");
    } catch (error) {
      console.log("Erro ao atualizar nome:", error);
      showAlert("Erro", "Não foi possível atualizar o nome.");
    }
  };

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
      console.log("Erro ao gerar PDF:", error);
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
      console.log("Erro ao gerar CSV:", error);
      showAlert("Erro", "Não foi possível gerar o arquivo CSV.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await removeTransaction(Number(id));
      showAlert("Sucesso", "Transação excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir transação:", error);
      showAlert("Erro", "Não foi possível excluir a transação.");
    }
  };

  const handleDeleteAllTransactions = async () => {
    try {
      await removeAllForCurrentPeriod();
      showAlert(
        "Sucesso",
        "Todas as transações deste período foram excluídas.",
      );
    } catch (error) {
      console.log("Erro ao excluir transações:", error);
      showAlert("Erro", "Não foi possível excluir as transações.");
    }
  };

  const handleDeleteSeriesFromId = async (groupId: string, fromId: number) => {
    try {
      await removeSeriesFromId(groupId, fromId);
      showAlert(
        "Sucesso",
        "Esta e as próximas ocorrências da série foram excluídas.",
      );
    } catch (error) {
      console.log("Erro ao excluir ocorrências futuras da série:", error);
      showAlert("Erro", "Não foi possível excluir as ocorrências futuras.");
    }
  };

  const handleDeleteSeries = async (groupId: string) => {
    try {
      await removeSeries(groupId);
      showAlert("Sucesso", "Série excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir série:", error);
      showAlert("Erro", "Não foi possível excluir a série.");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await removeCategory(id);
      showAlert("Sucesso", "Categoria excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir categoria:", error);
      showAlert("Erro", "Não foi possível excluir a categoria.");
    }
  };

  const handleAddDebt = async (data: DebtInput) => {
    try {
      await addDebt(data);
      showAlert("Sucesso", "Registrado com sucesso.");
    } catch (error) {
      console.log("Erro ao registrar dívida/empréstimo:", error);
      showAlert("Erro", "Não foi possível registrar.");
    }
  };

  const handleSettleDebt = async (debt: DebtRow) => {
    try {
      const todayStr = `${currentDay}/${currentMonthNum}/${currentYearStr}`;
      await settleDebt(debt.id, todayStr);

      // Quitar de fato move dinheiro — só a partir de agora isso entra no
      // saldo, como uma transação normal (não afeta meses já fechados).
      const debtTransactionType: TransactionType =
        debt.type === "lent" ? "income" : "expense";
      await saveTransaction(null, {
        amount: debt.amount,
        date: todayStr,
        description:
          debt.type === "lent"
            ? `Recebimento de ${debt.person}`
            : `Pagamento a ${debt.person}`,
        type: debtTransactionType,
        category: "Empréstimos",
      });

      showAlert("Sucesso", "Dívida quitada e registrada no seu saldo.");
    } catch (error) {
      console.log("Erro ao quitar dívida:", error);
      showAlert("Erro", "Não foi possível quitar a dívida.");
    }
  };

  const handleDeleteDebt = async (id: number) => {
    try {
      await removeDebt(id);
      showAlert("Sucesso", "Registro excluído com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir dívida:", error);
      showAlert("Erro", "Não foi possível excluir o registro.");
    }
  };

  const handleAddSavingsGoal = async (data: {
    name: string;
    targetAmount: number;
    savedAmount: number;
    deadline: string | null;
  }) => {
    try {
      await addSavingsGoal({
        ...data,
        createdDate: `${currentDay}/${currentMonthNum}/${currentYearStr}`,
      });
      showAlert("Sucesso", "Meta de economia criada.");
    } catch (error) {
      console.log("Erro ao criar meta de economia:", error);
      showAlert("Erro", "Não foi possível criar a meta.");
    }
  };

  const handleChangeSavings = async (goal: SavingsGoalRow, delta: number) => {
    try {
      await changeSavedAmount(goal, delta);
    } catch (error) {
      console.log("Erro ao atualizar valor guardado:", error);
      showAlert("Erro", "Não foi possível atualizar a meta.");
    }
  };

  const handleDeleteSavingsGoal = async (id: number) => {
    try {
      await removeSavingsGoal(id);
      showAlert("Sucesso", "Meta excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir meta de economia:", error);
      showAlert("Erro", "Não foi possível excluir a meta.");
    }
  };

  const handleImportFile = async () => {
    setIsMenuOpen(false);
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
      console.log("Erro ao ler o arquivo de importação:", error);
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
      console.log("Erro ao importar backup:", error);
      showAlert("Erro", "Não foi possível importar as transações.");
    }
  };

  const handleChangePIN = () => {
    setIsMenuOpen(false);
    // O PIN atual só é sobrescrito quando o novo for confirmado na tela
    // de segurança — se o usuário voltar sem concluir, nada muda.
    router.replace({ pathname: "/security", params: { mode: "change" } } as any);
  };

  const handleWipeData = () => {
    setIsMenuOpen(false);
    setIsWipeConfirmOpen(true);
  };

  const confirmWipeData = async () => {
    setIsWipeConfirmOpen(false);
    try {
      await resetDatabase();
      await clearPin();
      router.replace("/" as any); // Volta para a tela de boas-vindas
    } catch (error) {
      console.log("Erro ao zerar dados:", error);
      showAlert("Erro", "Não foi possível formatar o aplicativo.");
    }
  };

  const formattedTransactions: DisplayTransaction[] = transactions.map(
    (item) => ({
      id: String(item.id),
      description: item.description || "Sem título",
      amount: item.amount,
      type: item.type,
      date: item.date,
      category: item.category_id,
      color: item.color || colors.textSecondary,
      icon: item.type === "income" ? "cash-outline" : "cart-outline",
      recurrenceType: item.recurrence_type,
      recurrenceGroupId: item.recurrence_group_id,
      installmentNumber: item.installment_number,
      installmentTotal: item.installment_total,
    }),
  );

  const value: DashboardContextValue = {
    userName,
    userImage,
    isMenuOpen,
    setIsMenuOpen,
    isEditingName,
    setIsEditingName,
    newName,
    setNewName,
    pickImage,
    handleUpdateName,

    isLandscapePanoramaOpen,
    openLandscapePanorama,
    closeLandscapePanorama,

    scrollY,

    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    isMonthModalOpen,
    setIsMonthModalOpen,
    isYearModalOpen,
    setIsYearModalOpen,

    transactions,
    saveTransaction,
    isLoadingTransactions,
    totalIncome,
    totalExpense,
    totalBalance,
    monthsData,
    formattedTransactions,

    budget,
    updateBudget,
    isEditingBudget,
    setIsEditingBudget,

    categoryBudgets,
    isLoadingCategoryBudgets,
    saveCategoryGoal,
    handleDeleteCategory,
    refreshCategoryBudgets,

    comparison,
    isLoadingComparison,

    pendingDebts,
    settledDebts,
    totalToReceive,
    totalToPay,
    isLoadingDebts,
    isDebtModalOpen,
    setIsDebtModalOpen,
    handleAddDebt,
    handleSettleDebt,
    handleDeleteDebt,

    savingsGoals,
    isLoadingSavings,
    isSavingsModalOpen,
    setIsSavingsModalOpen,
    depositGoal,
    setDepositGoal,
    handleAddSavingsGoal,
    handleChangeSavings,
    handleDeleteSavingsGoal,

    pendingImport,
    setPendingImport,
    handleImportFile,
    isReadingImport,
    confirmImport,

    alertVisible,
    alertTitle,
    alertMessage,
    setAlertVisible,
    showAlert,

    handleExportPDF,
    handleExportCSV,
    handleDeleteTransaction,
    handleDeleteAllTransactions,
    handleDeleteSeriesFromId,
    handleDeleteSeries,
    handleChangePIN,
    handleWipeData,
    isWipeConfirmOpen,
    setIsWipeConfirmOpen,
    confirmWipeData,

    currentMonthNum,
    currentYearStr,
    currentDay,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useDashboardContext deve ser usado dentro de um DashboardProvider",
    );
  }
  return ctx;
}
