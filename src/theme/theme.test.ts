import { contrastRatio, luminance } from "./contrast";
import {
  DARK_COLORS,
  HIGH_CONTRAST_DARK_COLORS,
  HIGH_CONTRAST_LIGHT_COLORS,
  LIGHT_COLORS,
  resolvePalette,
  type ThemeColors,
} from "./palettes";
import {
  DEFAULT_PREFERENCES,
  FONT_SCALE_OPTIONS,
  isDarkTheme,
  parsePreferences,
} from "./preferences";
import { scaleTextStyle } from "./textScale";

describe("contrastRatio", () => {
  it("segue a fórmula WCAG", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("é simétrico e recusa cor inválida", () => {
    expect(contrastRatio("#123456", "#ABCDEF")).toBe(contrastRatio("#ABCDEF", "#123456"));
    expect(() => contrastRatio("azul", "#FFFFFF")).toThrow();
  });
});

const PALETTES: [string, ThemeColors][] = [
  ["escuro", DARK_COLORS],
  ["claro", LIGHT_COLORS],
  ["escuro com alto contraste", HIGH_CONTRAST_DARK_COLORS],
  ["claro com alto contraste", HIGH_CONTRAST_LIGHT_COLORS],
];

describe.each(PALETTES)("paleta %s: legibilidade", (_name, colors) => {
  const grounds = [colors.background, colors.surface, colors.surfaceAlt];

  it("texto principal e secundário passam de 4.5:1 sobre todos os fundos (padrão AA)", () => {
    for (const ground of grounds) {
      expect(contrastRatio(colors.textPrimary, ground)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(colors.textSecondary, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("texto discreto (muted) passa de 4.5:1 sobre fundo e cartão", () => {
    expect(contrastRatio(colors.textMuted, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("verde, vermelho e azul (valores e ícones) passam de 3:1 sobre fundo e cartão", () => {
    for (const ground of [colors.background, colors.surface]) {
      expect(contrastRatio(colors.income, ground)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(colors.expense, ground)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(colors.accent, ground)).toBeGreaterThanOrEqual(3);
    }
  });

  it("borda visível contra o fundo e o cartão", () => {
    expect(contrastRatio(colors.border, colors.surface)).toBeGreaterThan(1);
    expect(contrastRatio(colors.border, colors.background)).toBeGreaterThan(1);
  });

  it("todas as cores são hex de 6 dígitos", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("texto sobre fundo colorido (botão azul, marcadores)", () => {
  // O escuro normal fica de fora de propósito: preserva as cores originais do app
  // (texto branco sobre verde/azul), que ficam abaixo de 4.5:1. Quem precisa de
  // mais legibilidade usa o alto contraste, coberto abaixo.
  it.each(PALETTES.filter(([name]) => name !== "escuro"))(
    "paleta %s: textOnColor passa de 4.5:1 sobre azul, verde e vermelho",
    (_name, colors) => {
      for (const fill of [colors.accent, colors.income, colors.expense]) {
        expect(contrastRatio(colors.textOnColor, fill)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("o escuro normal mantém texto branco sobre as cores de destaque, como sempre foi", () => {
    expect(DARK_COLORS.textOnColor).toBe("#FFFFFF");
  });
});

describe("alto contraste é mais forte que o normal", () => {
  it("texto discreto e bordas ganham contraste nos dois temas", () => {
    expect(contrastRatio(HIGH_CONTRAST_DARK_COLORS.textMuted, HIGH_CONTRAST_DARK_COLORS.surface)).toBeGreaterThan(
      contrastRatio(DARK_COLORS.textMuted, DARK_COLORS.surface),
    );
    expect(contrastRatio(HIGH_CONTRAST_LIGHT_COLORS.textMuted, HIGH_CONTRAST_LIGHT_COLORS.surface)).toBeGreaterThan(
      contrastRatio(LIGHT_COLORS.textMuted, LIGHT_COLORS.surface),
    );
    expect(contrastRatio(HIGH_CONTRAST_DARK_COLORS.border, HIGH_CONTRAST_DARK_COLORS.surface)).toBeGreaterThan(
      contrastRatio(DARK_COLORS.border, DARK_COLORS.surface),
    );
    expect(contrastRatio(HIGH_CONTRAST_LIGHT_COLORS.border, HIGH_CONTRAST_LIGHT_COLORS.surface)).toBeGreaterThan(
      contrastRatio(LIGHT_COLORS.border, LIGHT_COLORS.surface),
    );
  });

  it("no alto contraste, todo texto passa de 7:1 (padrão AAA)", () => {
    for (const colors of [HIGH_CONTRAST_DARK_COLORS, HIGH_CONTRAST_LIGHT_COLORS]) {
      for (const ground of [colors.background, colors.surface]) {
        expect(contrastRatio(colors.textPrimary, ground)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(colors.textSecondary, ground)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(colors.textMuted, ground)).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe("resolvePalette", () => {
  it("escolhe a paleta pelo tema e pelo alto contraste", () => {
    expect(resolvePalette({ isDark: true, highContrast: false })).toBe(DARK_COLORS);
    expect(resolvePalette({ isDark: false, highContrast: false })).toBe(LIGHT_COLORS);
    expect(resolvePalette({ isDark: true, highContrast: true })).toBe(HIGH_CONTRAST_DARK_COLORS);
    expect(resolvePalette({ isDark: false, highContrast: true })).toBe(HIGH_CONTRAST_LIGHT_COLORS);
  });

  it("o escuro normal continua com as cores de sempre do app", () => {
    expect(DARK_COLORS).toMatchObject({
      background: "#121212",
      surface: "#1E1E1E",
      textPrimary: "#FFFFFF",
      income: "#10B981",
      expense: "#EF4444",
      accent: "#3B82F6",
    });
  });

  it("cores de categoria são iguais em todos os temas", () => {
    for (const [, colors] of PALETTES) {
      expect(colors.categoryOrange).toBe(DARK_COLORS.categoryOrange);
      expect(colors.categoryCyan).toBe(DARK_COLORS.categoryCyan);
    }
  });
});

describe("preferências", () => {
  it("o padrão é escuro, sem alto contraste e fonte padrão (como o app sempre foi)", () => {
    expect(DEFAULT_PREFERENCES).toEqual({ mode: "dark", highContrast: false, fontScale: 1 });
    expect(parsePreferences({ mode: null, highContrast: null, fontScale: null })).toEqual(DEFAULT_PREFERENCES);
  });

  it("lê valores salvos", () => {
    expect(parsePreferences({ mode: "light", highContrast: "1", fontScale: "1.3" })).toEqual({
      mode: "light",
      highContrast: true,
      fontScale: 1.3,
    });
    expect(parsePreferences({ mode: "system", highContrast: "0", fontScale: "1.15" })).toEqual({
      mode: "system",
      highContrast: false,
      fontScale: 1.15,
    });
  });

  it("valor estranho vira o padrão em vez de quebrar", () => {
    expect(parsePreferences({ mode: "roxo", highContrast: "talvez", fontScale: "9" })).toEqual(DEFAULT_PREFERENCES);
  });

  it("as opções de fonte incluem o padrão e só valores aceitos", () => {
    expect(FONT_SCALE_OPTIONS.map((option) => option.value)).toEqual([1, 1.15, 1.3]);
  });

  it("isDarkTheme: automático segue o sistema, e sem informação fica escuro", () => {
    expect(isDarkTheme("dark", "light")).toBe(true);
    expect(isDarkTheme("light", "dark")).toBe(false);
    expect(isDarkTheme("system", "light")).toBe(false);
    expect(isDarkTheme("system", "dark")).toBe(true);
    expect(isDarkTheme("system", null)).toBe(true);
    expect(isDarkTheme("system", undefined)).toBe(true);
  });
});

describe("scaleTextStyle", () => {
  it("escala 1 devolve o estilo sem mexer", () => {
    const style = { fontSize: 16 };
    expect(scaleTextStyle(style, 1)).toBe(style);
  });

  it("multiplica fontSize e lineHeight", () => {
    const scaled = scaleTextStyle({ fontSize: 20, lineHeight: 24, color: "red" }, 1.3) as {
      fontSize: number;
      lineHeight: number;
      color: string;
    };
    expect(scaled.fontSize).toBeCloseTo(26, 5);
    expect(scaled.lineHeight).toBeCloseTo(31.2, 5);
    expect(scaled.color).toBe("red");
  });

  it("estilo sem fontSize usa o padrão do React Native (14) como base", () => {
    expect(scaleTextStyle({ color: "red" }, 1.15)).toEqual({ color: "red", fontSize: 14 * 1.15 });
    expect(scaleTextStyle(undefined, 1.3)).toEqual({ fontSize: 14 * 1.3 });
  });

  it("aceita lista de estilos (a última vence) e valores falsos", () => {
    expect(scaleTextStyle([{ fontSize: 10 }, false, { fontSize: 20 }], 1.15)).toEqual({ fontSize: 20 * 1.15 });
  });

  it("sem lineHeight, não inventa um", () => {
    expect(scaleTextStyle({ fontSize: 10 }, 1.3)).not.toHaveProperty("lineHeight");
  });
});
