import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { TableSession } from "./types";

function sessionsCol(shopId: string) {
  return collection(db, "shops", shopId, "tableSessions");
}

function fromDoc(d: import("firebase/firestore").QueryDocumentSnapshot): TableSession {
  const data = d.data();
  return {
    id: d.id,
    code: data.code,
    tableLabel: data.tableLabel,
    status: data.status,
    createdAt: (data.createdAt as Timestamp).toDate(),
    closedAt: data.closedAt instanceof Timestamp ? data.closedAt.toDate() : undefined,
  };
}

/** Reuses an already-open session for this table (so a staff round and an
 * already-scanning customer land in the same tab); otherwise opens a new one
 * with a fresh random code for the QR link. */
export async function getOrCreateOpenSession(shopId: string, tableLabel: string): Promise<TableSession> {
  const q = query(sessionsCol(shopId), where("tableLabel", "==", tableLabel), where("status", "==", "open"));
  const snap = await getDocs(q);
  if (!snap.empty) return fromDoc(snap.docs[0]);

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const ref = await addDoc(sessionsCol(shopId), {
    code,
    tableLabel,
    status: "open",
    createdAt: Timestamp.now(),
  });
  return { id: ref.id, code, tableLabel, status: "open", createdAt: new Date() };
}

/** Resolves a scanned QR code to its session; null if unknown or already closed. */
export async function getSessionByCode(shopId: string, code: string): Promise<TableSession | null> {
  const q = query(sessionsCol(shopId), where("code", "==", code), where("status", "==", "open"));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return fromDoc(snap.docs[0]);
}

/** Check Bill screen: every table currently open (has unpaid tickets, or could soon). */
export async function getOpenSessions(shopId: string): Promise<TableSession[]> {
  const q = query(sessionsCol(shopId), where("status", "==", "open"));
  const snap = await getDocs(q);
  return snap.docs.map(fromDoc);
}

/** Invalidates the session's QR code — called once its bill is fully closed. */
export async function closeSession(shopId: string, sessionId: string): Promise<void> {
  await updateDoc(doc(sessionsCol(shopId), sessionId), {
    status: "closed",
    closedAt: Timestamp.now(),
  });
}
