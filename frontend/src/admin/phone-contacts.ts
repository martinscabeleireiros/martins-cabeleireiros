import * as Contacts from "expo-contacts/legacy";

export type PhoneContact = { name: string; phone: string };
export type ContactsResult =
  | { kind: "ok"; contacts: PhoneContact[] }
  | { kind: "need-explain" }
  | { kind: "blocked" }
  | { kind: "unsupported" }
  | { kind: "empty" };

// Native (Android / iOS): read the device address book with permission handling.
export async function importPhoneContacts(allowRequest: boolean): Promise<ContactsResult> {
  let perm = await Contacts.getPermissionsAsync();
  if (perm.status !== "granted") {
    if (!perm.canAskAgain) return { kind: "blocked" };
    if (!allowRequest) return { kind: "need-explain" };
    perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== "granted") return perm.canAskAgain ? { kind: "need-explain" } : { kind: "blocked" };
  }
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
  const contacts: PhoneContact[] = [];
  for (const c of data) {
    const num = c.phoneNumbers?.find((p) => p.number)?.number;
    if (num) contacts.push({ name: c.name || num, phone: num });
  }
  return contacts.length ? { kind: "ok", contacts } : { kind: "empty" };
}
