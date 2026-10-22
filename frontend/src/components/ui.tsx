import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme";

export function GoldButton({
  title, onPress, loading, disabled, testID, variant = "solid", icon, style,
}: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID: string;
  variant?: "solid" | "outline"; icon?: React.ComponentProps<typeof Ionicons>["name"]; style?: ViewStyle;
}) {
  const solid = variant === "solid";
  const fg = solid ? colors.onBrandPrimary : colors.brandPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        solid ? { backgroundColor: colors.brandPrimary } : { borderWidth: 1, borderColor: colors.brandPrimary },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ScreenHeader({ title, right, testID }: { title: string; right?: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} testID={testID}>
      <Pressable
        testID="header-back-button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={styles.iconBtn}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color={colors.brandPrimary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.iconBtn}>{right}</View>
    </View>
  );
}

export function GoldDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Ionicons name="cut" size={14} color={colors.brandPrimary} />
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  btnText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 24, color: colors.onSurface },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
});
