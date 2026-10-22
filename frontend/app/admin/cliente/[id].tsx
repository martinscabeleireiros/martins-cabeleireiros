import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/src/admin/appointment-card";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton, ScreenHeader } from "@/src/components/ui";
import { Appointment, Client, formatDateShort, formatPhone, formatPrice, openWhatsApp } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Detail = { client: Client; history: Appointment[]; visits: number; total_spent: number };

const STATUS_LABEL = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado" };

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["client", id], queryFn: () => api<Detail>(`/admin/clients/${id}`, { auth: true }) });

  const remove = async () => {
    await api(`/admin/clients/${id}`, { method: "DELETE", auth: true }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
    toast("Cliente removido", "success");
    router.back();
  };

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Cliente" />
        {q.isError ? <EmptyState icon="alert-circle-outline" text="Cliente não encontrado." testID="client-error" /> : <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />}
      </View>
    );
  }
  const { client, history, visits, total_spent } = q.data;

  return (
    <View style={styles.root} testID="client-detail-screen">
      <ScreenHeader
        title="Cliente"
        right={
          <Pressable testID="client-delete-button" onPress={remove} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.muted} />
          </Pressable>
        }
      />
      <FlatList
        data={history}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(client.name[0] || "?").toUpperCase()}</Text>
            </View>
            <Text style={styles.name} testID="client-name">{client.name}</Text>
            <Text style={styles.phone} testID="client-phone">{formatPhone(client.phone)}</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue} testID="client-visits">{visits}</Text>
                <Text style={styles.statLabel}>Visitas concluídas</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue} testID="client-total-spent">{formatPrice(total_spent)}</Text>
                <Text style={styles.statLabel}>Total gasto</Text>
              </View>
            </View>
            <GoldButton testID="client-whatsapp-button" icon="logo-whatsapp" title="Conversar no WhatsApp" onPress={() => openWhatsApp(client.phone, `Olá, ${client.name.split(" ")[0]}!`)} />
            <Text style={styles.section}>Histórico de visitas</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="time-outline" text="Nenhuma visita registrada ainda." testID="client-history-empty" />}
        renderItem={({ item }) => (
          <View style={styles.histRow} testID={`client-history-${item.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.histService}>{item.service_name}</Text>
              <Text style={styles.histDate}>{formatDateShort(item.date)} • {item.time}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.histPrice}>{formatPrice(item.price)}</Text>
              <Text style={[styles.histStatus, item.status === "cancelado" && { color: colors.onError }, item.status === "concluido" && { color: colors.onSuccess }]}>
                {STATUS_LABEL[item.status]}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", alignSelf: "center", borderWidth: 1, borderColor: colors.brandPrimary },
  avatarText: { color: colors.onBrandTertiary, fontSize: 30, fontFamily: fonts.display, fontWeight: "700" },
  name: { fontFamily: fonts.display, fontSize: 30, color: colors.onSurface, textAlign: "center" },
  phone: { color: colors.muted, textAlign: "center", marginTop: -8 },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.brandPrimary, fontSize: 20, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 12 },
  section: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, marginTop: spacing.md },
  histRow: { flexDirection: "row", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  histService: { color: colors.onSurface, fontWeight: "600" },
  histDate: { color: colors.muted, fontSize: 13, marginTop: 2 },
  histPrice: { color: colors.brandPrimary, fontWeight: "700" },
  histStatus: { color: colors.onBrandTertiary, fontSize: 12, marginTop: 2 },
});
