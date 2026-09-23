import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../firebase";
import type { ShopProfile, ShopUser, StaffPermissions, StaffRole } from "./types";

function shopDoc(shopId: string) {
  return doc(db, "shops", shopId);
}

function shopUsersCol(shopId: string) {
  return collection(db, "shops", shopId, "users");
}

export async function getShopProfile(shopId: string): Promise<ShopProfile> {
  const snap = await getDoc(shopDoc(shopId));
  const data = snap.data();
  return {
    id: shopId,
    name: (data?.name as string) ?? "Minny ONE",
    profileUrl: data?.profileUrl as string | undefined,
  };
}

export async function updateShopProfile(
  shopId: string,
  data: { name: string; profileUrl?: string }
): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    name: data.name,
    profileUrl: data.profileUrl ?? "",
    updatedAt: serverTimestamp(),
  });
}

export interface TableRosterEntry {
  label: string;
  zone?: string;
  seats?: number;
  // Whether THIS table charges the shop's service-charge % (see
  // getServiceChargeSettings) when its bill is closed. Master on/off for the
  // whole shop still lives in ServiceChargeSettings.enabled.
  serviceCharge?: boolean;
  // How many physical tables are pushed together to form this one roster
  // entry (e.g. tables 5+6 joined for a big group become one "5" entry with
  // physicalTables: 2). Informational only — undefined/1 means a single table.
  physicalTables?: number;
}

/** A table's short `label` is only unique WITHIN its zone (see TableForm.tsx's
 * duplicate check) — two zones can both have a "5". Everywhere a table needs
 * a single real-world identity (opening/reusing a TableSession, the QR link,
 * what prints on a kitchen ticket or bill), use this combined string instead
 * of the bare label, so "5" in two different zones can never collide into
 * the same session. */
export function tableDisplayLabel(label: string, zone?: string): string {
  return zone ? `${zone} ${label}` : label;
}

/** Identifies a roster entry by (zone, label) as one opaque route/URL
 * segment — used by TableForm.tsx's edit route and ManageTables.tsx's edit
 * links, since the bare label alone no longer uniquely identifies an entry. */
export function encodeEntryKey(zone: string | undefined, label: string): string {
  return encodeURIComponent(`${zone ?? ""}\u0000${label}`);
}
export function decodeEntryKey(key: string): { zone?: string; label: string } {
  const [zonePart, label] = decodeURIComponent(key).split("\u0000");
  return { zone: zonePart || undefined, label };
}

/** The shop's predefined tables (e.g. [{label:"1",zone:"ໃນຮ້ານ"}, ...]) — lets
 * "ເລືອກໂຕະ" show every table as a tile up front instead of staff typing a
 * label from scratch each time a customer sits down. */
export async function getTableRoster(shopId: string): Promise<TableRosterEntry[]> {
  const snap = await getDoc(shopDoc(shopId));
  const raw = snap.data()?.tableRoster as unknown[] | undefined;
  if (!raw) return [];
  // Back-compat: the first version of this field stored plain string labels.
  return raw.map((entry) => (typeof entry === "string" ? { label: entry } : (entry as TableRosterEntry)));
}

export async function setTableRoster(shopId: string, tables: TableRosterEntry[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    tableRoster: tables,
    updatedAt: serverTimestamp(),
  });
}

/** Named areas (e.g. ["ໃນຮ້ານ","ນອກຮ້ານ","VIP"]) used to group/filter tables. */
export async function getTableZones(shopId: string): Promise<string[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.tableZones as string[] | undefined) ?? [];
}

export async function setTableZones(shopId: string, zones: string[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    tableZones: zones,
    updatedAt: serverTimestamp(),
  });
}

export interface ServiceChargeSettings {
  enabled: boolean;
  percent: number;
}

/** Shop-wide service-charge master switch + percentage. Which tables actually
 * charge it is per-table (TableRosterEntry.serviceCharge). */
