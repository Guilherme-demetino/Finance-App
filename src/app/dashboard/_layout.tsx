import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { AlertContainer } from "../../components/dashboard/AlertContainer";
import { AutoBackupRunner } from "../../components/dashboard/AutoBackupRunner";
import { BudgetAlertsRunner } from "../../components/dashboard/BudgetAlertsRunner";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { DebtModalContainer } from "../../components/dashboard/DebtModalContainer";
import { DueRemindersRunner } from "../../components/dashboard/DueRemindersRunner";
import { NewTransactionFab } from "../../components/dashboard/NewTransactionFab";
import { PanoramaContainer } from "../../components/dashboard/PanoramaContainer";
import { ProfileMenuContainer } from "../../components/dashboard/ProfileMenuContainer";
import { SavingsModalsContainer } from "../../components/dashboard/SavingsModalsContainer";
import { TransactionModalContainer } from "../../components/dashboard/TransactionModalContainer";
import { UndoSnackbarContainer } from "../../components/dashboard/UndoSnackbarContainer";
import { ReleaseNotesModal } from "../../components/ReleaseNotesModal";

import { DashboardProviders } from "../../context/DashboardProviders";
import { useReleaseNotes } from "../../hooks/useReleaseNotes";
import { useDashboardStyles } from "../../styles/dashboardStyles";
import { useTheme } from "../../theme";

/**
 * Moldura do dashboard. Não lê nenhum contexto de dados: cada parte abaixo
 * (cabeçalho, modais, botão "+") assina só o domínio de que precisa, então
 * uma mudança num domínio não redesenha o resto.
 */
function DashboardChrome() {
  const { colors, fontScale } = useTheme();
  const styles = useDashboardStyles();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { releases, dismiss: dismissReleaseNotes } = useReleaseNotes();

  return (
    <SafeAreaView style={styles.container}>
      <DashboardHeader onOpenMenu={() => setIsMenuOpen(true)} />

      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: true,
          // O rótulo é desenhado pelo react-navigation (não passa pelo Text do app):
          // acompanha o tamanho da letra, e a barra cresce junto para não cortar.
          tabBarLabelStyle: {
            fontSize: 11 * fontScale,
            fontWeight: "700",
          },
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            height: 64 + Math.round((fontScale - 1) * 20),
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
          name="cards"
          options={{
            title: "Cartões",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "card" : "card-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        {/* Aberta pelo cartão "Assinaturas" do Início: fica fora da barra de baixo. */}
        <Tabs.Screen name="subscriptions" options={{ href: null }} />
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

      <NewTransactionFab />

      <TransactionModalContainer />
      <DebtModalContainer />
      <SavingsModalsContainer />
      <PanoramaContainer />

      <ProfileMenuContainer
        isMenuOpen={isMenuOpen}
        onCloseMenu={() => setIsMenuOpen(false)}
      />

      <ReleaseNotesModal releases={releases} onClose={dismissReleaseNotes} />

      <AlertContainer />
      <UndoSnackbarContainer />
      <AutoBackupRunner />
      <DueRemindersRunner />
      <BudgetAlertsRunner />
    </SafeAreaView>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardProviders>
      <DashboardChrome />
    </DashboardProviders>
  );
}
