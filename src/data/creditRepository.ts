import {
  collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { CustomerCredit, CreditTransaction } from "./types";

function customerCreditsCol(shopId: string) {
  return collection(db, "shops", shopId, "customerCredits");
}

function creditTransactionsCol(shopId: string) {
  return collection(db, "shops", shopId, "creditTransactions");
}

function creditFromDoc(id: string, data: Record<string, unknown>): CustomerCredit {
  return {
    id,
    customerId: data.customerId as string,
    customerName: data.customerName as string,
    balance: (data.balance as number | undefined) ?? 0,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
}

export async function getCustomerCredit(shopId: string, customerId: string): Promise<CustomerCredit | null> {
  const snap = await getDoc(doc(customerCreditsCol(shopId), customerId));
  return snap.exists() ? creditFromDoc(snap.id, snap.data()) : null;
}

/** Every customer with an outstanding (or negative/overpaid) balance — for the ລູກໜີ້ (debtors) list. */
export async function getAllCustomerCredits(shopId: string): Promise<CustomerCredit[]> {
  const snap = await getDocs(customerCreditsCol(shopId));
  return snap.docs.map((d) => creditFromDoc(d.id, d.data())).filter((c) => c.balance !== 0);
}

export async function getCreditTransactions(shopId: string, customerId: string): Promise<CreditTransaction[]> {
  const q = query(creditTransactionsCol(shopId), where("customerId", "==", customerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerId: data.customerId,
      customerName: data.customerName,
      type: data.type,
      amount: data.amount,
      saleId: data.saleId,
      billNumber: data.billNumber,
      note: data.note,
      createdAt: (data.createdAt as Timestamp).toDate(),
      createdByUid: data.createdByUid,
      createdByName: data.createdByName,
    } as CreditTransaction;
  });
}

/**
 * Charging a bill to a customer's tab already happens atomically inside
 * closeBill (saleRepository.ts) so a bill can never close without its credit
 * charge landing too — this standalone version is for the rarer case of
 * charging credit outside a bill close (none exist yet, kept for symmetry
 * with recordCreditPayment and any future caller).
 */
export async function chargeCredit(
  shopId: string,
  data: { customerId: string; customerName: string; amount: number; saleId?: string; billNumber?: string; createdByUid?: string; createdByName?: string },
): Promise<void> {
  const creditRef = doc(customerCreditsCol(shopId), data.customerId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(creditRef);
    const prevBalance = (snap.data()?.balance as number | undefined) ?? 0;
    tx.set(creditRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      balance: prevBalance + data.amount,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(creditTransactionsCol(shopId));
    tx.set(txRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      type: "charge",
      amount: data.amount,
      ...(data.saleId ? { saleId: data.saleId } : {}),
      ...(data.billNumber ? { billNumber: data.billNumber } : {}),
      ...(data.createdByUid ? { createdByUid: data.createdByUid } : {}),
      ...(data.createdByName ? { createdByName: data.createdByName } : {}),
      createdAt: serverTimestamp(),
    });
  });
}

/** The customer paying down (all or part of) their tab. `amount` is left unclamped against the current balance — a payment larger than what's owed correctly leaves a negative balance (the shop now owes the customer). */
export async function recordCreditPayment(
  shopId: string,
  data: { customerId: string; customerName: string; amount: number; note?: string; createdByUid?: string; createdByName?: string },
): Promise<void> {
  const creditRef = doc(customerCreditsCol(shopId), data.customerId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(creditRef);
    const prevBalance = (snap.data()?.balance as number | undefined) ?? 0;
    tx.set(creditRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      balance: prevBalance - data.amount,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const txRef = doc(creditTransactionsCol(shopId));
    tx.set(txRef, {
      customerId: data.customerId,
      customerName: data.customerName,
      type: "payment",
      amount: data.amount,
      ...(data.note ? { note: data.note } : {}),
      ...(data.createdByUid ? { createdByUid: data.createdByUid } : {}),
      ...(data.createdByName ? { createdByName: data.createdByName } : {}),
      createdAt: serverTimestamp(),
    });
  });
}
