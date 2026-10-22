import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, getToken } from "@/src/api";
import { Client, formatPhone } from "@/src/constants";
import { colors, radius, spacing } from "@/src/theme";

// Name field with autocomplete from the client base. Suggestions only appear when an
// admin is logged in (client list is private); everyone else gets a plain input.
export function ClientAutocomplete({
  name, onChangeName, onSelect,
}: {
  name: string;
  onChangeName: (v: string) => void;
  onSelect: (c: Client) => void;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const admin = useQuery({
    queryKey: ["is-admin"],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => ((await getToken()) ? !!(await api("/auth/me", { auth: true }).catch(() => null)) : false),
  });

  useEffect(() => {
    const t = setTimeout(() => setTerm(name.trim()), 300);
    return () => clearTimeout(t);
  }, [name]);

  const enabled = !!admin.data && open && term.length >= 2;
  const q = useQuery({
    queryKey: ["client-suggest", term],
    queryFn: () => api<{ items: Client[] }>(`/admin/clients?q=${encodeURIComponent(term)}&limit=6`, { auth: true }),
    enabled,
  });
  const items = q.data?.items ?? [];

  return (
    <View>
      <View style={styles.inputWrap}>
        {admin.data ? <Ionicons name="search" size={18} color={colors.muted} /> : null}
        <TextInput
          testID="booking-name-input"
          placeholder={admin.data ? "Nome do cliente (buscar ou digitar novo)" : "Seu nome"}
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={(v) => { onChangeName(v); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          style={styles.input}
          autoCorrect={false}
        />
        {enabled && q.isFetching ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : null}
      </View>
      {enabled && !q.isFetching && (
        <View style={styles.list} testID="client-suggestions">
          {items.map((c) => (
            <Pressable
              key={c.id}
              testID={`client-suggestion-${c.id}`}
              onPress={() => { onSelect(c); setOpen(false); }}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceTertiary }]}
            >
              <Ionicons name="person-circle-outline" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.itemPhone}>{formatPhone(c.phone)}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable testID="client-suggestion-new" onPress={() => setOpen(false)} style={styles.item}>
            <Ionicons name="person-add-outline" size={20} color={colors.muted} />
            <Text style={styles.newText} numberOfLines={1}>
              {items.length ? `Novo cliente: “${name.trim()}”` : `Nenhum cliente encontrado — cadastrar “${name.trim()}”`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 52, borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, height: 52, color: colors.onSurface, fontSize: 16 },
  list: {
    marginTop: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary, overflow: "hidden",
  },
  item: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  itemName: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  itemPhone: { color: colors.muted, fontSize: 13 },
  newText: { flex: 1, color: colors.muted, fontSize: 14 },
});
