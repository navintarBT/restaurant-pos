import {
  collection, doc, deleteDoc, deleteField, getDoc, getDocs, orderBy, query, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Customer } from "./types";

function customersCol(shopId: string) {
  return collection(db, "shops", shopId, "customers");
}

function fromDoc(id: string, data: Record<string, unknown>): Customer {
  return {
    id,
    phone: data.phone as string,
    name: data.name as string,
    address: data.address as string | undefined,
    enabled: (data.enabled as boolean | undefined) ?? true,
  };
}

export async function getCustomers(shopId: string): Promise<Customer[]> {
  const q = query(customersCol(shopId), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export async function getCustomerByPhone(shopId: string, phone: string): Promise<Customer | null> {
  const snap = await getDoc(doc(customersCol(shopId), phone));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/** The customer's `phone` (exactly 8 digits) doubles as their member code —
 * it's used as the document id itself, so two customers can never end up
 * sharing the same code. */
export async function addCustomer(
  shopId: string,
  data: { phone: string; name: string; address?: string; enabled: boolean },
): Promise<void> {
  const payload: { phone: string; name: string; address?: string; enabled: boolean } = {
    phone: data.phone,
    name: data.name,
    enabled: data.enabled,
  };
  if (data.address) payload.address = data.address;
  await setDoc(doc(customersCol(shopId), data.phone), payload);
}

export async function updateCustomer(
  shopId: string,
  phone: string,
  data: { name: string; address?: string; enabled: boolean },
): Promise<void> {
  await updateDoc(doc(customersCol(shopId), phone), {
    name: data.name,
    enabled: data.enabled,
    address: data.address ? data.address : deleteField(),
  });
}

export async function deleteCustomer(shopId: string, phone: string): Promise<void> {
  await deleteDoc(doc(customersCol(shopId), phone));
}
