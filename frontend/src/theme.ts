// Design tokens for Martins Cabeleireiro. Dark only (black & gold).
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#050404",
  onSurface: "#F5F2E9",
  surfaceSecondary: "#1A1613",
  onSurfaceSecondary: "#E8E2D5",
  surfaceTertiary: "#2A241F",
  onSurfaceTertiary: "#D1C7B3",
  surfaceInverse: "#F5F2E9",
  onSurfaceInverse: "#050404",
  muted: "#8C8477",

  brand: "#C5A059",
  onBrand: "#050404",
  brandPrimary: "#C5A059",
  onBrandPrimary: "#050404",
  brandSecondary: "#917B46",
  onBrandSecondary: "#F5F2E9",
  brandTertiary: "#3E331B",
  onBrandTertiary: "#E2C889",

  success: "#3C5A3E",
  onSuccess: "#A3CBA6",
  warning: "#7A5A22",
  onWarning: "#E5C282",
  error: "#6B2A2A",
  onError: "#EDA5A5",
  info: "#2B4A5F",
  onInfo: "#9FCAE6",

  border: "#2E2721",
  borderStrong: "#4A4036",
  divider: "#1F1A16",

  scrim: "rgba(5,4,4,0.72)",
  whatsapp: "#25D366",
  onWhatsapp: "#FFFFFF",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark: ThemeColors } = { light: dark, dark };

export const colors = dark;

export const fonts = {
  display: "Cormorant",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    return useMemo(() => StyleSheet.create(factory(dark)), []);
  };
}
