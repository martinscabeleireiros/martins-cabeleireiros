import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppointmentCard, EmptyState } from "@/src/admin/appointment-card";
import { api } from "@/src/api";
import { Appointment, formatDateLong, SALON } from "@/src/constants";
import { colors, fonts, spacing } from "@/src/theme";

const reminderText = (a: Appointment) =>
  `Olá, ${a.client_name.split(" ")[0]}! Passando para lembrar do seu horário amanhã no ${SALON.name}:\n\n` +
  `• ${a.service_name}\n• ${formatDateLong(a.date)} às ${a.time}\n\n` +
  `Endereço: ${SALON.address}\nPodemos confirmar? Obrigado!`;

export function RemindersView() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-reminders"],
    queryFn: () => api<{ date: string; items: Appointment[] }>("/admin/reminders", { auth: true }),
  });

  const markReminded = async (a: Appointment) => {
    await api(`/admin/appointments/${a.id}`, { method: "PATCH", auth: true, body: { reminded: true } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["admin-reminders"] });
  };

  const items = q.data?.items ?? [];
  const pending = items.filter((a) => !a.reminded).length;

  return (
    <View style={{ flex: 1 }} testID="admin-reminders-view">
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm }}>
              <Text style={styles.title}>Lembretes de véspera</Text>
              <Text style={styles.sub} testID="reminders-summary">
                {q.data ? `${formatDateLong(q.data.date)} • ${items.length} agendamento(s) • ${pending} a lembrar` : ""}
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" text="Nenhum agendamento para amanhã." testID="reminders-empty" />}
          renderItem={({ item }) => (
            <View>
              {item.reminded && <Text style={styles.sent} testID={`reminder-sent-${item.id}`}>✓ Lembrete enviado</Text>}
              <AppointmentCard a={item} whatsText={reminderText(item)} onWhats={() => markReminded(item)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.onSurface },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  sent: { color: colors.onSuccess, fontSize: 12, fontWeight: "700", marginBottom: 4 },
});
