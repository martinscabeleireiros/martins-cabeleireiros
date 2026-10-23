import { Image } from "expo-image";
import * as Print from "expo-print";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { API } from "@/src/api";
import { GoldButton } from "@/src/components/ui";
import { SALON } from "@/src/constants";
import { colors, fonts, radius, spacing } from "@/src/theme";

const OPTIONS = {
  app: { label: "Link de agendamento", data: process.env.EXPO_PUBLIC_BOOKING_URL as string, caption: "Escaneie e agende seu horário" },
  whats: { label: "WhatsApp", data: `https://wa.me/55${SALON.whatsapp}?text=${encodeURIComponent("Olá! Quero agendar um horário.")}`, caption: "Escaneie e agende pelo WhatsApp" },
};

export function QrCard() {
  const [kind, setKind] = useState<keyof typeof OPTIONS>("app");
  const opt = OPTIONS[kind];
  const qrUrl = `${API}/qr?data=${encodeURIComponent(opt.data)}`;

  const print = async () => {
    const html = `<html><head><meta charset="utf-8"/><style>
      body{font-family:Georgia,serif;text-align:center;padding:40px;color:#000}
      h1{font-size:40px;margin:0 0 6px} p{font-size:18px;margin:4px 0} img{width:380px;height:380px;margin:24px 0}
      .gold{color:#917B46;font-style:italic}
    </style></head><body>
      <h1>${SALON.name}</h1><p class="gold">${SALON.slogan}</p>
      <img src="${qrUrl}" onload="window.__qrReady=true"/>
      <p style="font-size:26px;font-weight:bold">${opt.caption}</p>
      <p>${SALON.hours}</p><p>WhatsApp ${SALON.whatsappDisplay}</p><p>${SALON.address}</p>
    </body></html>`;
    if (Platform.OS === "web") {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      const img = w.document.querySelector("img");
      img?.addEventListener("load", () => w.print());
      return;
    }
    await Print.printAsync({ html });
  };

  return (
    <View style={styles.card} testID="qr-card">
      <Text style={styles.title}>QR Code do balcão</Text>
      <View style={styles.toggle}>
        {(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => (
          <Pressable key={k} testID={`qr-option-${k}`} onPress={() => setKind(k)} style={[styles.opt, kind === k && styles.optSel]}>
            <Text style={[styles.optText, kind === k && { color: colors.onBrandPrimary }]}>{OPTIONS[k].label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.qrWrap}>
        <Image source={{ uri: qrUrl }} style={styles.qr} contentFit="contain" testID="qr-image" />
      </View>
      <Text style={styles.caption}>{opt.caption}</Text>
      <Text style={styles.link} numberOfLines={2} testID="qr-link">{opt.data}</Text>
      {kind === "app" && <Text style={styles.hint}>O link de agendamento é o da prévia, que é temporário. Para um QR permanente, use a opção WhatsApp.</Text>}
      <GoldButton testID="qr-print-button" title="Imprimir QR Code" icon="print-outline" onPress={print} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: spacing.lg, marginBottom: 0, padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  toggle: { flexDirection: "row", gap: spacing.sm },
  opt: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  optSel: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  optText: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  qrWrap: { alignSelf: "center", padding: spacing.md, backgroundColor: colors.onSurface, borderRadius: radius.md },
  qr: { width: 200, height: 200 },
  caption: { color: colors.onSurface, textAlign: "center", fontWeight: "600" },
  link: { color: colors.muted, textAlign: "center", fontSize: 12 },
  hint: { color: colors.onWarning, fontSize: 12, textAlign: "center" },
});
