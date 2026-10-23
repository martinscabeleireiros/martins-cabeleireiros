import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { formatPrice } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Report = {
  month: string; revenue: number; expected: number; total: number; completed: number; scheduled: number;
  cancelled: number; confirmed: number; unique_clients: number; avg_ticket: number;
  top_services: { service_id: string; name: string; count: number; revenue: number }[];
};

export function ReportView() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const q = useQuery({ queryKey: ["report", month], queryFn: () => api<Report>(`/admin/report?month=${month}`, { auth: true }) });
  const shift = (n: number) => setMonth(dayjs(`${month}-01`).add(n, "month").format("YYYY-MM"));
  const r = q.data;
  const maxCount = Math.max(1, ...(r?.top_services.map((s) => s.count) ?? [1]));

  return (
    <ScrollView
      testID="admin-report-view"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
    >
      <View style={styles.monthBar}>
        <Pressable testID="report-prev-month" onPress={() => shift(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brandPrimary} />
        </Pressable>
        <Text style={styles.month} testID="report-month-label">{dayjs(`${month}-01`).format("MMMM [de] YYYY")}</Text>
        <Pressable testID="report-next-month" onPress={() => shift(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {q.isLoading || !r ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>FATURAMENTO (CONCLUÍDOS)</Text>
            <Text style={styles.heroValue} testID="report-revenue">{formatPrice(r.revenue)}</Text>
            <Text style={styles.heroSub} testID="report-expected">+ {formatPrice(r.expected)} previstos em agendamentos abertos</Text>
          </View>
          <View style={styles.grid}>
            <Stat label="Total de atendimentos" value={r.total} testID="report-total" />
            <Stat label="Concluídos" value={r.completed} testID="report-completed" />
            <Stat label="A realizar" value={r.scheduled} testID="report-scheduled" />
            <Stat label="Cancelados" value={r.cancelled} testID="report-cancelled" />
            <Stat label="Clientes atendidos" value={r.unique_clients} testID="report-clients" />
            <Stat label="Ticket médio" value={formatPrice(r.avg_ticket)} testID="report-avg-ticket" />
          </View>

          <Text style={styles.section}>Serviços mais vendidos</Text>
          {r.top_services.length === 0 && <Text style={styles.muted} testID="report-empty">Nenhum atendimento neste mês.</Text>}
          {r.top_services.map((s, i) => (
            <View key={s.service_id} style={styles.svcRow} testID={`report-service-${s.service_id}`}>
              <Text style={styles.rank}>{i + 1}º</Text>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.svcTop}>
                  <Text style={styles.svcName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.svcCount}>{s.count}x</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.bar, { width: `${(s.count / maxCount) * 100}%` }]} />
                </View>
                <Text style={styles.muted}>{formatPrice(s.revenue)} faturado</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, testID }: { label: string; value: number | string; testID: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} testID={testID}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: "row", alignItems: "center" },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  month: { flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, textTransform: "capitalize" },
  hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandSecondary },
  heroLabel: { color: colors.onBrandTertiary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  heroValue: { fontFamily: fonts.display, fontSize: 44, color: colors.brandPrimary, fontWeight: "700", marginTop: 4 },
  heroSub: { color: colors.onBrandTertiary, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "48.5%", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.brandPrimary, fontSize: 22, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  section: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, marginTop: spacing.md },
  muted: { color: colors.muted, fontSize: 12 },
  svcRow: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  rank: { fontFamily: fonts.display, fontSize: 24, color: colors.brandPrimary, width: 32 },
  svcTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  svcName: { flex: 1, color: colors.onSurface, fontWeight: "600" },
  svcCount: { color: colors.brandPrimary, fontWeight: "700" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
});
