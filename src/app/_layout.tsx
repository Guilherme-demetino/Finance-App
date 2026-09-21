import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { initDatabase } from "../database/sqlite";
import { hasPinConfigured } from "../utils/security";
import {
  loadPreferences,
  savePreferences,
  ThemeProvider,
  useTheme,
  type ThemePreferences,
} from "../theme";

// Tempo fora do app a partir do qual ele volta pedindo PIN/biometria.
const LOCK_AFTER_BACKGROUND_MS = 60_000;

/** Navegação com a barra de status e o fundo do sistema acompanhando o tema escolhido. */
function ThemedNavigation() {
  const { colors, isDark } = useTheme();

  // O fundo da janela aparece nas transições e atrás do teclado: acompanha o tema.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: "fade",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="security" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="updates" options={{ headerShown: false }} />
        <Stack.Screen name="appearance" options={{ headerShown: false }} />
        <Stack.Screen name="reminders" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Antes do tema carregar, o carregamento usa o escuro (o padrão do app).
  const { colors } = useTheme();
  const [preferences, setPreferences] = useState<ThemePreferences | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    async function setup() {
      // Chama a função que cria as tabelas e espera ela terminar
      await initDatabase();
      // As preferências de tema ficam no banco: lê já para o primeiro desenho sair certo.
      setPreferences(await loadPreferences());
    }

    setup();
  }, []);

  // Re-bloqueia o app (pede PIN/biometria de novo) quando ele volta do
  // background depois de 1 minuto ou mais fora. Sair por pouco tempo (ex:
  // escolher uma foto na galeria) não trava, mas deixar o app parado no
  // background não permite que alguém o abra já desbloqueado.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextState) => {
        if (nextState === "background") {
          if (backgroundedAtRef.current === null) {
            backgroundedAtRef.current = Date.now();
          }
          return;
        }

        if (nextState !== "active") return;

        const leftAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (leftAt === null) return;
        if (Date.now() - leftAt < LOCK_AFTER_BACKGROUND_MS) return;

        // No onboarding o usuário pode sair pra consultar valores (ex: app
        // do banco) e voltar — não faz sentido travar e perder o progresso.
        if (
          pathname === "/security" ||
          pathname === "/" ||
          pathname === "/onboarding"
        )
          return;

        const pinConfigured = await hasPinConfigured();
        if (pinConfigured) {
          router.replace("/security");
        }
      },
    );

    return () => subscription.remove();
  }, [pathname, router]);

  // Enquanto o banco não estiver pronto, mostra um carregamento no fundo escuro
  if (!preferences) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Quando o banco estiver pronto, libera as telas normais
  return (
    <ThemeProvider initial={preferences} onChange={savePreferences}>
      <ThemedNavigation />
    </ThemeProvider>
  );
}
