import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConfirmModal } from "../../components/ConfirmModal";
import { CustomAlert } from "../../components/CustomAlert";
import { DebtModal } from "../../components/DebtModal";
import { MonthModal, YearModal } from "../../components/FilterModals";
import { LandscapePanoramaModal } from "../../components/LandscapePanoramaModal";
import { SavingsDepositModal } from "../../components/SavingsDepositModal";
import { SavingsGoalModal } from "../../components/SavingsGoalModal";
import {
  EditNameModal,
  ProfileMenuModal,
} from "../../components/ProfileMenuModals";
import { TransactionModal } from "../../components/TransactionModal";
import { UserProfileHeader } from "../../components/UserProfileHeader";

import { colors } from "../../constants/colors";
import {
  DashboardProvider,
  useDashboardContext,
  YEARS_LIST,
} from "../../context/DashboardContext";
import { styles } from "../../styles/dashboardStyles";
import { formatCurrencyInput } from "../../utils/currency";
import { MONTH_NAMES } from "../../utils/dates";

function DashboardChrome() {
  const {
    userName,
    userImage,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    isMonthModalOpen,
    setIsMonthModalOpen,
    isYearModalOpen,
    setIsYearModalOpen,
    isMenuOpen,
    setIsMenuOpen,
    scrollY,
    isLandscapePanoramaOpen,
    closeLandscapePanorama,
    monthsData,
    pickImage,
    isEditingName,
    setIsEditingName,
    newName,
    setNewName,
    handleUpdateName,
    handleExportPDF,
    handleExportCSV,
    handleChangePIN,
    handleWipeData,
    isWipeConfirmOpen,
    setIsWipeConfirmOpen,
    confirmWipeData,
    isDebtModalOpen,
    setIsDebtModalOpen,
    handleAddDebt,
    currentDay,
    currentMonthNum,
    currentYearStr,
    isSavingsModalOpen,
    setIsSavingsModalOpen,
    depositGoal,
    setDepositGoal,
    handleAddSavingsGoal,
    handleChangeSavings,
    handleImportCSV,
    handleDeleteCategory,
    pendingImport,
    setPendingImport,
    confirmImport,
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    setEditingTransactionId,
    transactionType,
    setTransactionType,
    transactionTitle,
    setTransactionTitle,
    transactionAmount,
    setTransactionAmount,
    transactionDate,
    setTransactionDate,
    transactionCategory,
    setTransactionCategory,
    isRecurring,
    setIsRecurring,
    recurringMonths,
    setRecurringMonths,
    installmentCount,
    setInstallmentCount,
    editingTransactionId,
    handleSaveTransaction,
    openNewTransactionModal,
    alertVisible,
    alertTitle,
    alertMessage,
    setAlertVisible,
  } = useDashboardContext();

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

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: 8,
            paddingBottom: 8,
            elevation: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Início",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: "Orçamento",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "wallet" : "wallet-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="debts"
          options={{
            title: "Dívidas",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Histórico",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "time" : "time-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tabs>

      <TouchableOpacity
        style={[styles.fab, { bottom: 108 }]}
        onPress={openNewTransactionModal}
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
        onDeleteCategory={handleDeleteCategory}
      />

      <DebtModal
        visible={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          setIsDebtModalOpen(false);
          handleAddDebt({
            ...data,
            date: `${currentDay}/${currentMonthNum}/${currentYearStr}`,
          });
        }}
      />

      <SavingsGoalModal
        visible={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        formatCurrency={formatCurrencyInput}
        onSave={(data) => {
          setIsSavingsModalOpen(false);
          handleAddSavingsGoal(data);
        }}
      />

      <SavingsDepositModal
        goal={depositGoal}
        onClose={() => setDepositGoal(null)}
        formatCurrency={formatCurrencyInput}
        onConfirm={(goal, delta) => {
          setDepositGoal(null);
          handleChangeSavings(goal, delta);
        }}
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
        onImportCSV={handleImportCSV}
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

      <ConfirmModal
        visible={pendingImport !== null}
        title="Importar backup"
        message={
          pendingImport
            ? `Vamos importar ${pendingImport.toImport.length} ${pendingImport.toImport.length === 1 ? "transação nova" : "transações novas"}${pendingImport.duplicates > 0 ? `, ignorando ${pendingImport.duplicates} que já existem` : ""}${pendingImport.invalid > 0 ? ` e ${pendingImport.invalid} linhas inválidas` : ""}. Deseja continuar?`
            : ""
        }
        confirmLabel="Importar"
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />

      <ConfirmModal
        visible={isWipeConfirmOpen}
        title="Zerar Aplicativo"
        message="ATENÇÃO: Isso apagará todas as suas transações, categorias, nome, foto e PIN. Essa ação NÃO pode ser desfeita. Tem certeza?"
        confirmLabel="Sim, apagar tudo"
        destructive
        onCancel={() => setIsWipeConfirmOpen(false)}
        onConfirm={confirmWipeData}
      />
    </SafeAreaView>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardProvider>
      <DashboardChrome />
    </DashboardProvider>
  );
}
