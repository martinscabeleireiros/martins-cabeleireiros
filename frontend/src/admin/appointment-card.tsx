import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Appointment, formatDuration, formatPhone, formatPrice, openWhatsApp } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

const STATUS: Record<Appointment["status"], { label: string; bg: string; fg: string }> = {
  agendado: { label: "Agendado", bg: colors.brandTertiary, fg: colors.onBrandTertiary },
  concluido: { label: "Concluído", bg: colors.success, fg: colors.onSuccess },
  cancelado: { label: "Cancelado", bg: colors.error, fg: colors.onError },
};

export function AppointmentCard({
  a, actions, whatsText, onWhats,
}: {
  a: Appointment;
  actions?: React.ReactNode;
  whatsText?: string;
  onWhats?: () => void;
}) {
  const st = STATUS[a.status];
  return (
    <View style={[styles.card, a.status === "cancelado" && { opacity: 0.55 }]} testID={`appointment-card-${a.id}`}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{a.time}</Text>
        <View style={styles.timeLine} />
        <Text style={styles.endTime}>{a.end_time}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.client} numberOfLines={1}>{a.client_name}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.service}>{a.service_name} • {formatDuration(a.duration)} • {formatPrice(a.price)}</Text>
        <Text style={styles.phone}>{formatPhone(a.client_phone)}</Text>
        <View style={styles.actions}>
          <Pressable
            testID={`appointment-whatsapp-${a.id}`}
            style={styles.action}
            onPress={() => { openWhatsApp(a.client_phone, whatsText); onWhats?.(); }}
          >
            <Ionicons name="logo-whatsapp" size={16} color={colors.whatsapp} />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
          {actions}
        </View>
      </View>
    </View>
  );
}

export function CardAction({ testID, icon, label, onPress }: { testID: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.brandPrimary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ icon, text, testID }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string; testID: string }) {
  return (
    <View style={styles.empty} testID={testID}>
      <Ionicons name={icon} size={40} color={colors.borderStrong} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export const goClient = (id: string) => router.push({ pathname: "/admin/cliente/[id]", params: { id } });

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  timeCol: { alignItems: "center", width: 52 },
  time: { fontFamily: fonts.display, fontSize: 22, color: colors.brandPrimary, fontWeight: "700" },
  timeLine: { flex: 1, width: 1, backgroundColor: colors.borderStrong, marginVertical: 4, minHeight: 12 },
  endTime: { color: colors.muted, fontSize: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  client: { flex: 1, color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  service: { color: colors.onSurfaceSecondary, fontSize: 13 },
  phone: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  action: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong,
  },
  actionText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 14 },
});
