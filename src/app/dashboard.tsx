import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import { AnnualPanoramaCard } from "../components/AnnualPanoramaCard";
import { BalanceCard } from "../components/BalanceCard";
import { CustomAlert } from "../components/CustomAlert";
import { MonthModal, YearModal } from "../components/FilterModals";
import { GeneralBalanceCard } from "../components/GeneralBalanceCard";
import { LandscapePanoramaModal } from "../components/LandscapePanoramaModal";
import { MonthlyBudgetCard } from "../components/MonthlyBudgetCard";
import {
  EditNameModal,
  ProfileMenuModal,
} from "../components/ProfileMenuModals";
import { SummaryCards } from "../components/SummaryCards";
import { TransactionModal } from "../components/TransactionModal";
import { TransactionsHistoryList } from "../components/TransactionsHistoryList";
import { UserProfileHeader } from "../components/UserProfileHeader";

import { colors } from "../constants/colors";
import { resetDatabase } from "../database/sqlite";
import { getAllTransactions } from "../database/transactions";
import { useBudget } from "../hooks/useBudget";
import { useTransactions } from "../hooks/useTransactions";
import { useUserProfile } from "../hooks/useUserProfile";
import { styles } from "../styles/dashboardStyles";
import type {
  DisplayTransaction,
  TransactionRepeatMode,
  TransactionType,
} from "../types";
import { formatCurrencyInput } from "../utils/currency";
import { getMonthNumber, MONTH_NAMES } from "../utils/dates";
import {
  buildTransactionsCsv,
  buildTransactionsHtmlReport,
} from "../utils/export";
import { clearPin } from "../utils/security";

const YEARS_LIST = ["2024", "2025", "2026", "2027", "2028"];

