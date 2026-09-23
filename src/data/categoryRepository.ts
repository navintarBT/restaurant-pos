import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  getDocs, orderBy, query, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Category } from "./types";

function productsCol(shopId: string) {
  return collection(db, "shops", shopId, "products");
}

function categoriesCol(shopId: string) {
  return collection(db, "shops", shopId, "categories");
}

export async function getCategories(shopId: string): Promise<Category[]> {
  const q = query(categoriesCol(shopId), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name as string,
      foodGroup: data.foodGroup as string | undefined,
      icon: data.icon as string | undefined,
    };
  });
}

export async function addCategory(shopId: string, name: string, foodGroup?: string, icon?: string): Promise<string> {
  // Firestore rejects `undefined` field values outright — only include
  // foodGroup/icon in the write when they actually have a value.
  const payload: { name: string; foodGroup?: string; icon?: string } = { name };
  if (foodGroup) payload.foodGroup = foodGroup;
  if (icon) payload.icon = icon;
  const ref = await addDoc(categoriesCol(shopId), payload);
  return ref.id;
}

export async function updateCategory(shopId: string, id: string, name: string): Promise<void> {
  await updateDoc(doc(categoriesCol(shopId), id), { name });
}

/** Reassigns (or clears, when foodGroup is undefined) which food group this
 * category belongs to — separate from renaming, since they're independent
 * edits in the UI. */
export async function setCategoryFoodGroup(shopId: string, id: string, foodGroup: string | undefined): Promise<void> {
  await updateDoc(doc(categoriesCol(shopId), id), { foodGroup: foodGroup ? foodGroup : deleteField() });
}

/** Sets (or clears, when icon is undefined/empty) this category's icon. */
export async function setCategoryIcon(shopId: string, id: string, icon: string | undefined): Promise<void> {
  await updateDoc(doc(categoriesCol(shopId), id), { icon: icon ? icon : deleteField() });
}

export async function deleteCategory(shopId: string, id: string): Promise<void> {
  await deleteDoc(doc(categoriesCol(shopId), id));
}

export async function isCategoryInUse(shopId: string, categoryName: string): Promise<boolean> {
  const snap = await getDocs(query(productsCol(shopId), where("category", "==", categoryName)));
  return !snap.empty;
}

export async function renameCategoryInProducts(shopId: string, oldName: string, newName: string): Promise<void> {
  const snap = await getDocs(query(productsCol(shopId), where("category", "==", oldName)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { category: newName }));
  await batch.commit();
}
