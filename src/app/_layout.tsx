import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, AppStateStatus, View } from "react-native";
import { initDatabase } from "../database/sqlite";
import { hasPinConfigured } from "../utils/security";
import { colors } from "../constants/colors";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function setup() {
      // Chama a função que cria as tabelas e espera ela terminar
      await initDatabase();
      // Avisa que o banco está pronto
      setDbReady(true);
    }

    setup();
  }, []);

  // Re-bloqueia o app (pede PIN/biometria de novo) sempre que ele volta
  // do background, evitando que alguém acesse o dashboard sem autenticar
  // só porque o app já tinha sido desbloqueado antes.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextState) => {
        const cameFromBackground =
          appStateRef.current.match(/background/) && nextState === "active";
        appStateRef.current = nextState;

        if (!cameFromBackground) return;
        if (pathname === "/security" || pathname === "/") return;

        const pinConfigured = await hasPinConfigured();
        if (pinConfigured) {
          router.replace("/security");
        }
      },
    );

    return () => subscription.remove();
  }, [pathname, router]);

  // Enquanto o banco não estiver pronto, mostra um carregamento no fundo escuro
  if (!dbReady) {
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
    <Stack screenOptions={{ animation: "fade" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="security" options={{ headerShown: false }} />
    </Stack>
  );
}
