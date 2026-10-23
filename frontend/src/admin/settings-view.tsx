import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QrCard } from "@/src/admin/qr-card";
import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton } from "@/src/components/ui";
import { formatDateLong } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Block = { id: string; date: string; reason: string };

export function SettingsView() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const days = useMemo(() => Array.from({ length: 120 }, (_, i) => dayjs().add(i, "day")), []);
  const blocks = useQuery({ queryKey: ["blocked"], queryFn: () => api<Block[]>("/admin/blocked-days", { auth: true }) });
  const blockedSet = new Set((blocks.data ?? []).map((b) => b.date));

  const addBlock = async () => {
    if (!date) return;
    try {
      await api("/admin/blocked-days", { method: "POST", auth: true, body: { date, reason } });
      setDate(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["blocked"] });
      toast("Dia bloqueado na agenda", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const removeBlock = async (b: Block) => {
    await api(`/admin/blocked-days/${b.id}`, { method: "DELETE", auth: true }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["blocked"] });
    toast("Dia liberado", "success");
  };

  const changePw = async () => {
    try {
      await api("/auth/change-password", { method: "POST", auth: true, body: { current_password: curPw, new_password: newPw } });
      setCurPw("");
      setNewPw("");
      toast("Senha alterada com sucesso", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={40} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" testID="admin-settings-view">
      <QrCard />
      <Text style={styles.title}>Bloquear dias e feriados</Text>
      <Text style={styles.sub}>Domingos já ficam fechados automaticamente.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {days.map((d) => {
          const key = d.format("YYYY-MM-DD");
          const sel = key === date;
          const off = d.day() === 0 || blockedSet.has(key);
          return (
            <Pressable key={key} testID={`block-date-${key}`} disabled={off} onPress={() => setDate(key)} style={[styles.day, sel && styles.daySel, off && { opacity: 0.3 }]}>
              <Text style={styles.dayWeek}>{d.format("ddd").replace(".", "").toUpperCase()}</Text>
              <Text style={[styles.dayNum, sel && { color: colors.brandPrimary }]}>{d.format("DD")}</Text>
              <Text style={styles.dayWeek}>{d.format("MMM").replace(".", "")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.form}>
        <TextInput testID="block-reason-input" placeholder="Motivo (ex: Feriado, Folga)" placeholderTextColor={colors.muted} value={reason} onChangeText={setReason} style={styles.input} />
        <GoldButton testID="block-day-submit-button" title={date ? `Bloquear ${dayjs(date).format("DD/MM")}` : "Selecione um dia"} icon="ban-outline" disabled={!date} onPress={addBlock} />
      </View>
      <View style={styles.list}>
        {(blocks.data ?? []).length === 0 && <Text style={styles.sub}>Nenhum dia bloqueado.</Text>}
        {(blocks.data ?? []).map((b) => (
          <View key={b.id} style={styles.blockRow} testID={`blocked-day-${b.date}`}>
            <Ionicons name="ban-outline" size={18} color={colors.onError} />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockDate}>{formatDateLong(b.date)}</Text>
              {!!b.reason && <Text style={styles.blockReason}>{b.reason}</Text>}
            </View>
            <Pressable testID={`unblock-day-${b.date}`} onPress={() => removeBlock(b)} style={styles.iconBtn} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.title}>Alterar minha senha</Text>
      <View style={styles.form}>
        <TextInput testID="current-password-input" placeholder="Senha atual" placeholderTextColor={colors.muted} secureTextEntry value={curPw} onChangeText={setCurPw} style={styles.input} />
        <TextInput testID="new-password-input" placeholder="Nova senha (mín. 6 caracteres)" placeholderTextColor={colors.muted} secureTextEntry value={newPw} onChangeText={setNewPw} style={styles.input} />
        <GoldButton testID="change-password-submit-button" variant="outline" title="Salvar nova senha" disabled={!curPw || newPw.length < 6} onPress={changePw} />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sub: { color: colors.muted, fontSize: 13, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.md },
  hRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  day: { width: 60, flexShrink: 0, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  daySel: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  dayWeek: { color: colors.muted, fontSize: 11 },
  dayNum: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display, fontWeight: "700" },
  form: { padding: spacing.lg, gap: spacing.md },
  input: { height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, paddingHorizontal: spacing.lg, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  blockRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  blockDate: { color: colors.onSurface, fontWeight: "600", textTransform: "capitalize" },
  blockReason: { color: colors.muted, fontSize: 13 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
