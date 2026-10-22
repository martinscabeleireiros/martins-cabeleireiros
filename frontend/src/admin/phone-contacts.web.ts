export type PhoneContact = { name: string; phone: string };
export type ContactsResult =
  | { kind: "ok"; contacts: PhoneContact[] }
  | { kind: "need-explain" }
  | { kind: "blocked" }
  | { kind: "unsupported" }
  | { kind: "empty" };

// Web: Chrome on Android exposes the Contact Picker API (navigator.contacts.select).
export async function importPhoneContacts(_allowRequest: boolean): Promise<ContactsResult> {
  const nav = navigator as any;
  if (!nav.contacts?.select) return { kind: "unsupported" };
  const picked: { name?: string[]; tel?: string[] }[] = await nav.contacts.select(["name", "tel"], { multiple: true });
  const contacts = picked
    .filter((c) => c.tel?.length)
    .map((c) => ({ name: c.name?.[0] || c.tel![0], phone: c.tel![0] }));
  return contacts.length ? { kind: "ok", contacts } : { kind: "empty" };
}
