import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Linking } from "react-native";

dayjs.locale("pt-br");

export const SALON = {
  name: "Martins Cabeleireiro",
  slogan: "Martins Cabeleireiro, produzindo beleza com qualidade.",
  address: "Rua Apolinário Cortes, 572 - Nova Ouro Preto, Ouro Preto do Oeste - RO",
  hours: "Segunda a Sábado, das 08:00 às 20:00",
  whatsapp: "69999640881",
  whatsappDisplay: "(69) 99964-0881",
};

export type Service = { id: string; name: string; price: number; duration: number; category: string };

export type Appointment = {
  id: string;
  service_id: string;
  service_name: string;
  price: number;
  duration: number;
  date: string;
  time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  notes: string;
  status: "agendado" | "concluido" | "cancelado";
  reminded: boolean;
  confirmed: boolean;
};

export type Client = { id: string; name: string; phone: string; source: string };

export const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} ${h > 1 ? "hrs" : "hr"}`;
  return `${h}h ${m} min`;
}

export function formatPhone(p: string) {
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
  return p;
}

export const formatDateLong = (d: string) => dayjs(d).format("dddd, DD [de] MMMM");
export const formatDateShort = (d: string) => dayjs(d).format("DD/MM/YYYY");

export function openWhatsApp(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  const url = `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  Linking.openURL(url);
}
