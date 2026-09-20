/**
 * Guardas do código-fonte: falham se alguém, no futuro, escrever uma cor solta
 * ou usar o Text do React Native direto, o que faria o tema e o tamanho da
 * letra deixarem de valer naquele pedaço da tela.
 */
// O projeto não carrega os tipos do Node (para não poluir o código do app): declara só o que este teste usa.
declare const __dirname: string;
interface DirEntry {
  name: string;
  isDirectory(): boolean;
}
const fs = jest.requireActual("fs") as {
  readdirSync(dir: string, options: { withFileTypes: true }): DirEntry[];
  readFileSync(file: string, encoding: "utf8"): string;
};
const path = jest.requireActual("path") as {
  resolve(...parts: string[]): string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};

export {};

const SRC = path.resolve(__dirname, "..");

function sourceFiles(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");

// Onde cor literal é permitida: as paletas, o relatório em HTML (é impresso, não usa o tema)
// e a lista de cores que o usuário escolhe para categorias.
const COLOR_ALLOWED = new Set(["theme/palettes.ts", "utils/export.ts"]);

describe("código-fonte do app", () => {
  it("não tem cor solta: as cores vêm do tema (só o véu preto atrás dos modais é literal)", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const name = relative(file);
      if (COLOR_ALLOWED.has(name)) continue;

      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const code = line.replace(/\/\/.*$/, "");
          const hex = code.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/);
          const rgba = [...code.matchAll(/rgba?\(([^)]*)\)/g)].filter((m) => !/^\s*0\s*,\s*0\s*,\s*0\s*(,|$)/.test(m[1]));
          if (hex || rgba.length > 0) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
        });
    }

    expect(offenders).toEqual([]);
  });

  it("nenhum arquivo importa Text ou TextInput direto do react-native (perderia o tamanho da letra)", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const name = relative(file);
      if (name === "theme/Text.tsx") continue;

      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"react-native";/g)) {
        const names = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0]);
        if (names.includes("Text") || names.includes("TextInput")) offenders.push(name);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("todo cartão com fundo 'surface' tem contorno (senão some no fundo preto do alto contraste escuro)", () => {
    // O fundo da tela (#000) e o do cartão (#0A0A0A) quase não se distinguem: só o contorno separa os dois.
    // Vale para cartões de página e de pop-up (esses usam modalCard, que já traz o contorno).
    const outline = /border(Top|Bottom|Left|Right)?(Width|Color)|modalCard/;
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (!/backgroundColor:\s*colors\.surface\b(?!Alt)/.test(line)) return;
        if (/^\s*(\*|\/\/)/.test(line)) return; // comentário

        // O objeto de estilo: da linha que abre a chave até a que fecha.
        let start = index;
        while (start > 0 && !lines[start].trimEnd().endsWith("{")) start--;
        let end = index;
        while (end < lines.length - 1 && !/^\s*\},?\s*$/.test(lines[end])) end++;

        if (!outline.test(lines.slice(start, end + 1).join("\n"))) {
          offenders.push(`${relative(file)}:${index + 1}: ${lines[start].trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("nenhum arquivo lê 'colors' do módulo antigo (as cores vêm do useTheme)", () => {
    const offenders = sourceFiles()
      .filter((file) => /import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*"[^"]*constants\/colors"/.test(fs.readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
