import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppointmentCard, CardAction, EmptyState } from "@/src/admin/appointment-card";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { Appointment, formatDateLong, formatPrice } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

export function AgendaView() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const q = useQuery({
    queryKey: ["admin-appts", date],
    queryFn: () => api<Appointment[]>(`/admin/appointments?date=${date}`, { auth: true }),
  });
  const active = (q.data ?? []).filter((a) => a.status !== "cancelado");
  const busyMin = active.reduce((s, a) => s + a.duration, 0);
  const revenue = active.reduce((s, a) => s + a.price, 0);

  const setStatus = async (a: Appointment, status: Appointment["status"]) => {
    try {
      await api(`/admin/appointments/${a.id}`, { method: "PATCH", auth: true, body: { status } });
      qc.invalidateQueries({ queryKey: ["admin-appts"] });
      toast(status === "concluido" ? "Atendimento concluído" : status === "cancelado" ? "Agendamento cancelado — horário liberado" : "Agendamento reativado", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const remove = async (a: Appointment) => {
    try {
      await api(`/admin/appointments/${a.id}`, { method: "DELETE", auth: true });
      qc.invalidateQueries({ queryKey: ["admin-appts"] });
      qc.invalidateQueries({ queryKey: ["client"] });
      toast("Agendamento excluído permanentemente", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const shift = (n: number) => setDate(dayjs(date).add(n, "day").format("YYYY-MM-DD"));

  return (
    <View style={{ flex: 1 }} testID="admin-agenda-view">
      <View style={styles.dateBar}>
        <Pressable testID="agenda-prev-day" onPress={() => shift(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="agenda-today-button" onPress={() => setDate(dayjs().format("YYYY-MM-DD"))} style={{ flex: 1 }}>
          <Text style={styles.dateText} testID="agenda-date-label">{formatDateLong(date)}</Text>
          <Text style={styles.dateSub}>{date === dayjs().format("YYYY-MM-DD") ? "Hoje" : "Toque para voltar a hoje"}</Text>
        </Pressable>
        <Pressable testID="agenda-next-day" onPress={() => shift(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <View style={styles.stats}>
        <Stat label="Atendimentos" value={String(active.length)} testID="agenda-stat-count" />
        <Stat label="Tempo ocupado" value={`${Math.floor(busyMin / 60)}h${String(busyMin % 60).padStart(2, "0")}`} testID="agenda-stat-busy" />
        <Stat label="Previsto" value={formatPrice(revenue)} testID="agenda-stat-revenue" />
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 96 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState icon="calendar-clear-outline" text="Nenhum agendamento para este dia." testID="agenda-empty" />}
          renderItem={({ item }) => (
            <AppointmentCard
              a={item}
              actions={
                item.status === "agendado" ? (
                  <>
                    <CardAction testID={`appointment-done-${item.id}`} icon="checkmark-circle-outline" label="Concluir" onPress={() => setStatus(item, "concluido")} />
                    <CardAction testID={`appointment-cancel-${item.id}`} icon="close-circle-outline" label="Cancelar" onPress={() => setStatus(item, "cancelado")} />
                  </>
                ) : (
                  <>
                    <CardAction testID={`appointment-reopen-${item.id}`} icon="refresh-outline" label="Reabrir" onPress={() => setStatus(item, "agendado")} />
                    {item.status === "cancelado" && (
                      <CardAction testID={`appointment-delete-${item.id}`} icon="trash-outline" label="Excluir" onPress={() => remove(item)} />
                    )}
                  </>
                )
              }
            />
          )}
        />
      )}
      <Pressable testID="agenda-new-appointment-button" onPress={() => router.push("/agendar")} style={[styles.fab, { bottom: insets.bottom + 16 }]}>
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} testID={testID}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dateBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.md },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dateText: { fontFamily: fonts.display, fontSize: 22, color: colors.onSurface, textAlign: "center", textTransform: "capitalize" },
  dateSub: { color: colors.muted, fontSize: 12, textAlign: "center" },
  stats: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.brandPrimary, fontSize: 18, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", elevation: 6,
  },
});
