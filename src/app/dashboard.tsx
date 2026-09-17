import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

import { initDatabase } from "../database/sqlite";
import { styles } from "../styles/dashboardStyles";

const monthMap: Record<string, string> = {
  Janeiro: "01",
  Fevereiro: "02",
  Março: "03",
  Abril: "04",
  Maio: "05",
  Junho: "06",
  Julho: "07",
  Agosto: "08",
  Setembro: "09",
  Outubro: "10",
  Novembro: "11",
  Dezembro: "12",
};

const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const amount = Number(numbers) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function DashboardScreen() {
  const today = new Date();
  const currentMonthNamesList = Object.keys(monthMap);
  const currentMonthName = currentMonthNamesList[today.getMonth()];
  const currentYearStr = String(today.getFullYear());
  const currentDay = String(today.getDate()).padStart(2, "0");
  const currentMonthNum = String(today.getMonth() + 1).padStart(2, "0");

  const [userName, setUserName] = useState("Carregando...");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isPieView, setIsPieView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  // Estados de Transação e Edição
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "income",
  );
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    `${currentDay}/${currentMonthNum}/${currentYearStr}`,
  );
  const [transactionCategory, setTransactionCategory] = useState("Salário");

  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const totalBalance = totalIncome - totalExpense;

  // Estado dinâmico para alimentar o Panorama Anual mês a mês
  const [monthsData, setMonthsData] = useState([
    { label: "JAN", income: 0, expense: 0 },
    { label: "FEV", income: 0, expense: 0 },
    { label: "MAR", income: 0, expense: 0 },
    { label: "ABR", income: 0, expense: 0 },
    { label: "MAI", income: 0, expense: 0 },
    { label: "JUN", income: 0, expense: 0 },
    { label: "JUL", income: 0, expense: 0 },
    { label: "AGO", income: 0, expense: 0 },
    { label: "SET", income: 0, expense: 0 },
    { label: "OUT", income: 0, expense: 0 },
    { label: "NOV", income: 0, expense: 0 },
    { label: "DEZ", income: 0, expense: 0 },
  ]);

  const monthsList = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const yearsList = ["2024", "2025", "2026", "2027", "2028"];

  const [monthlyBudget, setMonthlyBudget] = useState("0");
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const totalMoney = totalIncome + totalExpense;
  const incomePercentage =
    totalMoney > 0 ? (totalIncome / totalMoney) * 100 : 50;
  const expensePercentage =
    totalMoney > 0 ? (totalExpense / totalMoney) * 100 : 50;

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

  useEffect(() => {
    async function setupDashboard() {
      await initDatabase();
      await fetchUserData();
      await fetchTransactions();
    }
    setupDashboard();
  }, [selectedMonth, selectedYear]);

  const fetchUserData = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      const result: any = await db.getAllAsync("SELECT * FROM users LIMIT 1");
      if (result && result.length > 0) {
        setUserName(result[0].name);
        if (result[0].avatar) setUserImage(result[0].avatar);
      } else {
        setUserName("Meu Finanças");
      }
    } catch (error) {
      console.log("Erro ao buscar usuário:", error);
      setUserName("Meu Finanças");
    }
  };

  // Busca segura em memória para o ano inteiro e mês atual (Evita NullPointerException no Android)
  const fetchTransactions = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

      // 1. Busca TODAS as transações cadastradas no banco sem usar LIKE vulnerável no Android
      const allTransactions: any = await db.getAllAsync(
        "SELECT * FROM transactions ORDER BY id DESC",
      );

      // 2. Filtra no JavaScript apenas as transações que pertencem ao ano selecionado (ex: /2026)
      const allYearTransactions = allTransactions.filter(
        (item: any) => item.date && item.date.endsWith(`/${selectedYear}`),
      );

      // 3. Filtra as transações correspondentes ao mês selecionado na UI
      const monthNumber = monthMap[selectedMonth] || currentMonthNum;
      const currentMonthTransactions = allYearTransactions.filter((item: any) =>
        item.date.includes(`/${monthNumber}/${selectedYear}`),
      );
      setTransactions(currentMonthTransactions);

      // 4. Calcula totais do mês atual
      let income = 0;
      let expense = 0;

      currentMonthTransactions.forEach((item: any) => {
        if (item.type === "income") {
          income += item.amount;
        } else {
          expense += item.amount;
        }
      });

      setTotalIncome(income);
      setTotalExpense(expense);
      setMonthlyBudget(income.toString());

      // 5. Consolida dinamicamente os valores para os 12 meses do Panorama Anual
      const calculatedMonthsData = [
        { label: "JAN", income: 0, expense: 0 },
        { label: "FEV", income: 0, expense: 0 },
        { label: "MAR", income: 0, expense: 0 },
        { label: "ABR", income: 0, expense: 0 },
        { label: "MAI", income: 0, expense: 0 },
        { label: "JUN", income: 0, expense: 0 },
        { label: "JUL", income: 0, expense: 0 },
        { label: "AGO", income: 0, expense: 0 },
        { label: "SET", income: 0, expense: 0 },
        { label: "OUT", income: 0, expense: 0 },
        { label: "NOV", income: 0, expense: 0 },
        { label: "DEZ", income: 0, expense: 0 },
      ];

      const monthIndexMap: Record<string, number> = {
        "01": 0,
        "02": 1,
        "03": 2,
        "04": 3,
        "05": 4,
        "06": 5,
        "07": 6,
        "08": 7,
        "09": 8,
        "10": 9,
        "11": 10,
        "12": 11,
      };

      allYearTransactions.forEach((item: any) => {
        const parts = item.date.split("/");
        if (parts.length === 3) {
          const mNum = parts[1];
          const idx = monthIndexMap[mNum];
          if (idx !== undefined) {
            if (item.type === "income") {
              calculatedMonthsData[idx].income += item.amount;
            } else {
              calculatedMonthsData[idx].expense += item.amount;
            }
          }
        }
      });

      setMonthsData(calculatedMonthsData);
    } catch (error) {
      console.log("Erro ao buscar transações anuais:", error);
    }
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
      const imageUri = result.assets[0].uri;
      try {
        setUserImage(imageUri);
        const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

        try {
          await db.execAsync(`ALTER TABLE users ADD COLUMN avatar TEXT;`);
        } catch (e) {}

        await db.runAsync(
          "INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)",
          userName,
        );
        await db.runAsync("UPDATE users SET avatar = ? WHERE id = 1", imageUri);

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
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      await db.runAsync("UPDATE users SET name = ? WHERE id = 1", newName);
      setUserName(newName);
      setNewName("");
      setIsEditingName(false);
      setIsMenuOpen(false);
      showAlert("Sucesso", "Nome alterado com sucesso!");
    } catch (error) {
      console.log("Erro ao atualizar nome:", error);
      showAlert("Erro", "Não foi possível atualizar o nome.");
    }
  };

  const handleOpenEditTransaction = (item: any) => {
    setEditingTransactionId(item.id);
    setTransactionType(item.type);
    setTransactionTitle(item.description);
    const formattedAmount = (item.amount * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
    });
    setTransactionAmount(formattedAmount);
    setTransactionDate(item.date);
    setTransactionCategory(
      item.category || (item.type === "income" ? "Salário" : "Alimentação"),
    );
    setIsTransactionModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!transactionTitle.trim() || !transactionAmount.trim()) {
      showAlert("Atenção", "Preencha o título e o valor da transação.");
      return;
    }

    const cleanNumericValue = Number(
      transactionAmount.replace(/\./g, "").replace(",", "."),
    );

    if (isNaN(cleanNumericValue) || cleanNumericValue <= 0) {
      showAlert("Atenção", "Insira um valor válido.");
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");

      if (editingTransactionId) {
        await db.runAsync(
          "UPDATE transactions SET amount = ?, date = ?, description = ?, type = ?, category_id = ? WHERE id = ?",
          cleanNumericValue,
          transactionDate,
          transactionTitle,
          transactionType,
          transactionCategory,
          editingTransactionId,
        );
        showAlert("Sucesso", "Transação atualizada com sucesso!");
      } else {
        await db.runAsync(
          "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
          cleanNumericValue,
          transactionDate,
          transactionTitle,
          transactionType,
          transactionCategory,
        );
        showAlert("Sucesso", "Transação salva com sucesso!");
      }

      await fetchTransactions();
      setTransactionTitle("");
      setTransactionAmount("");
      setEditingTransactionId(null);
      setIsTransactionModalOpen(false);
    } catch (error) {
      console.log("Erro ao salvar transação:", error);
      showAlert("Erro", "Não foi possível salvar a transação.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      await db.runAsync("DELETE FROM transactions WHERE id = ?", id);

      await fetchTransactions();
      showAlert("Sucesso", "Transação excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir transação:", error);
      showAlert("Erro", "Não foi possível excluir a transação.");
    }
  };

  const handleDeleteAllTransactions = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      const monthNumber = monthMap[selectedMonth] || currentMonthNum;
      const dateSearchPattern = `%/${monthNumber}/${selectedYear}`;

      await db.runAsync(
        "DELETE FROM transactions WHERE date LIKE ?",
        dateSearchPattern,
      );
      await fetchTransactions();
      showAlert(
        "Sucesso",
        "Todas as transações deste período foram excluídas.",
      );
    } catch (error) {
      console.log("Erro ao excluir transações:", error);
      showAlert("Erro", "Não foi possível excluir as transações.");
    }
  };

  const formattedTransactions = transactions.map((item) => ({
    id: String(item.id),
    description: item.description || "Sem descrição",
    amount: item.amount,
    type: item.type,
    date: item.date,
    category: item.category_id,
    icon: item.type === "income" ? "cash-outline" : "cart-outline",
  }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <UserProfileHeader
          userName={userName}
          userImage={userImage}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onOpenMonthModal={() => setIsMonthModalOpen(true)}
          onOpenYearModal={() => setIsYearModalOpen(true)}
          onOpenMenu={() => setIsMenuOpen(true)}
        />

        <BalanceCard
          totalBalance={totalBalance}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />

        <SummaryCards totalIncome={totalIncome} totalExpense={totalExpense} />

        <MonthlyBudgetCard
          monthlyBudget={monthlyBudget}
          setMonthlyBudget={setMonthlyBudget}
          isEditingBudget={isEditingBudget}
          setIsEditingBudget={setIsEditingBudget}
          formatCurrency={formatCurrency}
        />

        <GeneralBalanceCard
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          transactions={formattedTransactions}
        />

        <AnnualPanoramaCard onPress={openLandscapePanorama} />

        <TransactionsHistoryList
          transactions={formattedTransactions}
          onEditTransaction={handleOpenEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onDeleteAll={handleDeleteAllTransactions}
        />
      </ScrollView>

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingTransactionId(null);
          setTransactionType("income");
          setTransactionCategory("Salário");

          const targetMonth = monthMap[selectedMonth] || currentMonthNum;
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
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modais */}
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
        formatCurrency={formatCurrency}
        onSave={handleSaveTransaction}
      />

      <MonthModal
        visible={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
        months={monthsList}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      <YearModal
        visible={isYearModalOpen}
        onClose={() => setIsYearModalOpen(false)}
        years={yearsList}
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
