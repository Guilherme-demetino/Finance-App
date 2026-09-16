import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { initDatabase } from "../database/sqlite";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function setup() {
      // Chama a função que cria as tabelas e espera ela terminar
      await initDatabase();
      // Avisa que o banco está pronto
      setDbReady(true);
    }

    setup();
  }, []);

  // Enquanto o banco não estiver pronto, mostra um carregamento no fundo escuro
  if (!dbReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#121212",
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Quando o banco estiver pronto, libera as telas normais
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
    </Stack>
  );
}
