import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  runTransaction,
  writeBatch,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Sale, SaleItem, OrderStatus, PaymentType, BillTarget } from "./types";

interface StockChange {
  productId: string;
  size: string;
  color: string;
  qty: number;
}

function buildStockChanges(items: SaleItem[]): StockChange[] {
  const changes: StockChange[] = [];
  for (const item of items) {
    if (item.isBundle && item.bundleItems?.length) {
      for (const bi of item.bundleItems) {
        changes.push({ productId: bi.productId, size: bi.variantSize ?? "", color: bi.variantColor ?? "", qty: bi.quantity * item.quantity });
      }
    } else {
      changes.push({ productId: item.productId, size: item.variant.size, color: item.variant.color, qty: item.quantity });
    }
  }
  return changes;
}

function salesCol(shopId: string) {
  return collection(db, "shops", shopId, "sales");
}

function productsCol(shopId: string) {
  return collection(db, "shops", shopId, "products");
}

/** Shared by recordSale and createOrder: validate + decrement stock for `items` inside an open transaction. */
async function applyStockChangesInTransaction(
  tx: import("firebase/firestore").Transaction,
  shopId: string,
  items: SaleItem[]
): Promise<void> {
  const changes = buildStockChanges(items);

  // Group stock changes by productId so each product is read exactly once
  const byProduct = new Map<string, StockChange[]>();
  for (const ch of changes) {
    const arr = byProduct.get(ch.productId) ?? [];
    arr.push(ch);
    byProduct.set(ch.productId, arr);
  }

  // Phase 1: all reads
  const snaps = new Map<string, any>();
  for (const productId of byProduct.keys()) {
    const ref = doc(productsCol(shopId), productId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`Product ${productId} not found`);
    snaps.set(productId, snap);
  }

  // Phase 2: validate + all writes
  for (const [productId, productChanges] of byProduct) {
    const snap = snaps.get(productId)!;
    if (snap.data().trackStock === false) continue; // untracked: skip validation + write entirely
    const ref = doc(productsCol(shopId), productId);
    const variants: any[] = [...(snap.data().variants ?? [])];
    for (const ch of productChanges) {
      const idx = variants.findIndex(
        (v) => v.size === ch.size && v.color === ch.color
      );
      if (idx === -1) throw new Error("Variant not found");
      if (variants[idx].stock < ch.qty) throw new Error("Insufficient stock");
      variants[idx] = { ...variants[idx], stock: variants[idx].stock - ch.qty };
    }
    tx.update(ref, { variants });
  }
}

/**
 * Record a sale and decrement stock.
 * Online: uses a transaction to verify stock atomically.
 * Offline: falls back to a batch write against the local cache (provisional).
 */
