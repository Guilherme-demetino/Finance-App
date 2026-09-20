export { makeStyles } from "./makeStyles";
export {
  ACCENT_COLORS,
  CATEGORY_COLORS,
  resolvePalette,
  type ThemeColors,
} from "./palettes";
export {
  DEFAULT_PREFERENCES,
  FONT_SCALE_OPTIONS,
  type FontScale,
  type ThemeMode,
  type ThemePreferences,
} from "./preferences";
export { loadPreferences, savePreferences } from "./preferencesStorage";
export { Text, TextInput } from "./Text";
export { ThemeProvider, useTheme, useThemeActions, type Theme } from "./ThemeContext";
