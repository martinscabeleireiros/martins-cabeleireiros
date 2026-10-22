import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton, ScreenHeader } from "@/src/components/ui";
import { Appointment, formatDateLong, formatDuration, formatPrice, openWhatsApp, SALON, Service } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

const tap = () => Platform.OS !== "web" && Haptics.selectionAsync();

export default function Booking() {
  const params = useLocalSearchParams<{ service?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [serviceId, setServiceId] = useState<string | undefined>(params.service);
  const [date, setDate] = useState(() => {
    let d = dayjs().hour() >= 19 ? dayjs().add(1, "day") : dayjs();
    if (d.day() === 0) d = d.add(1, "day");
    return d.format("YYYY-MM-DD");
  });
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Appointment | null>(null);

  const days = useMemo(() => Array.from({ length: 45 }, (_, i) => dayjs().add(i, "day")), []);
  const services = useQuery({ queryKey: ["services"], queryFn: () => api<Service[]>("/services") });
  const service = services.data?.find((s) => s.id === serviceId);
  const slots = useQuery({
    queryKey: ["slots", date, serviceId],
    queryFn: () => api<{ open: boolean; reason: string; slots: string[] }>(`/slots?date=${date}&service_id=${serviceId}`),
    enabled: !!serviceId,
  });

  const confirmText = (a: Appointment) =>
    `Olá! Gostaria de confirmar meu agendamento no ${SALON.name}:\n\n` +
    `• Serviço: ${a.service_name}\n• Data: ${formatDateLong(a.date)}\n• Horário: ${a.time} às ${a.end_time}\n` +
    `• Valor: ${formatPrice(a.price)}\n• Nome: ${a.client_name}`;

  const submit = async () => {
    if (!service || !time) return;
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      toast("Informe seu nome e WhatsApp com DDD.", "error");
      return;
    }
    setSaving(true);
    try {
      const a = await api<Appointment>("/appointments", {
        method: "POST",
        body: { service_id: service.id, date, time, client_name: name, client_phone: phone },
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(a);
      openWhatsApp(SALON.whatsapp, confirmText(a));
    } catch (e: any) {
      toast(e.message, "error");
      slots.refetch();
      setTime(null);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.root, styles.doneWrap, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]} testID="booking-success">
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={44} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.doneTitle}>Agendamento realizado!</Text>
        <Text style={styles.doneText}>{done.service_name}</Text>
        <Text style={styles.doneText}>{formatDateLong(done.date)} • {done.time} às {done.end_time}</Text>
        <Text style={styles.doneMuted}>Envie a mensagem no WhatsApp para confirmar seu horário.</Text>
        <View style={{ width: "100%", gap: spacing.md, marginTop: spacing.xl }}>
          <GoldButton testID="booking-whatsapp-confirm-button" icon="logo-whatsapp" title="Confirmar no WhatsApp" onPress={() => openWhatsApp(SALON.whatsapp, confirmText(done))} />
          <GoldButton testID="booking-back-home-button" variant="outline" title="Voltar ao início" onPress={() => router.replace("/")} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="booking-screen">
      <ScreenHeader title="Agendar horário" />
      <KeyboardAwareScrollView bottomOffset={120} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <Text style={styles.step}>1. Escolha o serviço</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {services.data?.map((s) => {
            const sel = s.id === serviceId;
            return (
              <Pressable
                key={s.id}
                testID={`booking-service-${s.id}`}
                onPress={() => { tap(); setServiceId(s.id); setTime(null); }}
                style={[styles.serviceCard, sel && styles.selected]}
              >
                <Text style={[styles.serviceName, sel && { color: colors.brandPrimary }]} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.serviceMeta}>{formatDuration(s.duration)}</Text>
                <Text style={styles.servicePrice}>{formatPrice(s.price)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.step}>2. Escolha a data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
          {days.map((d) => {
            const key = d.format("YYYY-MM-DD");
            const sel = key === date;
            const sunday = d.day() === 0;
            return (
              <Pressable
                key={key}
                testID={`booking-date-${key}`}
                disabled={sunday}
                onPress={() => { tap(); setDate(key); setTime(null); }}
                style={[styles.dayCard, sel && styles.selected, sunday && { opacity: 0.3 }]}
              >
                <Text style={styles.dayWeek}>{d.format("ddd").replace(".", "").toUpperCase()}</Text>
                <Text style={[styles.dayNum, sel && { color: colors.brandPrimary }]}>{d.format("DD")}</Text>
                <Text style={styles.dayWeek}>{d.format("MMM").replace(".", "")}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.step}>3. Escolha o horário</Text>
        <View style={styles.slotWrap}>
          {!serviceId && <Text style={styles.muted}>Selecione um serviço para ver os horários.</Text>}
          {slots.isFetching && <ActivityIndicator color={colors.brandPrimary} />}
          {slots.data && !slots.isFetching && !slots.data.open && (
            <Text style={styles.muted} testID="booking-closed-message">{slots.data.reason}</Text>
          )}
          {slots.data && !slots.isFetching && slots.data.open && slots.data.slots.length === 0 && (
            <Text style={styles.muted} testID="booking-no-slots">Sem horários disponíveis nesta data. Escolha outro dia.</Text>
          )}
          {!slots.isFetching && slots.data?.slots.map((t) => {
            const sel = t === time;
            return (
              <Pressable key={t} testID={`booking-slot-${t}`} onPress={() => { tap(); setTime(t); }} style={[styles.slot, sel && styles.slotSel]}>
                <Text style={[styles.slotText, sel && { color: colors.onBrandPrimary }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.step}>4. Seus dados</Text>
        <View style={styles.form}>
          <TextInput
            testID="booking-name-input"
            placeholder="Seu nome"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            style={styles.input}
            returnKeyType="next"
          />
          <TextInput
            testID="booking-phone-input"
            placeholder="WhatsApp com DDD (ex: 69 99999-9999)"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {service && time ? (
          <Text style={styles.summary} testID="booking-summary" numberOfLines={1}>
            {service.name} • {dayjs(date).format("DD/MM")} • {time} • {formatPrice(service.price)}
          </Text>
        ) : null}
        <GoldButton testID="booking-confirm-button" title="Confirmar agendamento" icon="logo-whatsapp" disabled={!service || !time} loading={saving} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  step: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  hRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  serviceCard: {
    width: 140, flexShrink: 0, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  selected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  serviceName: { color: colors.onSurface, fontWeight: "600", fontSize: 14, minHeight: 36 },
  serviceMeta: { color: colors.muted, fontSize: 12 },
  servicePrice: { color: colors.brandPrimary, fontFamily: fonts.display, fontSize: 20, fontWeight: "700" },
  dayCard: {
    width: 64, flexShrink: 0, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center",
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  dayWeek: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
  dayNum: { color: colors.onSurface, fontSize: 24, fontFamily: fonts.display, fontWeight: "700", marginVertical: 2 },
  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg },
  slot: {
    width: "22.8%", height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary,
  },
  slotSel: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  slotText: { color: colors.onSurface, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  form: { paddingHorizontal: spacing.lg, gap: spacing.md },
  input: {
    height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface,
    paddingHorizontal: spacing.lg, fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.scrim, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  summary: { color: colors.onBrandTertiary, textAlign: "center", fontSize: 13 },
  doneWrap: { alignItems: "center", paddingHorizontal: spacing.xl },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md, textAlign: "center" },
  doneText: { color: colors.onSurfaceSecondary, fontSize: 16, textAlign: "center", marginTop: 4, textTransform: "capitalize" },
  doneMuted: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: spacing.lg },
});
