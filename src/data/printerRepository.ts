import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Printer } from "./types";

function printersCol(shopId: string) {
  return collection(db, "shops", shopId, "printers");
}

export async function getPrinters(shopId: string): Promise<Printer[]> {
  const snap = await getDocs(printersCol(shopId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Printer));
}

export async function addPrinter(shopId: string, data: Omit<Printer, "id">): Promise<string> {
  const ref = await addDoc(printersCol(shopId), data);
  return ref.id;
}

export async function updatePrinter(shopId: string, printerId: string, data: Omit<Printer, "id">): Promise<void> {
  await updateDoc(doc(printersCol(shopId), printerId), { ...data });
}

export async function deletePrinter(shopId: string, printerId: string): Promise<void> {
  await deleteDoc(doc(printersCol(shopId), printerId));
}