export async function getServiceChargeSettings(shopId: string): Promise<ServiceChargeSettings> {
  const snap = await getDoc(shopDoc(shopId));
  const sc = snap.data()?.serviceCharge as Partial<ServiceChargeSettings> | undefined;
  return { enabled: sc?.enabled ?? false, percent: sc?.percent ?? 0 };
}

export async function setServiceChargeSettings(shopId: string, settings: ServiceChargeSettings): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    serviceCharge: settings,
    updatedAt: serverTimestamp(),
  });
}

export interface ToppingEntry {
  name: string;
  // Extra charge for this topping, in kip. Undefined/0 = free add-on.
  price?: number;
}

/** Shop-wide topping/add-on options (e.g. extra shot, lemon, mint) staff can
 * offer alongside a menu item. Menu-configuration, so lives beside products
 * rather than table roster/zones. */
export async function getToppings(shopId: string): Promise<ToppingEntry[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.toppings as ToppingEntry[] | undefined) ?? [];
}

export async function setToppings(shopId: string, toppings: ToppingEntry[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    toppings,
    updatedAt: serverTimestamp(),
  });
}

/** Serving units (e.g. ["ຕຸກ","ຈອກ","ແກ້ວ"]) — how a menu item is measured or
 * sold. Menu-configuration, gated the same as toppings. */
export async function getUnits(shopId: string): Promise<string[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.units as string[] | undefined) ?? [];
}

export async function setUnits(shopId: string, units: string[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    units,
    updatedAt: serverTimestamp(),
  });
}

/** Food groups (e.g. ["ກຸ່ມເຄື່ອງດື່ມ","ກຸ່ມອາຫານ"]) — one level above
 * `categories` (shops/{shopId}/categories): each category can optionally be
 * tagged with the food group it belongs to (Category.foodGroup). */
export async function getFoodGroups(shopId: string): Promise<string[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.foodGroups as string[] | undefined) ?? [];
}

export async function setFoodGroups(shopId: string, foodGroups: string[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    foodGroups,
    updatedAt: serverTimestamp(),
  });
}

/** Portion/size options (e.g. ["ນ້ອຍ","ກາງ","ໃຫຍ່"]) — menu-configuration,
 * gated the same as toppings/units/foodGroups. */
export async function getSizes(shopId: string): Promise<string[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.sizes as string[] | undefined) ?? [];
}

export async function setSizes(shopId: string, sizes: string[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    sizes,
    updatedAt: serverTimestamp(),
  });
}

export type CurrencyCode = "LAK" | "THB" | "USD" | "CNY" | "JPY";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  LAK: "ລາວ (LAK)",
  THB: "ໄທ (THB)",
  USD: "ອາເມລິກາ (USD)",
  CNY: "ຈີນ (CNY)",
  JPY: "ຍີ່ປຸ່ນ (JPY)",
};

// Country flag shown next to each currency (ManageExchangeRates.tsx /
// CreateExchangeRate.tsx) — flags aren't in the Tabler icon set (outline,
// single-color icons can't represent multi-color flags), so these stay
// plain emoji.
export const CURRENCY_FLAGS: Record<CurrencyCode, string> = {
  LAK: "🇱🇦",
  THB: "🇹🇭",
  USD: "🇺🇸",
  CNY: "🇨🇳",
  JPY: "🇯🇵",
};

export const ALL_CURRENCIES: CurrencyCode[] = ["LAK", "THB", "USD", "CNY", "JPY"];

export interface ExchangeRate {
  currency: CurrencyCode;
  rate: number;
  enabled: boolean;
}

/** Foreign-currency exchange rates the shop accepts alongside LAK at
 * checkout. Money/checkout-related, so gated like serviceCharge (owner or
 * canTakeOrders) rather than canManageProducts. */
export async function getExchangeRates(shopId: string): Promise<ExchangeRate[]> {
  const snap = await getDoc(shopDoc(shopId));
  return (snap.data()?.exchangeRates as ExchangeRate[] | undefined) ?? [];
}

