import Ionicons from "@react-native-vector-icons/ionicons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { AgendaView } from "@/src/admin/agenda-view";
import { ClientsView } from "@/src/admin/clients-view";
import { RemindersView } from "@/src/admin/reminders-view";
import { ReportView } from "@/src/admin/report-view";
import { SettingsView } from "@/src/admin/settings-view";
import { api, logout, TOKEN_KEY, USER_KEY } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton, ScreenHeader } from "@/src/components/ui";
import { storage } from "@/src/utils/storage";
import { colors, fonts, radius, spacing } from "@/src/theme";

const TABS = [
  { key: "agenda", label: "Agenda", icon: "calendar-outline" },
  { key: "lembretes", label: "Lembretes", icon: "notifications-outline" },
  { key: "clientes", label: "Clientes", icon: "people-outline" },
  { key: "resumo", label: "Resumo", icon: "stats-chart-outline" },
  { key: "ajustes", label: "Ajustes", icon: "settings-outline" },
] as const;

export default function Admin() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await api<{ display_name: string }>("/auth/me", { auth: true });
        setAdminName(me.display_name);
        setState("in");
      } catch {
        setState("out");
      }
    })();
  }, []);

  if (state === "loading") {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (state === "out") return <Login onDone={(n) => { setAdminName(n); setState("in"); }} />;
  return <Dashboard name={adminName} onLogout={async () => { await logout(); setState("out"); }} />;
}

function Login({ onDone }: { onDone: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const r = await api<{ access_token: string; user: { display_name: string } }>("/auth/login", {
        method: "POST",
        body: { username: username.trim().toLowerCase(), password },
      });
      await storage.secureSet(TOKEN_KEY, r.access_token);
      await storage.secureSet(USER_KEY, r.user.display_name);
      toast(`Bem-vindo(a), ${r.user.display_name}!`, "success");
      onDone(r.user.display_name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="admin-login-screen">
      <ScreenHeader title="Painel Admin" />
      <KeyboardAwareScrollView bottomOffset={40} contentContainerStyle={[styles.loginWrap, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Image source={require("../../assets/images/logo.jpg")} style={styles.loginLogo} contentFit="cover" />
        <Text style={styles.loginTitle}>Acesso restrito</Text>
        <Text style={styles.loginSub}>Entre com seu usuário e senha de administrador.</Text>
        <TextInput
          testID="admin-username-input"
          placeholder="Usuário"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        <TextInput
          testID="admin-password-input"
          placeholder="Senha"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          style={styles.input}
        />
        {!!error && <Text style={styles.error} testID="admin-login-error">{error}</Text>}
        <GoldButton testID="admin-login-submit-button" title="Entrar" loading={loading} disabled={!username || !password} onPress={submit} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Dashboard({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("agenda");
  const qc = useQueryClient();
  return (
    <View style={styles.root} testID="admin-dashboard">
      <ScreenHeader
        title={`Olá, ${name}`}
        right={
          <Pressable testID="admin-logout-button" onPress={() => { qc.clear(); onLogout(); }} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={colors.brandPrimary} />
          </Pressable>
        }
      />
      <View style={styles.tabRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => {
            const sel = t.key === tab;
            return (
              <Pressable key={t.key} testID={`admin-tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.chip, sel && styles.chipSel]}>
                <Ionicons name={t.icon} size={16} color={sel ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.chipText, sel && { color: colors.onBrandPrimary }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={{ flex: 1 }}>
        {tab === "agenda" && <AgendaView />}
        {tab === "lembretes" && <RemindersView />}
        {tab === "clientes" && <ClientsView />}
        {tab === "resumo" && <ReportView />}
        {tab === "ajustes" && <SettingsView />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  loginWrap: { padding: spacing.xl, gap: spacing.md },
  loginLogo: { width: 160, height: 120, borderRadius: radius.md, alignSelf: "center" },
  loginTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.onSurface, textAlign: "center", marginTop: spacing.md },
  loginSub: { color: colors.muted, textAlign: "center", marginBottom: spacing.md },
  input: {
    height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface,
    paddingHorizontal: spacing.lg, fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
  error: { color: colors.onError, textAlign: "center" },
  tabRowWrap: { height: 56, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  tabRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  chipSel: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: 14 },
});
