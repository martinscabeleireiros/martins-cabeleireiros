import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton } from "@/src/components/ui";
import { Appointment } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

export function RescheduleSheet({ appt, onClose, onDone }: { appt: Appointment | null; onClose: () => void; onDone: (a: Appointment) => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const days = useMemo(() => Array.from({ length: 60 }, (_, i) => dayjs().add(i, "day")), []);
  const curDate = date ?? appt?.date ?? "";

  const slots = useQuery({
    queryKey: ["slots-resched", curDate, appt?.id],
    queryFn: () => api<{ open: boolean; reason: string; slots: string[] }>(`/slots?date=${curDate}&service_id=${appt!.service_id}&exclude_id=${appt!.id}`),
    enabled: !!appt && !!curDate,
  });

  const close = () => { setDate(null); setTime(null); onClose(); };

  const save = async () => {
    if (!appt || !time) return;
    setSaving(true);
    try {
      const a = await api<Appointment>(`/admin/appointments/${appt.id}/reschedule`, { method: "POST", auth: true, body: { date: curDate, time } });
      close();
      onDone(a);
    } catch (e: any) {
      toast(e.message, "error");
      slots.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!appt} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="reschedule-sheet">
        <View style={styles.handle} />
        <Text style={styles.title}>Remarcar horário</Text>
        <Text style={styles.sub}>{appt?.client_name} • {appt?.service_name} (atual: {appt && dayjs(appt.date).format("DD/MM")} às {appt?.time})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {days.map((d) => {
            const key = d.format("YYYY-MM-DD");
            const sel = key === curDate;
            const sunday = d.day() === 0;
            return (
              <Pressable key={key} testID={`reschedule-date-${key}`} disabled={sunday} onPress={() => { setDate(key); setTime(null); }} style={[styles.day, sel && styles.sel, sunday && { opacity: 0.3 }]}>
                <Text style={styles.dayWeek}>{d.format("ddd").replace(".", "").toUpperCase()}</Text>
                <Text style={[styles.dayNum, sel && { color: colors.brandPrimary }]}>{d.format("DD")}</Text>
                <Text style={styles.dayWeek}>{d.format("MMM").replace(".", "")}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={styles.slotWrap}>
          {slots.isFetching && <ActivityIndicator color={colors.brandPrimary} />}
          {!slots.isFetching && slots.data && !slots.data.open && <Text style={styles.sub}>{slots.data.reason}</Text>}
          {!slots.isFetching && slots.data?.open && slots.data.slots.length === 0 && <Text style={styles.sub}>Sem horários livres nesta data.</Text>}
          {!slots.isFetching && slots.data?.slots.map((t) => {
            const sel = t === time;
            return (
              <Pressable key={t} testID={`reschedule-slot-${t}`} onPress={() => setTime(t)} style={[styles.slot, sel && styles.slotSel]}>
                <Text style={[styles.slotText, sel && { color: colors.onBrandPrimary }]}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <GoldButton testID="reschedule-save-button" title={time ? `Remarcar para ${dayjs(curDate).format("DD/MM")} às ${time}` : "Escolha o novo horário"} disabled={!time} loading={saving} onPress={save} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.xl, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: colors.borderStrong },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl },
  sub: { color: colors.muted, fontSize: 13, paddingHorizontal: spacing.xl },
  hRow: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  day: { width: 60, flexShrink: 0, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  sel: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  dayWeek: { color: colors.muted, fontSize: 11 },
  dayNum: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display, fontWeight: "700" },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.xl },
  slot: { width: "22.5%", height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary },
  slotSel: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  slotText: { color: colors.onSurface, fontWeight: "600" },
});
