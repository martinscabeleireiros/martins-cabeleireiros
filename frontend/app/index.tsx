import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { GoldButton, GoldDivider } from "@/src/components/ui";
import { WhatsAppFab } from "@/src/components/whatsapp-fab";
import { formatDuration, formatPrice, SALON, Service } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

const BOOK_BAR = 84;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: () => api<Service[]>("/services"),
  });

  return (
    <View style={styles.root} testID="home-screen">
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.topTitle} testID="home-title">{SALON.name}</Text>
        <Pressable testID="admin-access-button" onPress={() => router.push("/admin")} style={styles.adminBtn} hitSlop={8}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: BOOK_BAR + insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
          <Image source={require("../assets/images/logo.jpg")} style={styles.logo} contentFit="cover" testID="home-logo" />
          <Text style={styles.slogan} testID="home-slogan">“{SALON.slogan}”</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.infoCard}>
          <Pressable
            testID="home-address"
            style={styles.infoRow}
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SALON.address)}`)}
          >
            <Ionicons name="location-outline" size={20} color={colors.brandPrimary} />
            <Text style={styles.infoText}>{SALON.address}</Text>
          </Pressable>
          <View style={styles.infoSep} />
          <View style={styles.infoRow} testID="home-hours">
            <Ionicons name="time-outline" size={20} color={colors.brandPrimary} />
            <Text style={styles.infoText}>{SALON.hours}</Text>
          </View>
          <View style={styles.infoSep} />
          <View style={styles.infoRow}>
            <Ionicons name="logo-whatsapp" size={20} color={colors.brandPrimary} />
            <Text style={styles.infoText}>{SALON.whatsappDisplay}</Text>
          </View>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.overline}>NOSSOS SERVIÇOS</Text>
          <Text style={styles.sectionTitle}>Tabela de preços</Text>
          <GoldDivider />
          {isLoading && <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />}
          {isError && (
            <GoldButton testID="services-retry-button" title="Tentar novamente" variant="outline" onPress={() => refetch()} />
          )}
          {data?.map((s, i) => (
            <Animated.View key={s.id} entering={FadeInDown.delay(200 + i * 40)}>
              <Pressable
                testID={`service-item-${s.id}`}
                onPress={() => router.push({ pathname: "/agendar", params: { service: s.id } })}
                style={({ pressed }) => [styles.serviceRow, pressed && { backgroundColor: colors.surfaceSecondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <View style={styles.durationRow}>
                    <Ionicons name="hourglass-outline" size={12} color={colors.muted} />
                    <Text style={styles.serviceDuration}>{formatDuration(s.duration)}</Text>
                  </View>
                </View>
                <Text style={styles.servicePrice}>{formatPrice(s.price)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bookBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <GoldButton testID="book-now-button" title="Agendar horário" icon="calendar-outline" onPress={() => router.push("/agendar")} style={{ flex: 1 }} />
      </View>
      <WhatsAppFab extraBottom={BOOK_BAR - 8} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  topTitle: { flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.brandPrimary, fontWeight: "600" },
  adminBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  logo: { width: "100%", aspectRatio: 1.35, borderRadius: radius.lg },
  slogan: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    fontStyle: "italic",
    color: colors.onSurface,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  infoCard: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 36 },
  infoText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  infoSep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  overline: { color: colors.brandPrimary, fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  sectionTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurface, marginTop: spacing.xs },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    borderRadius: radius.sm,
  },
  serviceName: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  serviceDuration: { color: colors.muted, fontSize: 13 },
  servicePrice: { fontFamily: fonts.display, color: colors.brandPrimary, fontSize: 22, fontWeight: "700" },
  bookBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.scrim,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