export default function DashboardScreen() {
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

  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  // Acompanha o quanto a tela rolou pra animar a borda do cabeçalho fixo.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [transactionType, setTransactionType] =
    useState<TransactionType>("income");
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    `${currentDay}/${currentMonthNum}/${currentYearStr}`,
  );
  const [transactionCategory, setTransactionCategory] = useState("Salário");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(12);
  const [installmentCount, setInstallmentCount] = useState(1);

  const {
    transactions,
    isLoading: isLoadingTransactions,
    totalIncome,
    totalExpense,
    monthsData,
    saveTransaction,
    removeTransaction,
    removeAllForCurrentPeriod,
  } = useTransactions(selectedMonth, selectedYear);
  const totalBalance = totalIncome - totalExpense;

  const { budget, updateBudget } = useBudget(selectedMonth, selectedYear);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

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

  const handleOpenEditTransaction = (item: DisplayTransaction) => {
    setEditingTransactionId(item.id);
    setTransactionType(item.type);
    setTransactionTitle(item.description);

    const rawCents = Math.round(item.amount * 100).toString();
    setTransactionAmount(formatCurrencyInput(rawCents));

    setTransactionDate(item.date);
    setTransactionCategory(
      item.category || (item.type === "income" ? "Salário" : "Alimentação"),
    );
    // Editar sempre mexe só nessa ocorrência — nunca reabre como
    // recorrente/parcelada, mesmo se a transação original era uma delas.
    setIsRecurring(false);
    setRecurringMonths(12);
    setInstallmentCount(1);
    setIsTransactionModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (
      !transactionTitle ||
      !String(transactionTitle).trim() ||
      !transactionAmount ||
      !String(transactionAmount).trim()
    ) {
      showAlert("Atenção", "Preencha o título e o valor da transação.");
      return;
    }

    const cleanNumericValue = Number(
      String(transactionAmount).replace(/\./g, "").replace(",", "."),
    );

    if (isNaN(cleanNumericValue) || cleanNumericValue <= 0) {
      showAlert("Atenção", "Insira um valor válido.");
      return;
    }

    const safeTitle = String(transactionTitle).trim();
    const safeDate =
      String(transactionDate).trim() ||
      `${currentDay}/${currentMonthNum}/${currentYearStr}`;
    const safeType: TransactionType =
      transactionType === "income" ? "income" : "expense";

    const rawCat = String(transactionCategory || "").trim();
    const safeCategory =
      rawCat !== "" ? rawCat : safeType === "income" ? "Salário" : "Outros";

    const repeatMode: TransactionRepeatMode = isRecurring
      ? { kind: "recurring", months: recurringMonths }
      : installmentCount > 1
        ? { kind: "installment", count: installmentCount }
        : { kind: "single" };

    try {
      await saveTransaction(
        editingTransactionId ? Number(editingTransactionId) : null,
        {
          amount: cleanNumericValue,
          date: safeDate,
          description: safeTitle,
          type: safeType,
          category: safeCategory,
        },
        repeatMode,
      );

      const successMessage = editingTransactionId
        ? "Transação atualizada com sucesso!"
        : repeatMode.kind === "recurring"
          ? `Transação recorrente cadastrada! Ela vai aparecer todo mês pelos próximos ${repeatMode.months} meses.`
          : repeatMode.kind === "installment"
            ? `Compra parcelada em ${repeatMode.count}x cadastrada com sucesso!`
            : "Transação salva com sucesso!";
      showAlert("Sucesso", successMessage);

      setTransactionTitle("");
      setTransactionAmount("");
      setEditingTransactionId(null);
      setIsRecurring(false);
      setRecurringMonths(12);
      setInstallmentCount(1);
      setIsTransactionModalOpen(false);
    } catch (error) {
      console.log("Erro ao salvar transação:", error);
      showAlert("Erro", "Não foi possível salvar a transação.");
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

  // ------------------ NOVAS FUNÇÕES DE SEGURANÇA ------------------
  const handleChangePIN = () => {
    setIsMenuOpen(false);
    // O PIN atual só é sobrescrito quando o novo for confirmado na tela
    // de segurança — se o usuário voltar sem concluir, nada muda.
    router.replace({ pathname: "/security", params: { mode: "change" } } as any);
  };

  const handleWipeData = () => {
    setIsMenuOpen(false);
    Alert.alert(
      "Zerar Aplicativo",
      "ATENÇÃO: Isso apagará todas as suas transações, categorias, nome, foto e PIN. Essa ação NÃO pode ser desfeita. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, apagar tudo",
          style: "destructive",
          onPress: async () => {
            try {
              await resetDatabase();
              await clearPin();
              router.replace("/" as any); // Volta para a tela de boas-vindas
            } catch (error) {
              console.log("Erro ao zerar dados:", error);
              showAlert("Erro", "Não foi possível formatar o aplicativo.");
            }
          },
        },
      ],
    );
  };
  // -----------------------------------------------------------------

  const filteredTransactions = transactions.filter((item) => {
    const searchLower = searchText.toLowerCase();
    return (
      (item.description &&
        item.description.toLowerCase().includes(searchLower)) ||
      (item.category_id && item.category_id.toLowerCase().includes(searchLower))
    );
  });

  const formattedTransactions: DisplayTransaction[] = filteredTransactions.map(
    (item) => ({
      id: String(item.id),
      description: item.description || "Sem descrição",
      amount: item.amount,
      type: item.type,
      date: item.date,
      category: item.category_id,
      color: item.color || colors.textSecondary,
      icon: item.type === "income" ? "cash-outline" : "cart-outline",
      recurrenceType: item.recurrence_type,
    }),
  );

  return (
    <SafeAreaView style={styles.container}>
      <UserProfileHeader
        userName={userName}
        userImage={userImage}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onOpenMonthModal={() => setIsMonthModalOpen(true)}
        onOpenYearModal={() => setIsYearModalOpen(true)}
        onOpenMenu={() => setIsMenuOpen(true)}
        scrollY={scrollY}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
      >
        <BalanceCard
          totalBalance={totalBalance}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />

        <SummaryCards totalIncome={totalIncome} totalExpense={totalExpense} />

        <MonthlyBudgetCard
          budget={budget}
          totalExpense={totalExpense}
          isEditingBudget={isEditingBudget}
          setIsEditingBudget={setIsEditingBudget}
          onSaveBudget={updateBudget}
          formatCurrency={formatCurrencyInput}
        />

        <GeneralBalanceCard
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          transactions={formattedTransactions}
        />

        <AnnualPanoramaCard onPress={openLandscapePanorama} />

        <TransactionsHistoryList
          transactions={formattedTransactions}
          hasAnyTransactions={transactions.length > 0}
          isLoading={isLoadingTransactions}
          searchText={searchText}
          setSearchText={setSearchText}
          onEditTransaction={handleOpenEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onDeleteAll={handleDeleteAllTransactions}
        />
      </Animated.ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingTransactionId(null);
          setTransactionType("income");
          setTransactionCategory("Salário");
          setIsRecurring(false);
          setRecurringMonths(12);
          setInstallmentCount(1);

          const targetMonth = getMonthNumber(selectedMonth);
          let dayToUse = "01";
          if (
            targetMonth === currentMonthNum &&
            selectedYear === currentYearStr
          ) {
            dayToUse = currentDay;
          }

          setTransactionDate(`${dayToUse}/${targetMonth}/${selectedYear}`);
          setIsTransactionModalOpen(true);
        }}
      >
        <Ionicons name="add" size={28} color={colors.textPrimary} />
      </TouchableOpacity>

      <TransactionModal
        visible={isTransactionModalOpen}
        onClose={() => {
          setEditingTransactionId(null);
          setIsTransactionModalOpen(false);
        }}
        transactionType={transactionType}
        setTransactionType={setTransactionType}
        transactionTitle={transactionTitle}
        setTransactionTitle={setTransactionTitle}
        transactionAmount={transactionAmount}
        setTransactionAmount={setTransactionAmount}
        transactionDate={transactionDate}
        setTransactionDate={setTransactionDate}
        transactionCategory={transactionCategory}
        setTransactionCategory={setTransactionCategory}
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring}
        recurringMonths={recurringMonths}
        setRecurringMonths={setRecurringMonths}
        installmentCount={installmentCount}
        setInstallmentCount={setInstallmentCount}
        isEditing={!!editingTransactionId}
        formatCurrency={formatCurrencyInput}
        onSave={handleSaveTransaction}
      />

      <MonthModal
        visible={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
        months={MONTH_NAMES}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      <YearModal
        visible={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        years={YEARS_LIST}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
      />

      <LandscapePanoramaModal
        visible={isLandscapePanoramaOpen}
        selectedYear={selectedYear}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        monthsData={monthsData}
        onClose={closeLandscapePanorama}
      />

      <ProfileMenuModal
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        userName={userName}
        userImage={userImage}
        onPickImage={pickImage}
        onOpenEditName={() => setIsEditingName(true)}
        onExportPDF={handleExportPDF}
        onExportCSV={handleExportCSV}
        onChangePIN={handleChangePIN}
        onWipeData={handleWipeData}
      />

      <EditNameModal
        visible={isEditingName}
        onClose={() => setIsEditingName(false)}
        newName={newName}
        setNewName={setNewName}
        onSave={handleUpdateName}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}
