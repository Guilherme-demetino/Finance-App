import { forwardRef } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from "react-native";

import { useTheme } from "./ThemeContext";
import { scaleTextStyle } from "./textScale";

/**
 * Text e TextInput do app: iguais aos do React Native, mas aplicam o tamanho de
 * fonte escolhido em "Aparência e acessibilidade". O tamanho do sistema
 * (Configurações do Android) continua valendo por cima.
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  const { fontScale } = useTheme();
  return <RNText ref={ref} style={scaleTextStyle(style, fontScale)} {...props} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  const { fontScale } = useTheme();
  return <RNTextInput ref={ref} style={scaleTextStyle(style, fontScale)} {...props} />;
});
