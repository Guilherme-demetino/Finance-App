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
import { TransactionsList } from "../components/TransactionsList";
import { UserProfileHeader } from "../components/UserProfileHeader";

import { initDatabase } from "../database/sqlite";
import { styles } from "../styles/dashboardStyles";

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
  const [userName, setUserName] = useState("Carregando...");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isPieView, setIsPieView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  // Modal Transação
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    "income",
  );
  const [transactionTitle, setTransactionTitle] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("16/09/2026");
  const [transactionCategory, setTransactionCategory] = useState("Salário");

  // Lista de transações do banco
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const totalBalance = totalIncome - totalExpense;

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState("Setembro");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

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

  const monthsData = [
    { label: "JAN", income: 0, expense: 0 },
    { label: "FEV", income: 0, expense: 0 },
    { label: "MAR", income: 0, expense: 0 },
    { label: "ABR", income: 0, expense: 0 },
    { label: "MAI", income: 0, expense: 0 },
    { label: "JUN", income: 0, expense: 0 },
    { label: "JUL", income: 0, expense: 0 },
    { label: "AGO", income: 0, expense: 0 },
    { label: "SET", income: totalIncome, expense: totalExpense },
    { label: "OUT", income: 0, expense: 0 },
    { label: "NOV", income: 0, expense: 0 },
    { label: "DEZ", income: 0, expense: 0 },
  ];

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
  }, []);

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

  const fetchTransactions = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("meufinanceiro.db");
      const result: any = await db.getAllAsync(
        "SELECT * FROM transactions ORDER BY id DESC",
      );
      setTransactions(result);

      let income = 0;
      let expense = 0;

      result.forEach((item: any) => {
        if (item.type === "income") {
          income += item.amount;
        } else {
          expense += item.amount;
        }
      });

      setTotalIncome(income);
      setTotalExpense(expense);
      setMonthlyBudget(income.toString());
    } catch (error) {
      console.log("Erro ao buscar transações:", error);
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
          [userName],
        );
        await db.runAsync("UPDATE users SET avatar = ? WHERE id = 1", [
          imageUri,
        ]);
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
      await db.runAsync(
        "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
        [
          cleanNumericValue,
          transactionDate,
          transactionTitle,
          transactionType,
          transactionCategory,
        ],
      );

      await fetchTransactions();

      showAlert("Sucesso", "Transação salva com sucesso!");
      setTransactionTitle("");
      setTransactionAmount("");
      setIsTransactionModalOpen(false);
    } catch (error) {
      console.log("Erro ao salvar transação:", error);
      showAlert("Erro", "Não foi possível salvar a transação.");
    }
  };

  const formattedTransactions = transactions.map((item) => ({
    id: String(item.id),
    description: item.description || "Sem descrição",
    amount: item.amount,
    type: item.type,
    date: item.date,
    category: item.category_id, // <-- ESSA LINHA FAZ A MÁGICA DAS CORES!
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

        <TransactionsList transactions={formattedTransactions} />
      </ScrollView>

      {/* Botão Flutuante (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setTransactionType("income");
          setTransactionCategory("Salário");
          setIsTransactionModalOpen(true);
        }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modais */}
      <TransactionModal
        visible={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
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