export async function setExchangeRates(shopId: string, rates: ExchangeRate[]): Promise<void> {
  await updateDoc(shopDoc(shopId), {
    exchangeRates: rates,
    updatedAt: serverTimestamp(),
  });
}

export async function getShopUsers(shopId: string): Promise<ShopUser[]> {
  const snap = await getDocs(shopUsersCol(shopId));
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
    const p = data.permissions as Partial<StaffPermissions> | undefined;
    return {
      id: d.id,
      email: data.email as string,
      role: data.role as "customer" | "staff",
      displayName: data.displayName as string | undefined,
      profileUrl: data.profileUrl as string | undefined,
      createdAt,
      permissions: p ? {
        canManageProducts: p.canManageProducts ?? false,
        canEditCartPrice: p.canEditCartPrice ?? false,
        canDeleteSales: p.canDeleteSales ?? false,
        canAddExpenses: p.canAddExpenses ?? false,
        canViewFinance: p.canViewFinance ?? false,
        canTakeOrders: p.canTakeOrders ?? false,
        canCook: p.canCook ?? false,
        canExpedite: p.canExpedite ?? false,
      } : undefined,
      staffRole: data.staffRole as StaffRole | undefined,
      zoneRestricted: data.zoneRestricted as boolean | undefined,
      allowedZones: data.allowedZones as string[] | undefined,
    };
  }).sort((a, b) => `${a.role}-${a.email}`.localeCompare(`${b.role}-${b.email}`));
}

export async function createStaffUser(
  shopId: string,
  data: {
    email: string; password: string; displayName?: string; permissions?: StaffPermissions;
    photoUrl?: string; staffRole?: StaffRole; zoneRestricted?: boolean; allowedZones?: string[];
  },
): Promise<string> {
  const email = data.email.trim().toLowerCase();

  // Create Firebase Auth user via REST API (doesn't affect current session)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: data.password, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "CREATE_USER_FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    if (code.startsWith("WEAK_PASSWORD")) throw new Error("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ");
    throw new Error(code);
  }

  const uid: string = json.localId;
  const displayName = data.displayName?.trim() ?? "";
  const now = serverTimestamp();
  const permissions: StaffPermissions = data.permissions ?? {
    canManageProducts: false,
    canEditCartPrice: false,
    canDeleteSales: false,
    canAddExpenses: false,
    canViewFinance: false,
    canTakeOrders: false,
    canCook: false,
    canExpedite: false,
  };

  // Firestore rejects `undefined` field values outright — only include the
  // optional extras when they actually have a value.
  const extra: Record<string, unknown> = {};
  if (data.photoUrl) extra.profileUrl = data.photoUrl;
  if (data.staffRole) extra.staffRole = data.staffRole;
  if (data.zoneRestricted) {
    extra.zoneRestricted = true;
    if (data.allowedZones?.length) extra.allowedZones = data.allowedZones;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { role: "staff", shopId, email, displayName, createdAt: now, permissions, ...extra });
  batch.set(doc(db, "shops", shopId, "users", uid), { role: "staff", email, displayName, createdAt: now, permissions, ...extra });
  await batch.commit();
  return uid;
}

export async function updateStaffUser(
  shopId: string,
  uid: string,
  data: { displayName: string; photoUrl?: string },
): Promise<void> {
  const displayName = data.displayName.trim();
  const now = serverTimestamp();
  const batch = writeBatch(db);
  // The top-level users/{uid} doc only lets the owner touch `displayName`
  // here (rules) — self-service profileUrl updates are a separate, owner-
  // uid-scoped branch, so an owner setting ANOTHER staffer's photo can only
  // land on the shop-scoped copy below (which is what the admin UI reads).
  batch.update(doc(db, "users", uid), { displayName, updatedAt: now });
  batch.update(doc(db, "shops", shopId, "users", uid), {
    displayName,
    updatedAt: now,
    ...(data.photoUrl !== undefined ? { profileUrl: data.photoUrl } : {}),
  });
  await batch.commit();
}

