import Ionicons from "@react-native-vector-icons/ionicons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, goClient } from "@/src/admin/appointment-card";
import { importPhoneContacts, ContactsResult } from "@/src/admin/phone-contacts";
import { API, api, authHeaders, parse } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { GoldButton } from "@/src/components/ui";
import { Client, formatPhone } from "@/src/constants";
import { uploadForm } from "@/src/utils/upload";
import { colors, radius, spacing } from "@/src/theme";

const PAGE = 50;
type ImportResult = { read: number; added: number; skipped: number };

export function ClientsView() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "add" | "perm" | "settings">(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const q = useInfiniteQuery({
    queryKey: ["admin-clients", term],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<{ total: number; items: Client[] }>(`/admin/clients?q=${encodeURIComponent(term)}&skip=${pageParam}&limit=${PAGE}`, { auth: true }),
    getNextPageParam: (last, all) => (all.length * PAGE < last.total ? all.length * PAGE : undefined),
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  const done = (r: ImportResult) => {
    qc.invalidateQueries({ queryKey: ["admin-clients"] });
    toast(`${r.added} novo(s) cliente(s) importado(s). ${r.skipped} já existiam/ignorados.`, "success");
  };

  const importVcf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["text/vcard", "text/x-vcard", "text/directory", "*/*"], copyToCacheDirectory: true });
    if (res.canceled) return;
    const f = res.assets[0];
    setBusy(true);
    try {
      const r = await uploadForm(`${API}/admin/clients/import-vcf`, {
        files: { file: { uri: f.uri, name: f.name || "contatos.vcf", mimeType: f.mimeType || "text/vcard" } },
        headers: await authHeaders(),
      });
      done(await parse<ImportResult>(r));
    } catch (e: any) {
      toast(e.message || "Erro ao importar arquivo", "error");
    } finally {
      setBusy(false);
    }
  };

  const runPhoneImport = async (allowRequest: boolean) => {
    setSheet(null);
    setBusy(true);
    try {
      const r: ContactsResult = await importPhoneContacts(allowRequest);
      if (r.kind === "need-explain") setSheet("perm");
      else if (r.kind === "blocked") setSheet("settings");
      else if (r.kind === "unsupported") toast("Seu navegador não suporta importar contatos. Use o arquivo .vcf.", "error");
      else if (r.kind === "empty") toast("Nenhum contato selecionado.", "info");
      else done(await api<ImportResult>("/admin/clients/import-list", { method: "POST", auth: true, body: { contacts: r.contacts } }));
    } catch (e: any) {
      toast(e.message || "Erro ao importar contatos", "error");
    } finally {
      setBusy(false);
    }
  };

  const addClient = async () => {
    try {
      await api("/admin/clients", { method: "POST", auth: true, body: { name: newName, phone: newPhone } });
      setSheet(null);
      setNewName("");
      setNewPhone("");
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      toast("Cliente cadastrado", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <View style={{ flex: 1 }} testID="admin-clients-view">
      <View style={styles.top}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="clients-search-input"
            placeholder="Buscar por nome ou telefone"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.actionsRow}>
          <ActionBtn testID="clients-import-vcf-button" icon="document-attach-outline" label="Arquivo .vcf" onPress={importVcf} />
          <ActionBtn testID="clients-import-phone-button" icon="phone-portrait-outline" label="Do celular" onPress={() => runPhoneImport(false)} />
          <ActionBtn testID="clients-add-button" icon="person-add-outline" label="Novo" onPress={() => setSheet("add")} />
        </View>
        <Text style={styles.count} testID="clients-total">{busy ? "Importando..." : `${total} cliente(s)`}</Text>
      </View>
      {q.isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon="people-outline" text="Nenhum cliente encontrado. Importe ou cadastre manualmente." testID="clients-empty" />}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.brandPrimary} /> : null}
          renderItem={({ item }) => (
            <Pressable testID={`client-row-${item.id}`} onPress={() => goClient(item.id)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name[0] || "?").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.phone}>{formatPhone(item.phone)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="clients-sheet">
          <View style={styles.handle} />
          {sheet === "add" && (
            <>
              <Text style={styles.sheetTitle}>Novo cliente</Text>
              <TextInput testID="new-client-name-input" placeholder="Nome" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} style={styles.input} />
              <TextInput testID="new-client-phone-input" placeholder="WhatsApp com DDD" placeholderTextColor={colors.muted} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" style={styles.input} />
              <GoldButton testID="new-client-save-button" title="Salvar cliente" onPress={addClient} disabled={!newName || !newPhone} />
            </>
          )}
          {sheet === "perm" && (
            <>
              <Text style={styles.sheetTitle}>Importar contatos do celular</Text>
              <Text style={styles.sheetText}>Permita o acesso aos contatos para cadastrar seus clientes automaticamente na base da barbearia.</Text>
              <GoldButton testID="contacts-permission-allow-button" title="Permitir acesso" onPress={() => runPhoneImport(true)} />
              <GoldButton testID="contacts-permission-cancel-button" variant="outline" title="Agora não" onPress={() => setSheet(null)} />
            </>
          )}
          {sheet === "settings" && (
            <>
              <Text style={styles.sheetTitle}>Acesso aos contatos bloqueado</Text>
              <Text style={styles.sheetText}>Para importar, ative a permissão de Contatos nas configurações do aplicativo. Você também pode usar o arquivo .vcf.</Text>
              <GoldButton testID="contacts-open-settings-button" title="Abrir configurações" onPress={() => { setSheet(null); Linking.openSettings(); }} />
              <GoldButton testID="contacts-settings-cancel-button" variant="outline" title="Fechar" onPress={() => setSheet(null)} />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ActionBtn({ testID, icon, label, onPress }: { testID: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15, height: 48 },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary,
  },
  actionText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  count: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 16 },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  phone: { color: colors.muted, fontSize: 13, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surfaceSecondary, padding: spacing.xl, gap: spacing.md,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: colors.borderStrong,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  sheetText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  input: {
    height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface,
    paddingHorizontal: spacing.lg, fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
});

void Platform;
