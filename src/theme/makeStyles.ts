import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme, type Theme } from "./ThemeContext";

/**
 * Cria estilos que dependem do tema. Devolve um hook: o StyleSheet é refeito só
 * quando o tema muda.
 *
 * @example
 * const useStyles = makeStyles(({ colors }) => ({ box: { backgroundColor: colors.surface } }));
 * function Box() { const styles = useStyles(); return <View style={styles.box} />; }
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
