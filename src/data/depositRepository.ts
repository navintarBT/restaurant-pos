import {
  collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ProductDeposit, DepositTransaction } from "./types";

function depositsCol(shopId: string) {
  return collection(db, "shops", shopId, "productDeposits");
}

function depositTransactionsCol(shopId: string) {
  return collection(db, "shops", shopId, "depositTransactions");
}

function depositId(customerId: string, productId: string): string {
  return `${customerId}_${productId}`;
}

function depositFromDoc(id: string, data: Record<string, unknown>): ProductDeposit {
  return {
    id,
    customerId: data.customerId as string,
    customerName: data.customerName as string,
    productId: data.productId as string,
    productName: data.productName as string,
    quantity: (data.quantity as number | undefined) ?? 0,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
}

/** Every (customer, product) deposit still holding a nonzero quantity — for the ຝາກ list page. */
export async function getAllDeposits(shopId: string): Promise<ProductDeposit[]> {
  const snap = await getDocs(depositsCol(shopId));
  return snap.docs.map((d) => depositFromDoc(d.id, d.data())).filter((d) => d.quantity !== 0);
}

/** One customer's deposits across every product they've left something with. */
export async function getCustomerDeposits(shopId: string, customerId: string): Promise<ProductDeposit[]> {
  const q = query(depositsCol(shopId), where("customerId", "==", customerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => depositFromDoc(d.id, d.data())).filter((d) => d.quantity !== 0);
}

export async function getDepositTransactions(shopId: string, customerId: string): Promise<DepositTransaction[]> {
  const q = query(depositTransactionsCol(shopId), where("customerId", "==", customerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerId: data.customerId,
      customerName: data.customerName,
      productId: data.productId,
      productName: data.productName,
      type: data.type,
      quantity: data.quantity,
      note: data.note,
      createdAt: (data.createdAt as Timestamp).toDate(),
      createdByUid: data.createdByUid,
      createdByName: data.createdByName,
    } as DepositTransaction;
  });
}

/** Staff records a customer leaving some quantity of a product behind (e.g. the rest of a bottle) to reclaim on a future visit. */
export async function depositProduct(
  shopId: string,
  data: { customerId: string; customerName: string; productId: string; productName: string; quantity: number; createdByUid?: string; createdByName?: string },
): Promise<void> {
  const ref = doc(depositsCol(shopId), depositId(data.customerId, data.productId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prevQty = (snap.data()?.quantity as number | undefined) ?? 0;
    tx.set(ref, {
      customerId: data.customerId,
      customerName: data.customerName,
      productId: data.productId,
      productName: data.productName,
      quantity: prevQty + data.quantity,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(depositTransactionsCol(shopId));
    tx.set(txRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      productId: data.productId,
      productName: data.productName,
      type: "deposit",
      quantity: data.quantity,
      ...(data.createdByUid ? { createdByUid: data.createdByUid } : {}),
      ...(data.createdByName ? { createdByName: data.createdByName } : {}),
      createdAt: serverTimestamp(),
    });
  });
}

/** The customer taking back some of what they left — clamped so it can never exceed what's actually in storage (unlike credit's balance, there's no meaningful "shop owes customer" negative case here). */
export async function withdrawProduct(
  shopId: string,
  data: { customerId: string; customerName: string; productId: string; productName: string; quantity: number; note?: string; createdByUid?: string; createdByName?: string },
): Promise<void> {
  const ref = doc(depositsCol(shopId), depositId(data.customerId, data.productId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prevQty = (snap.data()?.quantity as number | undefined) ?? 0;
    const actual = Math.min(data.quantity, prevQty);
    if (actual <= 0) return;
    tx.set(ref, {
      customerId: data.customerId,
      customerName: data.customerName,
      productId: data.productId,
      productName: data.productName,
      quantity: prevQty - actual,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(depositTransactionsCol(shopId));
    tx.set(txRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      productId: data.productId,
      productName: data.productName,
      type: "withdraw",
      quantity: actual,
      ...(data.note ? { note: data.note } : {}),
      ...(data.createdByUid ? { createdByUid: data.createdByUid } : {}),
      ...(data.createdByName ? { createdByName: data.createdByName } : {}),
      createdAt: serverTimestamp(),
    });
  });
}
