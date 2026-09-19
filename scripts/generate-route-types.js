/**
 * Gera .expo/types/router.d.ts (rotas tipadas do Expo Router) sem subir o
 * servidor de desenvolvimento. Esse arquivo é ignorado pelo git, então o CI
 * precisa gerá-lo antes do `tsc` para que rota inexistente em router.push /
 * router.replace / <Link> quebre o build em vez de passar em silêncio.
 *
 * Usa o mesmo gerador que o `expo start` (@expo/router-server), chamado direto
 * para que qualquer erro derrube o processo em vez de ser engolido.
 */
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const appRoot = path.join(projectRoot, "src", "app");
const typesDir = path.join(projectRoot, ".expo", "types");

// O gerador vem dentro do @expo/cli, que é dependência do `expo`.
const expoDir = path.dirname(require.resolve("expo/package.json", { paths: [projectRoot] }));
const cliDir = path.dirname(require.resolve("@expo/cli/package.json", { paths: [expoDir] }));
const generatorPath = require.resolve("@expo/router-server/build/typed-routes/generate", {
  paths: [cliDir],
});
const { getTypedRoutesDeclarationFile } = require(generatorPath);
// Os mesmos pontos de entrada que o gerador do CLI usa.
const { requireContext } = require("expo-router/internal/testing");
const { EXPO_ROUTER_CTX_IGNORE } = require("expo-router/_ctx-shared");

process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const ctx = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
const declaration = getTypedRoutesDeclarationFile(ctx, {});
if (!declaration) {
  console.error("Não foi possível gerar as rotas tipadas: nenhuma rota encontrada em src/app.");
  process.exit(1);
}

fs.mkdirSync(typesDir, { recursive: true });
fs.writeFileSync(path.join(typesDir, "router.d.ts"), declaration);
console.log(`Rotas tipadas geradas em ${path.relative(projectRoot, path.join(typesDir, "router.d.ts"))}`);
