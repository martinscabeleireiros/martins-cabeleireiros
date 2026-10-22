// Adds manifest + iOS meta tags to <head> and registers the service worker so the
// mobile browser offers "Instalar aplicativo" / "Adicionar à tela inicial".
function addTag(tag: "link" | "meta", attrs: Record<string, string>) {
  const key = tag === "link" ? `link[rel="${attrs.rel}"]` : `meta[name="${attrs.name}"]`;
  if (document.head.querySelector(key)) return;
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  document.head.appendChild(el);
}

export function setupPwa() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = "pt-BR";
  document.title = "Martins Cabeleireiro";
  addTag("link", { rel: "manifest", href: "/manifest.json" });
  addTag("link", { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" });
  addTag("meta", { name: "theme-color", content: "#050404" });
  addTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  addTag("meta", { name: "mobile-web-app-capable", content: "yes" });
  addTag("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  addTag("meta", { name: "apple-mobile-web-app-title", content: "Martins" });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}