export async function recordSale(
  shopId: string,
  items: SaleItem[],
  total: number,
  paymentType: Sale["paymentType"],
  sellerUid: string,
  sellerName: string
): Promise<string> {
  // Check connectivity up front — a transaction attempted with zero network
  // (e.g. airplane mode) doesn't reliably reject, it can hang indefinitely
  // waiting for a connection that isn't coming, leaving the UI stuck on a
  // spinner forever instead of ever reaching the catch block below.
  if (!navigator.onLine) {
    return recordSaleProvisional(shopId, items, total, paymentType, sellerUid, sellerName);
  }

  try {
    return await runTransaction(db, async (tx) => {
      await applyStockChangesInTransaction(tx, shopId, items);

      const saleRef = doc(salesCol(shopId));
      tx.set(saleRef, { items, total, paymentType, status: "paid", sellerUid, sellerName, createdAt: Timestamp.now() });
      return saleRef.id;
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // Transaction can't run offline — fall back to provisional batch write
    if (code === "unavailable" || code === "failed-precondition" || !navigator.onLine) {
      return recordSaleProvisional(shopId, items, total, paymentType, sellerUid, sellerName);
    }
    throw err;
  }
}

/** Offline-safe batch write. Reads stock from local cache; marks sale as provisional. */
async function recordSaleProvisional(
  shopId: string,
  items: SaleItem[],
  total: number,
  paymentType: Sale["paymentType"],
  sellerUid: string,
  sellerName: string
): Promise<string> {
  const batch = writeBatch(db);
  const changes = buildStockChanges(items);

  // Group by productId to batch-update each product once
  const byProduct = new Map<string, StockChange[]>();
  for (const ch of changes) {
    const arr = byProduct.get(ch.productId) ?? [];
    arr.push(ch);
    byProduct.set(ch.productId, arr);
  }

  for (const [productId, productChanges] of byProduct) {
    const productRef = doc(productsCol(shopId), productId);
    let snap;
    try {
      // Read straight from the local cache — a plain getDoc() tries the
      // server first and can hang the same way the transaction did if the
      // client hasn't yet realized it's offline.
      snap = await getDocFromCache(productRef);
    } catch {
      continue; // never cached locally — can't adjust its stock offline
    }
    if (snap.exists() && snap.data().trackStock !== false) {
      const variants: any[] = [...(snap.data().variants ?? [])];
      for (const ch of productChanges) {
        const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
        if (idx !== -1) {
          variants[idx] = { ...variants[idx], stock: Math.max(0, variants[idx].stock - ch.qty) };
        }
      }
      batch.update(productRef, { variants });
    }
  }

  const saleRef = doc(salesCol(shopId));
  batch.set(saleRef, {
    items,
    total,
    paymentType,
    status: "paid",
    sellerUid,
    sellerName,
    createdAt: Timestamp.now(),
    provisional: true, // flag for reconciliation
  });

  // Don't await: the write already applies to the local cache synchronously
  // (that's what makes it show up in the UI), but commit()'s promise only
  // resolves once the server acknowledges it — which, while offline, can
  // take until the next reconnect. Awaiting it here would hang the checkout
  // UI the same way the transaction did.
  batch.commit().catch(() => {});
  return saleRef.id;
}

/**
 * Dine-in order: reserves stock immediately (same transaction as recordSale)
 * but records no payment yet. Splits into up to two tickets by
 * item.needsKitchen — food goes to Kitchen (status "pending"); everything
 * else skips the cook and starts already "ready" for Expedite. Both tickets
 * share the same tableSessionId so Check Bill can sum them together later.
 */
export async function createOrder(
  shopId: string,
  items: SaleItem[],
  tableSessionId: string,
  tableLabel: string,
  sellerUid: string,
  sellerName: string
): Promise<void> {
  const kitchenItems = items.filter((i) => i.needsKitchen !== false);
  const directItems = items.filter((i) => i.needsKitchen === false);

  await runTransaction(db, async (tx) => {
    await applyStockChangesInTransaction(tx, shopId, items);

    const now = Timestamp.now();
    const base = { paymentType: null, tableSessionId, tableLabel, sellerUid, sellerName, createdAt: now };

    if (kitchenItems.length > 0) {
      tx.set(doc(salesCol(shopId)), {
        ...base,
        items: kitchenItems,
        total: kitchenItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        status: "pending",
      });
    }
    if (directItems.length > 0) {
      tx.set(doc(salesCol(shopId)), {
        ...base,
        items: directItems,
        total: directItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
        status: "ready",
      });
    }
  });
}

function saleFromDoc(d: import("firebase/firestore").QueryDocumentSnapshot): Sale {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate(),
    servedAt: data.servedAt instanceof Timestamp ? data.servedAt.toDate() : undefined,
    cancelledAt: data.cancelledAt instanceof Timestamp ? data.cancelledAt.toDate() : undefined,
  } as Sale;
}

/** Kitchen/expedite screens: fetch open dine-in orders in any of `statuses`. */
export async function getOpenOrders(shopId: string, statuses: OrderStatus[]): Promise<Sale[]> {
  const q = query(salesCol(shopId), where("status", "in", statuses), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(saleFromDoc);
}

/**
 * Realtime version of getOpenOrders — Kitchen/Expedite stay subscribed while
 * the screen is open so a new order appears (and can trigger a sound alert)
 * without the cook/expediter having to leave and re-enter the tab or pull to
 * refresh. Returns an unsubscribe function; call it on unmount.
 */
export function subscribeToOpenOrders(
  shopId: string,
  statuses: OrderStatus[],
  callback: (orders: Sale[]) => void
): () => void {
  const q = query(salesCol(shopId), where("status", "in", statuses), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map(saleFromDoc)));
}

/** Cook (pending→cooking, cooking→ready) / expediter (ready→served) advance an order one step. */
export async function advanceOrderStatus(
  shopId: string,
  saleId: string,
  next: OrderStatus
): Promise<void> {
  const extra = next === "served" ? { servedAt: Timestamp.now() } : {};
  await updateDoc(doc(salesCol(shopId), saleId), { status: next, ...extra });
}

/**
 * Server/owner closes a table's bill: every ticket the table accumulated
 * (possibly several rounds — see getOrdersBySession) is marked paid together
 * in one batch, all under the same payment type. `serviceCharge`, when given,
 * folds a "ຄ່າບໍລິການ" line item into ONE of those tickets (its full
 * already-merged `items`/`total`, computed by the caller) so every existing
 * revenue report — which just sums Sale.total / iterates Sale.items — picks
 * it up automatically, with no separate service-charge plumbing needed.
 */
function billCountersCol(shopId: string) {
  return collection(db, "shops", shopId, "billCounters");
}

function creditTransactionsCol(shopId: string) {
  return collection(db, "shops", shopId, "creditTransactions");
}

function customerCreditsCol(shopId: string) {
  return collection(db, "shops", shopId, "customerCredits");
}

/** "DDMMYY" in the shop's local time — the bill-number sequence resets once per day on this key. */
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}`;
}

/** Display-only peek at the bill number a close-bill right now would likely get — not a hold, just a preview (see closeBill for the authoritative, race-safe assignment). */
export async function peekNextBillNumber(shopId: string): Promise<string> {
  const key = todayKey();
  const snap = await getDocFromCacheOrServer(doc(billCountersCol(shopId), key));
  const count = (snap?.data()?.count as number | undefined) ?? 0;
  return `${key}-${String(count + 1).padStart(4, "0")}`;
}

async function getDocFromCacheOrServer(ref: DocumentReference) {
  try {
    return await getDocFromCache(ref);
  } catch {
    try { return await getDoc(ref); } catch { return null; }
  }
}

function itemsTotal(items: SaleItem[]): number {
  return items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
}

/**
 * Splits `amount` across `weights` (each doc's own total) so the integer
 * shares always sum to EXACTLY `amount` — rounds every share, then dumps
 * whatever rounding leftover remains onto the last one. Used to distribute
 * one payment across every Sale doc a single closeBill() call touches, so
 * Σ paymentCash (etc.) across docs reconciles with what was actually paid
 * instead of the full amount being stamped onto every doc.
 */
function distribute(amount: number, weights: number[], grandTotal: number): number[] {
  if (!amount || weights.length === 0) return weights.map(() => 0);
  if (weights.length === 1 || grandTotal <= 0) return [amount, ...weights.slice(1).map(() => 0)];
  const shares = weights.map((w) => Math.round((amount * w) / grandTotal));
  const leftover = amount - shares.reduce((s, x) => s + x, 0);
  shares[shares.length - 1] += leftover;
  return shares;
}

/**
 * Closes a bill — assigns a sequential "DDMMYY-NNNN" bill number and, if any
 * of the payment is on credit, charges the customer's tab — all inside one
 * transaction so a bill can never close without its credit charge (or vice
 * versa). `payment`'s three fields need not be mutually exclusive (ສົດ+ໂອນ
 * uses cash+transfer; ຕິດໜີ້ can mix a partial cash/transfer payment with the
 * remainder on credit).
 *
 * Each target is either a WHOLE ticket (`itemIndexes` omitted — closes that
 * doc in place, today's original behavior) or a SUBSET of one ticket's items
 * (ແຍກຈ່າຍ item-level split): the source doc is shrunk to its unselected
 * remainder (stays open, untouched otherwise) and a new doc is born already
 * `status:"paid"` for just the selected items. `serviceChargePercent`, when
 * given, is computed fresh against whatever subtotal THIS payment covers and
 * folded into one resulting doc — every existing revenue report just sums
 * Sale.total/items, so this is how the service-charge amount gets counted
 * without separate plumbing. The cash/transfer/credit breakdown is then
 * distributed proportionally across every resulting doc (see distribute()).
 * `discountAmount`, when given, is folded in the same way but FIRST — a
 * negative line item — so the service charge that follows is computed on
 * the already-discounted subtotal, matching how staff expect ສ່ວນຫຼຸດ to work.
 * `vatPercent`, when given, is folded in LAST — on top of the discounted
 * subtotal AND the service charge — since menu prices are VAT-exclusive and
 * VAT applies uniformly to every bill (no per-table opt-out like service
 * charge has).
 */
export async function closeBill(
  shopId: string,
  targets: BillTarget[],
  paymentType: PaymentType,
  payment: { cash?: number; transfer?: number; credit?: number },
  customer?: { id: string; name: string },
  serviceChargePercent?: number,
  discountAmount?: number,
  vatPercent?: number
): Promise<{ billNumber: string }> {
  const key = todayKey();
  const counterRef = doc(billCountersCol(shopId), key);
  const creditAmount = payment.credit ?? 0;
  const creditRef = creditAmount > 0 && customer ? doc(customerCreditsCol(shopId), customer.id) : null;

  interface PaidDoc {
    ref: DocumentReference;
    isNew: boolean;
    items: SaleItem[];
    total: number;
    itemsChanged: boolean;
    base?: Record<string, unknown>;
  }

  return runTransaction(db, async (tx) => {
    // Phase 1: reads — every target doc, plus the counter/credit docs, all
    // before any write (Firestore transactions require reads-before-writes).
    const counterSnap = await tx.get(counterRef);
    const creditSnap = creditRef ? await tx.get(creditRef) : null;
    const saleSnaps = await Promise.all(targets.map((t) => tx.get(doc(salesCol(shopId), t.saleId))));

    const nextCount = ((counterSnap.data()?.count as number | undefined) ?? 0) + 1;
    const billNumber = `${key}-${String(nextCount).padStart(4, "0")}`;

    // Phase 2: compute the resulting paid docs (and any shrink writes) from
    // each target + its fresh snapshot.
    const paidDocs: PaidDoc[] = [];
    const shrinkWrites: { ref: DocumentReference; items: SaleItem[]; total: number }[] = [];

    targets.forEach((t, i) => {
      const snap = saleSnaps[i];
      if (!snap.exists()) return; // vanished concurrently — skip, same tolerance as removeItemFromSale
      const data = snap.data();
      const freshItems = (data.items ?? []) as SaleItem[];

      if (!t.itemIndexes || t.itemIndexes.length >= freshItems.length) {
        paidDocs.push({ ref: snap.ref, isNew: false, items: freshItems, total: itemsTotal(freshItems), itemsChanged: false });
        return;
      }
      const idxSet = new Set(t.itemIndexes);
      const selected = freshItems.filter((_, idx) => idxSet.has(idx));
      const remaining = freshItems.filter((_, idx) => !idxSet.has(idx));
      shrinkWrites.push({ ref: snap.ref, items: remaining, total: itemsTotal(remaining) });
      paidDocs.push({
        ref: doc(salesCol(shopId)),
        isNew: true,
        items: selected,
        total: itemsTotal(selected),
        itemsChanged: false,
        base: {
          tableSessionId: data.tableSessionId,
          tableLabel: data.tableLabel,
          sellerUid: data.sellerUid,
          sellerName: data.sellerName,
          createdAt: data.createdAt,
          splitFromSaleId: t.saleId,
        },
      });
    });

    if (paidDocs.length === 0) throw new Error("closeBill: no targets resolved to a live sale doc");

    // Phase 3a: fold the end-of-bill discount (if any) into one resulting
    // doc FIRST — a negative line item, same mechanism as the service-charge
    // fold below, just subtracting instead of adding.
    if (discountAmount && discountAmount > 0) {
      const target = paidDocs[0];
      target.items = [
        ...target.items,
        {
          productId: "__discount__",
          productName: "ສ່ວນຫຼຸດ",
          variant: { size: "", color: "", stock: 0 },
          quantity: 1,
          originalPrice: -discountAmount,
          unitPrice: -discountAmount,
          costPrice: 0,
          needsKitchen: false,
        } as SaleItem,
      ];
      target.total -= discountAmount;
      target.itemsChanged = true;
    }

    // Phase 3b: fold the service charge into one resulting doc, computed on
    // whatever the discounted subtotal above already is.
    const grandSubtotal = paidDocs.reduce((s, d) => s + d.total, 0);
    const serviceChargeAmount = serviceChargePercent ? Math.round(grandSubtotal * serviceChargePercent / 100) : 0;
    if (serviceChargeAmount > 0) {
      const target = paidDocs[0];
      target.items = [
        ...target.items,
        {
          productId: "__service_charge__",
          productName: `ຄ່າບໍລິການ (${serviceChargePercent}%)`,
          variant: { size: "", color: "", stock: 0 },
          quantity: 1,
          originalPrice: serviceChargeAmount,
          unitPrice: serviceChargeAmount,
          costPrice: 0,
          needsKitchen: false,
        } as SaleItem,
      ];
      target.total += serviceChargeAmount;
      target.itemsChanged = true;
    }

    // Phase 3c: fold VAT in last, on top of the discounted subtotal AND the
    // service charge — menu prices are VAT-exclusive, so this is added, not
    // extracted from, what's already there.
    const vatAmount = vatPercent ? Math.round((grandSubtotal + serviceChargeAmount) * vatPercent / 100) : 0;
    if (vatAmount > 0) {
      const target = paidDocs[0];
      target.items = [
        ...target.items,
        {
          productId: "__vat__",
          productName: `VAT (${vatPercent}%)`,
          variant: { size: "", color: "", stock: 0 },
          quantity: 1,
          originalPrice: vatAmount,
          unitPrice: vatAmount,
          costPrice: 0,
          needsKitchen: false,
        } as SaleItem,
      ];
      target.total += vatAmount;
      target.itemsChanged = true;
    }
    const grandTotal = grandSubtotal + serviceChargeAmount + vatAmount;

    // Phase 4: distribute the payment breakdown proportionally across docs.
    const weights = paidDocs.map((d) => d.total);
    const cashShares = distribute(payment.cash ?? 0, weights, grandTotal);
    const transferShares = distribute(payment.transfer ?? 0, weights, grandTotal);
    const creditShares = distribute(creditAmount, weights, grandTotal);

    // Phase 5: writes.
    tx.set(counterRef, { count: nextCount }, { merge: true });

    for (const s of shrinkWrites) tx.update(s.ref, { items: s.items, total: s.total });

    if (creditRef && customer && creditAmount > 0) {
      const prevBalance = (creditSnap?.data()?.balance as number | undefined) ?? 0;
      tx.set(creditRef, {
        customerId: customer.id,
        customerName: customer.name,
        balance: prevBalance + creditAmount,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      tx.set(doc(creditTransactionsCol(shopId)), {
        customerId: customer.id,
        customerName: customer.name,
        type: "charge",
        amount: creditAmount,
        saleId: paidDocs[0].ref.id,
        billNumber,
        createdAt: serverTimestamp(),
      });
    }

    const paidAt = Timestamp.now();
    paidDocs.forEach((d, i) => {
      const paymentFields: Record<string, unknown> = {};
      if (cashShares[i]) paymentFields.paymentCash = cashShares[i];
      if (transferShares[i]) paymentFields.paymentTransfer = transferShares[i];
      if (creditShares[i]) paymentFields.paymentCredit = creditShares[i];
      if (customer && creditShares[i]) {
        paymentFields.customerId = customer.id;
        paymentFields.customerName = customer.name;
      }
      const itemsExtra = d.itemsChanged ? { items: d.items, total: d.total } : {};

      if (d.isNew) {
        tx.set(d.ref, {
          ...d.base, items: d.items, total: d.total,
          status: "paid", paymentType, paidAt, billNumber, ...paymentFields,
        });
      } else {
        tx.update(d.ref, {
          status: "paid", paymentType, paidAt, billNumber, ...paymentFields, ...itemsExtra,
        });
      }
    });

    return { billNumber };
  });
}

/**
 * Check Bill screen: every ticket belonging to one table session (a session
 * only ever has a handful, so filtering "not paid yet" client-side avoids
 * needing a composite index for an inequality on top of the equality match).
 */
export async function getOrdersBySession(shopId: string, tableSessionId: string): Promise<Sale[]> {
  const q = query(salesCol(shopId), where("tableSessionId", "==", tableSessionId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(),
        servedAt: data.servedAt instanceof Timestamp ? data.servedAt.toDate() : undefined,
      } as Sale;
    })
    .filter((sale) => sale.status !== "paid");
}

export async function getSalesByDateRange(shopId: string, from: Date, to: Date): Promise<Sale[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const q = query(
    salesCol(shopId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(saleFromDoc);
}


/**
 * Soft-cancels a sale — keeps the doc (flagged status:"cancelled" with a
 * reason + who/when) instead of hard-deleting it, so it shows up in
 * ປະຫວັດການຍົກເລີກບິນ instead of disappearing without a trace. Works on a
 * bill in ANY state: still-open/unpaid (pending/cooking/ready/served) or
 * already paid.
 */
export async function cancelSale(
  shopId: string,
  sale: Sale,
  data: { reason: string; restoreStock: boolean; cancelledByUid: string; cancelledByName: string },
): Promise<void> {
  const saleRef = doc(salesCol(shopId), sale.id);
  await runTransaction(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return;
    if (saleSnap.data().status === "cancelled") return; // already cancelled by someone else

    if (data.restoreStock) {
      const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
      const changes = buildStockChanges(freshItems);

      const byProduct = new Map<string, StockChange[]>();
      for (const ch of changes) {
        const arr = byProduct.get(ch.productId) ?? [];
        arr.push(ch);
        byProduct.set(ch.productId, arr);
      }

      const snaps = new Map<string, any>();
      for (const productId of byProduct.keys()) {
        const ref = doc(productsCol(shopId), productId);
        const snap = await tx.get(ref);
        if (snap.exists()) snaps.set(productId, snap);
      }

      for (const [productId, productChanges] of byProduct) {
        const snap = snaps.get(productId);
        if (!snap) continue;
        if (snap.data().trackStock === false) continue; // deduction never happened; don't restore either
        const ref = doc(productsCol(shopId), productId);
        const variants: any[] = [...(snap.data().variants ?? [])];
        for (const ch of productChanges) {
          const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
          if (idx !== -1) variants[idx] = { ...variants[idx], stock: variants[idx].stock + ch.qty };
        }
        tx.update(ref, { variants });
      }
    }

    tx.update(saleRef, {
      status: "cancelled",
      cancelReason: data.reason,
      cancelledAt: serverTimestamp(),
      cancelledByUid: data.cancelledByUid,
      cancelledByName: data.cancelledByName,
    });
  });
}

/**
 * Removes qty units of one line item from a sale. By default also restores that
 * stock ("cancel"). Pass restoreStock=false to just delete the history entry
 * as-is, leaving stock untouched. Returns updated sale, or null if the whole
 * sale was deleted (last item removed).
 */
export async function removeItemFromSale(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  qtyToRemove: number,
  restoreStock = true
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    // Re-read the sale itself inside the transaction, same reasoning as cancelSale —
    // otherwise a concurrent edit can be silently overwritten or stock double-restored.
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null; // already deleted by someone else
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    const item = freshItems[itemIndex];
    if (!item) return { ...sale, items: freshItems };
    const actual = Math.min(qtyToRemove, item.quantity);

    if (restoreStock) {
      const changes = buildStockChanges([{ ...item, quantity: actual }]);

      const byProduct = new Map<string, StockChange[]>();
      for (const ch of changes) {
        const arr = byProduct.get(ch.productId) ?? [];
        arr.push(ch);
        byProduct.set(ch.productId, arr);
      }

      const snaps = new Map<string, any>();
      for (const productId of byProduct.keys()) {
        const ref = doc(productsCol(shopId), productId);
        const snap = await tx.get(ref);
        if (snap.exists()) snaps.set(productId, snap);
      }

      for (const [productId, productChanges] of byProduct) {
        const snap = snaps.get(productId);
        if (!snap) continue;
        if (snap.data().trackStock === false) continue; // deduction never happened; don't restore either
        const ref = doc(productsCol(shopId), productId);
        const variants: any[] = [...(snap.data().variants ?? [])];
        for (const ch of productChanges) {
          const idx = variants.findIndex((v) => v.size === ch.size && v.color === ch.color);
          if (idx !== -1) variants[idx] = { ...variants[idx], stock: variants[idx].stock + ch.qty };
        }
        tx.update(ref, { variants });
      }
    }

    const newItems: SaleItem[] =
      item.quantity <= actual
        ? freshItems.filter((_, i) => i !== itemIndex)
        : freshItems.map((it, i) => (i === itemIndex ? { ...it, quantity: it.quantity - actual } : it));

    if (newItems.length === 0) {
      tx.delete(saleRef);
      return null;
    }

    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}

/**
 * Corrects the unit price of one line item on an already-recorded sale
 * (e.g. fixing a typo at checkout). Only the price changes — quantity and
 * stock are untouched. Returns the updated sale, or null if it no longer exists.
 */
export async function updateItemPrice(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  newPrice: number
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null;
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    if (!freshItems[itemIndex]) return { ...sale, items: freshItems };

    const newItems = freshItems.map((it, i) => (i === itemIndex ? { ...it, unitPrice: newPrice } : it));
    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}

/**
 * Splits ONE unit off a multi-quantity line item and gives it its own price
 * (e.g. correcting the price of a single piece within "×2"), mirroring the
 * cart's SPLIT_PRICE action but applied to an already-recorded sale. If the
 * line only has 1 unit left, this just behaves like updateItemPrice.
 */
export async function splitItemPrice(
  shopId: string,
  sale: Sale,
  itemIndex: number,
  newPrice: number
): Promise<Sale | null> {
  const saleRef = doc(salesCol(shopId), sale.id);
  return runTransaction<Sale | null>(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) return null;
    const freshItems = (saleSnap.data().items ?? []) as SaleItem[];
    const item = freshItems[itemIndex];
    if (!item) return { ...sale, items: freshItems };

    let newItems: SaleItem[];
    if (item.quantity <= 1) {
      newItems = freshItems.map((it, i) => (i === itemIndex ? { ...it, unitPrice: newPrice } : it));
    } else {
      const splitId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const splitItem: SaleItem = { ...item, quantity: 1, unitPrice: newPrice, splitId };
      newItems = [
        ...freshItems.map((it, i) => (i === itemIndex ? { ...it, quantity: it.quantity - 1 } : it)),
        splitItem,
      ];
    }
    const newTotal = newItems.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    tx.update(saleRef, { items: newItems, total: newTotal });
    return { ...sale, items: newItems, total: newTotal };
  });
}
