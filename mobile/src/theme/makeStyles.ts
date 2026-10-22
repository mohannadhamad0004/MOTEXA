import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { useMemo } from "react";
import { Theme, useTheme } from "./useTheme";

type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * makeStyles((theme) => ({ card: { backgroundColor: theme.c.surface } })) returns a hook.
 * The sheet is rebuilt only when appearance or language changes.
 */
export function makeStyles<T extends Styles>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)) as T, [theme]);
  };
}
