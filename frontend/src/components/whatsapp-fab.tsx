import Ionicons from "@react-native-vector-icons/ionicons";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openWhatsApp, SALON } from "@/src/constants";
import { colors } from "@/src/theme";

export function WhatsAppFab({ extraBottom = 0 }: { extraBottom?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      testID="whatsapp-fab"
      accessibilityLabel="Falar no WhatsApp"
      onPress={() => openWhatsApp(SALON.whatsapp, "Olá! Vim pelo aplicativo Martins Cabeleireiro.")}
      style={({ pressed }) => [
        styles.fab,
        { bottom: insets.bottom + 16 + extraBottom, transform: [{ scale: pressed ? 0.92 : 1 }] },
      ]}
    >
      <Ionicons name="logo-whatsapp" size={30} color={colors.onWhatsapp} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.whatsapp,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
