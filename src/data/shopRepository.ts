import {
  collection,
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
import type { ShopProfile, ShopUser, StaffPermissions } from "./types";

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
    };
  }).sort((a, b) => `${a.role}-${a.email}`.localeCompare(`${b.role}-${b.email}`));
}

export async function createStaffUser(
  shopId: string,
  data: { email: string; password: string; displayName?: string; permissions?: StaffPermissions },
): Promise<void> {
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

  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid), { role: "staff", shopId, email, displayName, createdAt: now, permissions });
  batch.set(doc(db, "shops", shopId, "users", uid), { role: "staff", email, displayName, createdAt: now, permissions });
  await batch.commit();
}

export async function updateStaffUser(
  shopId: string,
  uid: string,
  data: { displayName: string },
): Promise<void> {
  const displayName = data.displayName.trim();
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), { displayName, updatedAt: now });
  batch.update(doc(db, "shops", shopId, "users", uid), { displayName, updatedAt: now });
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
  data: { newEmail: string; displayName: string; createdAt?: Date },
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
  const batch = writeBatch(db);
  batch.set(doc(db, "users", newUid), {
    role: "staff", shopId,
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
  });
  batch.set(doc(db, "shops", shopId, "users", newUid), {
    role: "staff",
    email: newEmail,
    displayName: data.displayName,
    createdAt: data.createdAt ? Timestamp.fromDate(data.createdAt) : now,
    updatedAt: now,
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
  permissions: StaffPermissions,
): Promise<void> {
  // Write only to the shop's subcollection — owner has write access here.
  // users/{uid} is protected so only the user themselves can update it.
  await updateDoc(doc(db, "shops", shopId, "users", uid), { permissions });
}
