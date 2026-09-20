import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

/** Tamanho que o React Native usa quando o estilo não define fontSize. */
const DEFAULT_FONT_SIZE = 14;

/**
 * Multiplica o tamanho da letra (e a altura da linha, para o texto não ser cortado)
 * pela escolha do usuário. Escala 1 devolve o estilo como veio.
 */
export function scaleTextStyle(
  style: StyleProp<TextStyle>,
  scale: number,
): StyleProp<TextStyle> {
  if (scale === 1) return style;

  const flat = StyleSheet.flatten(style) ?? {};
  const scaled: TextStyle = {
    ...flat,
    fontSize: (typeof flat.fontSize === "number" ? flat.fontSize : DEFAULT_FONT_SIZE) * scale,
  };
  if (typeof flat.lineHeight === "number") scaled.lineHeight = flat.lineHeight * scale;
  return scaled;
}
