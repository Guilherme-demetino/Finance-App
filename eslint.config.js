// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // O padrão "buscar dados ao montar" é usado deliberadamente em
      // várias telas/hooks do app (fetch de transações, usuário, PIN).
      // A regra do compiler experimental do React marca isso como erro;
      // mantemos como aviso em vez de travar o CI por um padrão válido.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