/** Self-service: lets the signed-in user (owner or staff) set their own profile photo. */
export async function updateMyProfilePhoto(
  shopId: string,
  uid: string,
  profileUrl: string,
): Promise<void> {
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { profileUrl, updatedAt: now });
  batch.update(doc(db, "shops", shopId, "users", uid), { profileUrl, updatedAt: now });
  await batch.commit();
}

// Change staff email: creates new Auth user, migrates Firestore, sends password-reset email.
// Old Auth account becomes an orphan — Firestore records removed so it can't access data.
export async function updateStaffEmail(
  shopId: string,
  oldUid: string,
  data: { newEmail: string; displayName: string; createdAt?: Date; photoUrl?: string },
): Promise<string> {
  const newEmail = data.newEmail.trim().toLowerCase();

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const tempPassword = Array.from(rand, b => chars[b % 62]).join("") + "Aa1!";

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: tempPassword, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    throw new Error(code);
  }
  const newUid: string = json.localId;

  const now = serverTimestamp();
  const photoExtra = data.photoUrl ? { profileUrl: data.photoUrl } : {};
  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUid), {
    role: "staff", shopId,
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
    ...photoExtra,
  });
  batch.set(doc(db, "shops", shopId, "users", newUid), {
    role: "staff",
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
    ...photoExtra,
  });
  batch.delete(doc(db, "users", oldUid));
  batch.delete(doc(db, "shops", shopId, "users", oldUid));
  await batch.commit();

  await sendPasswordResetEmail(auth, newEmail);
  return newUid;
}

export async function resetStaffPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Change the shop owner's own login email: creates a new Auth user, migrates
// the owner's Firestore docs to the new uid, sends a password-reset email.
// Caller must sign the user out afterwards — the old session's uid no longer
// maps to a users/{uid} doc.
export async function updateOwnerEmail(
  shopId: string,
  oldUid: string,
  newEmail: string,
): Promise<string> {
  const email = newEmail.trim().toLowerCase();

  const oldSnap = await getDoc(doc(db, "users", oldUid));
  const createdAt = oldSnap.data()?.createdAt as Timestamp | undefined;

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const tempPassword = Array.from(rand, b => chars[b % 62]).join("") + "Aa1!";

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: tempPassword, returnSecureToken: false }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const code: string = json.error?.message ?? "FAILED";
    if (code === "EMAIL_EXISTS") throw new Error("ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
    throw new Error(code);
  }
  const newUid: string = json.localId;
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUid), {
    role: "customer", shopId, email,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
  batch.set(doc(db, "shops", shopId, "users", newUid), {
    role: "customer", email,
    createdAt: createdAt ?? now,
    updatedAt: now,
  });
  batch.delete(doc(db, "users", oldUid));
  batch.delete(doc(db, "shops", shopId, "users", oldUid));
  await batch.commit();

  await sendPasswordResetEmail(auth, email);
  return newUid;
}

export async function deleteStaffUser(shopId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  batch.delete(doc(db, "shops", shopId, "users", uid));
  await batch.commit();
}

export async function updateStaffPermissions(
  shopId: string,
  uid: string,
  data: {
    permissions: StaffPermissions;
    staffRole?: StaffRole;
    zoneRestricted?: boolean;
    allowedZones?: string[];
  },
): Promise<void> {
  // Write only to the shop's subcollection — owner has write access here.
  // users/{uid} is protected so only the user themselves can update it.
  await updateDoc(doc(db, "shops", shopId, "users", uid), {
    permissions: data.permissions,
    staffRole: data.staffRole ? data.staffRole : deleteField(),
    zoneRestricted: !!data.zoneRestricted,
    allowedZones: data.zoneRestricted && data.allowedZones?.length ? data.allowedZones : deleteField(),
  });
}
