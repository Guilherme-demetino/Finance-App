import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Alert, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnnualPanoramaCard } from "../components/AnnualPanoramaCard";
import { BalanceCard } from "../components/BalanceCard";
import { CustomAlert } from "../components/CustomAlert";
import { DashboardStickyHeader } from "../components/DashboardStickyHeader";
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

import { getDatabase } from "../database/sqlite";
import { styles } from "../styles/dashboardStyles";
import { formatCurrency } from "../utils/currency";
import { clearPin } from "../utils/security";

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

const formatCurrencyInput = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";

  const amount = (Number(numbers) / 100).toFixed(2);
  const parts = amount.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
};

export default function DashboardScreen() {
  const router = useRouter();
  const today = new Date();
  const currentMonthNamesList = Object.keys(monthMap);
  const currentMonthName = currentMonthNamesList[today.getMonth()];
  const currentYearStr = String(today.getFullYear());
  const currentDay = String(today.getDate()).padStart(2, "0");
  const currentMonthNum = String(today.getMonth() + 1).padStart(2, "0");

  const [userName, setUserName] = useState("Carregando...");
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const [isLandscapePanoramaOpen, setIsLandscapePanoramaOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
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
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const totalBalance = totalIncome - totalExpense;

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
      await fetchUserData();
      await fetchTransactions();
    }
    setupDashboard();
  }, [selectedMonth, selectedYear]);

  const fetchUserData = async () => {
    try {
      const db = await getDatabase();
      const result: any = db.getAllSync("SELECT * FROM users LIMIT 1");
      if (result && result.length > 0) {
        setUserName(result[0].name || "Meu Finanças");
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
    setIsLoadingTransactions(true);
    try {
      const db = await getDatabase();

      const rawTransactions: any = await db.getAllAsync(
        "SELECT * FROM transactions ORDER BY id DESC",
      );

      const rawCategories: any = await db.getAllAsync("SELECT * FROM categories");

      const defaultSystemColors: Record<string, string> = {
        salário: "#10B981",
        investimentos: "#3B82F6",
        alimentação: "#F97316",
        transporte: "#8B5CF6",
        lazer: "#EC4899",
        moradia: "#F59E0B",
        saúde: "#EF4444",
        outros: "#A8A29E",
      };

      const categoryColorMap: Record<string, string> = {
        ...defaultSystemColors,
      };

      rawCategories.forEach((cat: any) => {
        if (cat.name) {
          const cleanName = cat.name.trim().toLowerCase();
          categoryColorMap[cleanName] = cat.color;
        }
      });

      const allTransactions = rawTransactions.map((item: any) => {
        const catKey = item.category_id
          ? item.category_id.trim().toLowerCase()
          : "";
        const matchedColor = categoryColorMap[catKey] || "#A1A1AA";

        return {
          ...item,
          category: item.category_id,
          color: matchedColor,
        };
      });

      const allYearTransactions = allTransactions.filter(
        (item: any) => item.date && item.date.endsWith(`/${selectedYear}`),
      );

      const monthNumber = monthMap[selectedMonth] || currentMonthNum;
      const currentMonthTransactions = allYearTransactions.filter((item: any) =>
        item.date.includes(`/${monthNumber}/${selectedYear}`),
      );
      setTransactions(currentMonthTransactions);

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
    } finally {
      setIsLoadingTransactions(false);
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
        const db = await getDatabase();

        try {
          db.runSync(`ALTER TABLE users ADD COLUMN avatar TEXT;`);
        } catch (e) {}

        db.runSync(
          "INSERT OR IGNORE INTO users (id, name) VALUES (1, ?)",
          userName,
        );
        db.runSync("UPDATE users SET avatar = ? WHERE id = 1", imageUri);

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
      const db = await getDatabase();
      db.runSync("UPDATE users SET name = ? WHERE id = 1", newName);
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

  const handleExportPDF = async () => {
    try {
      if (transactions.length === 0) {
        showAlert("Atenção", "Não há transações neste período para exportar.");
        return;
      }

      const htmlContent = `
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
                ${transactions
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
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      console.log("Erro ao gerar PDF:", error);
      showAlert("Erro", "Não foi possível gerar o arquivo PDF.");
    }
  };

  const csvEscape = (value: string): string => {
    const safeValue = String(value ?? "");
    if (/[;"\n]/.test(safeValue)) {
      return `"${safeValue.replace(/"/g, '""')}"`;
    }
    return safeValue;
  };

  const handleExportCSV = async () => {
    try {
      const db = await getDatabase();
      const allTransactions: any = await db.getAllAsync(
        "SELECT * FROM transactions ORDER BY id DESC",
      );

      if (!allTransactions || allTransactions.length === 0) {
        showAlert("Atenção", "Não há transações para exportar.");
        return;
      }

      const header = "Data;Descrição;Categoria;Tipo;Valor";
      const rows = allTransactions.map((t: any) => {
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

      const csvContent = "﻿" + [header, ...rows].join("\n");

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
        showAlert("Erro", "O compartilhamento não está disponível neste dispositivo.");
      }
    } catch (error) {
      console.log("Erro ao gerar CSV:", error);
      showAlert("Erro", "Não foi possível gerar o arquivo CSV.");
    }
  };

  const handleOpenEditTransaction = (item: any) => {
    setEditingTransactionId(item.id);
    setTransactionType(item.type);
    setTransactionTitle(item.description);

    const rawCents = Math.round(item.amount * 100).toString();
    setTransactionAmount(formatCurrencyInput(rawCents));

    setTransactionDate(item.date);
    setTransactionCategory(
      item.category || (item.type === "income" ? "Salário" : "Alimentação"),
    );
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
    const safeType =
      String(transactionType) === "income" ? "income" : "expense";

    const rawCat = String(transactionCategory || "").trim();
    const safeCategory =
      rawCat !== "" ? rawCat : safeType === "income" ? "Salário" : "Outros";

    try {
      const db = await getDatabase();

      if (editingTransactionId) {
        db.runSync(
          "UPDATE transactions SET amount = ?, date = ?, description = ?, type = ?, category_id = ? WHERE id = ?",
          cleanNumericValue,
          safeDate,
          safeTitle,
          safeType,
          safeCategory,
          Number(editingTransactionId),
        );
      } else {
        db.runSync(
          "INSERT INTO transactions (amount, date, description, type, category_id) VALUES (?, ?, ?, ?, ?)",
          cleanNumericValue,
          safeDate,
          safeTitle,
          safeType,
          safeCategory,
        );
      }

      showAlert(
        "Sucesso",
        editingTransactionId
          ? "Transação atualizada com sucesso!"
          : "Transação salva com sucesso!",
      );

      fetchTransactions();
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
      const db = await getDatabase();
      db.runSync("DELETE FROM transactions WHERE id = ?", id);
      fetchTransactions();
      showAlert("Sucesso", "Transação excluída com sucesso.");
    } catch (error) {
      console.log("Erro ao excluir transação:", error);
      showAlert("Erro", "Não foi possível excluir a transação.");
    }
  };

  const handleDeleteAllTransactions = async () => {
    try {
      const db = await getDatabase();
      const monthNumber = monthMap[selectedMonth] || currentMonthNum;
      const dateSearchPattern = `%/${monthNumber}/${selectedYear}`;

      db.runSync(
        "DELETE FROM transactions WHERE date LIKE ?",
        dateSearchPattern,
      );

      fetchTransactions();
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
    router.replace("/security?mode=change" as any);
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
              const db = await getDatabase();
              db.withTransactionSync(() => {
                db.runSync("DROP TABLE IF EXISTS transactions");
                db.runSync("DROP TABLE IF EXISTS categories");
                db.runSync("DROP TABLE IF EXISTS users");
                db.runSync("DROP TABLE IF EXISTS security");
              });
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

  const formattedTransactions = filteredTransactions.map((item) => ({
    id: String(item.id),
    description: item.description || "Sem descrição",
    amount: item.amount,
    type: item.type,
    date: item.date,
    category: item.category_id,
    color: item.color || "#A1A1AA",
    icon: item.type === "income" ? "cash-outline" : "cart-outline",
  }));

  return (
    <SafeAreaView style={styles.container}>
      <DashboardStickyHeader
        userName={userName}
        userImage={userImage}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onOpenMonthModal={() => setIsMonthModalOpen(true)}
        onOpenYearModal={() => setIsYearModalOpen(true)}
        onOpenMenu={() => setIsMenuOpen(true)}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
      >
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
      </ScrollView>

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
        formatCurrency={formatCurrencyInput}
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
