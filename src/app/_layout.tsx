import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { initDatabase } from "../database/sqlite";
import { hasPinConfigured } from "../utils/security";
import { colors } from "../constants/colors";

// Tempo fora do app a partir do qual ele volta pedindo PIN/biometria.
const LOCK_AFTER_BACKGROUND_MS = 60_000;

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    async function setup() {
      // Chama a função que cria as tabelas e espera ela terminar
      await initDatabase();
      // Avisa que o banco está pronto
      setDbReady(true);
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
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}
