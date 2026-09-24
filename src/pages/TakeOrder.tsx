import { useState, useCallback, useEffect, useRef } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonModal,
  IonFooter,
  IonMenuButton,
  IonAlert,
  IonSearchbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, qrCodeOutline, addOutline, removeOutline, checkmarkOutline, chevronBackOutline, printOutline, settingsOutline, refreshOutline } from "ionicons/icons";
import QRCode from "qrcode";
import { fmtK } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import { getBundles } from "../data/bundleRepository";
import { createOrder, getOrdersBySession } from "../data/saleRepository";
import { getOrCreateOpenSession, getOpenSessions, closeSession } from "../data/tableSessionRepository";
import { getTableRoster, tableDisplayLabel, type TableRosterEntry } from "../data/shopRepository";
import { computeReserved, reservedKey } from "../utils/stock";
import VariantPicker from "../components/VariantPicker";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { Bundle, BundleItem, OrderStatus, Product, ProductVariant, Sale, SaleItem, TableSession } from "../data/types";

function itemKey(item: Pick<SaleItem, "productId" | "variant">) {
  return `${item.productId}__${item.variant.size}__${item.variant.color}`;
}

type TableStatus = "available" | "empty" | "busy" | "ready" | "served";

interface OpenTable {
  session: TableSession;
  qty: number;
  status: Exclude<TableStatus, "available">;
}

// A tile in the "ເລືອກໂຕະ" grid — either a roster entry with no session yet
// ("available"), or one merged with its live session/status.
interface TableTile {
  label: string;
  zone?: string;
  seats?: number;
  physicalTables?: number;
  session: TableSession | null;
  qty: number;
  status: TableStatus;
}

// Vacant tables are green, every occupied state gets its own distinct color
// (gray/amber/orange/red) so the grid reads like a floor-plan at a glance.
const STATUS_LABEL: Record<TableStatus, { text: string; color: string; bg: string }> = {
  available: { text: "ວ່າງ", color: "var(--app-success)", bg: "var(--app-success-surface)" },
  empty: { text: "ບໍ່ວ່າງ · ລໍຖ້າສັ່ງ", color: "var(--app-text-secondary)", bg: "var(--app-surface-alt)" },
  busy: { text: "🔥 ກຳລັງເຮັດ", color: "var(--app-warning)", bg: "var(--app-warning-surface)" },
  ready: { text: "✅ ພ້ອມເສີບ", color: "var(--ion-color-primary)", bg: "var(--app-accent-surface)" },
  served: { text: "🧾 ລໍຖ້າເກັບເງິນ", color: "var(--app-danger)", bg: "var(--app-danger-surface)" },
};

// ປະຫວັດການສັ່ງ ticket status — one badge per already-confirmed order.
const ORDER_STATUS_LABEL: Record<OrderStatus, { text: string; color: string; bg: string }> = {
  pending: { text: "🔥 ລໍຖ້າເຮັດ", color: "var(--app-warning)", bg: "var(--app-warning-surface)" },
  cooking: { text: "🔥 ກຳລັງເຮັດ", color: "var(--app-warning)", bg: "var(--app-warning-surface)" },
  ready: { text: "✅ ພ້ອມເສີບ", color: "var(--ion-color-primary)", bg: "var(--app-accent-surface)" },
  served: { text: "🧾 ເສີບແລ້ວ", color: "var(--app-success)", bg: "var(--app-success-surface)" },
  paid: { text: "💰 ຈ່າຍແລ້ວ", color: "var(--app-success)", bg: "var(--app-success-surface)" },
  cancelled: { text: "✕ ຍົກເລີກ", color: "var(--app-danger)", bg: "var(--app-danger-surface)" },
};

const TakeOrder: React.FC = () => {
  const { shopId, user, displayName, zoneRestricted, allowedZones } = useAuth();

  // ── Step 1: pick or open a table ──────────────────────────────────────
  const [step, setStep] = useState<"select-table" | "menu">("select-table");
  const [openTables, setOpenTables] = useState<OpenTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OpenTable | null>(null);
  const [deletingTable, setDeletingTable] = useState(false);

  // Predefined table roster — lets staff tap an existing table tile instead
  // of typing a label every time. Managed on a dedicated page (ຕັ້ງຄ່າ ›
  // ຈັດການໂຕະ / ຈັດການໂຊນ), just read here to build the tile grid.
  const [roster, setRoster] = useState<TableRosterEntry[]>([]);
  const [activeZone, setActiveZone] = useState("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"all" | "available" | "inUse" | "waiting">("all");
  const [tableSearch, setTableSearch] = useState("");

  // ── Step 2: menu + cart for the chosen table ────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuTab, setMenuTab] = useState<"regular" | "bundle" | "promotion">("regular");
  const [activeCategory, setActiveCategory] = useState("all");
  const [menuSearch, setMenuSearch] = useState("");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [bundlePickerTarget, setBundlePickerTarget] = useState<Bundle | null>(null);
  const [chosenVariants, setChosenVariants] = useState<Record<number, ProductVariant>>({});
  const [bundleQty, setBundleQty] = useState(1);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [tableLabel, setTableLabel] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── ເພີ່ມໃໝ່ (build the next ticket) vs ປະຫວັດການສັ່ງ (already-confirmed
  // tickets for this table's current session) ──
  const [orderView, setOrderView] = useState<"new" | "history">("new");
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [historyOrders, setHistoryOrders] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrTableLabel, setQrTableLabel] = useState("");

  // Removing the last item empties the cart while the sheet is still open —
  // rather than leave the seller staring at an empty order screen, close it
  // for them automatically. Only fires on a >0 -> 0 transition, not when the
  // sheet first opens on an already-empty cart.
  const prevCartLen = useRef(cart.length);
  useEffect(() => {
    if (cartOpen && prevCartLen.current > 0 && cart.length === 0) {
      setCartOpen(false);
    }
    prevCartLen.current = cart.length;
  }, [cart.length, cartOpen]);

  const loadTables = useCallback(async () => {
    if (!shopId) return;
    setTablesLoading(true);
    try {
      const sessions = await getOpenSessions(shopId);
      const withStatus = await Promise.all(sessions.map(async (session): Promise<OpenTable> => {
        const orders = await getOrdersBySession(shopId, session.id);
        const qty = orders.reduce((s, o) => s + o.items.reduce((is, i) => is + i.quantity, 0), 0);
        let status: TableStatus = "empty";
        if (orders.some((o) => o.status === "pending" || o.status === "cooking")) status = "busy";
        else if (orders.some((o) => o.status === "ready")) status = "ready";
        else if (orders.some((o) => o.status === "served")) status = "served";
        return { session, qty, status };
      }));
      withStatus.sort((a, b) => a.session.tableLabel.localeCompare(b.session.tableLabel, undefined, { numeric: true }));
      setOpenTables(withStatus);
    } finally {
      setTablesLoading(false);
    }
  }, [shopId]);

  const loadRoster = useCallback(async () => {
    if (!shopId) return;
    try {
      setRoster(await getTableRoster(shopId));
    } catch {
      // roster is an additive convenience — a failed fetch just falls back to 0 tiles
    }
  }, [shopId]);

  useIonViewWillEnter(() => { if (step === "select-table") { loadTables(); loadRoster(); } }, [loadTables, loadRoster, step]);
  useEffect(() => { if (step === "select-table") { loadTables(); loadRoster(); } }, [loadTables, loadRoster, step]);

  async function handleTablesRefresh(e: CustomEvent) {
    await Promise.all([loadTables(), loadRoster()]);
    (e.target as HTMLIonRefresherElement).complete();
  }

  function handleManualRefresh() {
    loadTables();
    loadRoster();
  }

  // Merge the saved roster with live sessions into one tile list: roster
  // entries come first (in saved order), then any ad-hoc open table that
  // isn't on the roster (e.g. left over from before the roster existed).
  // Sessions are looked up by tableDisplayLabel(label, zone), not the bare
  // label — a label is only unique within its zone, so two tiles can share
  // "5" as long as they're in different zones.
  const allTiles: TableTile[] = (() => {
    const byLabel = new Map(openTables.map((t) => [t.session.tableLabel, t]));
    const seen = new Set<string>();
    const result: TableTile[] = [];
    for (const entry of roster) {
      const combined = tableDisplayLabel(entry.label, entry.zone);
      seen.add(combined);
      const open = byLabel.get(combined);
      result.push(open
        ? { label: entry.label, zone: entry.zone, seats: entry.seats, physicalTables: entry.physicalTables, session: open.session, qty: open.qty, status: open.status }
        : { label: entry.label, zone: entry.zone, seats: entry.seats, physicalTables: entry.physicalTables, session: null, qty: 0, status: "available" });
    }
    for (const open of openTables) {
      if (!seen.has(open.session.tableLabel)) {
        result.push({ label: open.session.tableLabel, session: open.session, qty: open.qty, status: open.status });
      }
    }
    return result;
  })();

  // A zone-restricted server (see UserPermissions.tsx "3. ໂຊນ") only ever
  // sees tiles for their own allowed zone(s) — filtered here, before search
  // and the zone/status chips, so it can't be bypassed through those and the
  // zone chip list itself only offers zones they can actually use.
  const visibleTiles = zoneRestricted
    ? allTiles.filter((t) => !!t.zone && allowedZones.includes(t.zone))
    : allTiles;

  const zones = [...new Set(visibleTiles.map((r) => r.zone).filter(Boolean) as string[])];

  // "ກຳລັງໃຊ້ງານ" groups busy/ready/served (an order is actively moving) —
  // "ລໍຖ້າ(ລູກຄ້າຢືນຢັນ)" is the "empty" status specifically: a session is
  // open (e.g. QR just scanned) but no order has been confirmed/sent yet.
  const STATUS_FILTERS = [
    { value: "all" as const, label: "ທັງໝົດ" },
    { value: "available" as const, label: "ໂຕະວ່າງ" },
    { value: "inUse" as const, label: "ກຳລັງໃຊ້ງານ" },
    { value: "waiting" as const, label: "ລໍຖ້າ(ລູກຄ້າຢືນຢັນ)" },
  ];
  function matchesStatus(tile: TableTile, filter: typeof activeStatusFilter) {
    if (filter === "all") return true;
    if (filter === "available") return tile.status === "available";
    if (filter === "waiting") return tile.status === "empty";
    return tile.status === "busy" || tile.status === "ready" || tile.status === "served";
  }

  // Search-only baseline (ignores the zone/status chips themselves) — each
  // chip's own count is how many tables it would show, computed off this so
  // the counts stay independent of whichever OTHER chip is active.
  const searchFiltered = visibleTiles.filter((t) => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return true;
    return t.label.toLowerCase().includes(q) || (t.zone ?? "").toLowerCase().includes(q);
  });
  const zoneCounts = new Map<string, number>();
  for (const t of searchFiltered) {
    if (!t.zone) continue;
    zoneCounts.set(t.zone, (zoneCounts.get(t.zone) ?? 0) + 1);
  }
  const statusCounts: Record<typeof activeStatusFilter, number> = {
    all: searchFiltered.length,
    available: searchFiltered.filter((t) => matchesStatus(t, "available")).length,
    inUse: searchFiltered.filter((t) => matchesStatus(t, "inUse")).length,
    waiting: searchFiltered.filter((t) => matchesStatus(t, "waiting")).length,
  };

  const tiles = searchFiltered
    .filter((t) => activeZone === "all" || t.zone === activeZone)
    .filter((t) => matchesStatus(t, activeStatusFilter));

  function selectTable(label: string) {
    setTableLabel(label);
    // Resolve this table's already-open session (if any) from the tile list
    // just loaded in Step 1, so ປະຫວັດການສັ່ງ has something to fetch by right
    // away — a brand-new table with nothing sent yet simply has none.
    setTableSession(openTables.find((t) => t.session.tableLabel === label)?.session ?? null);
    setOrderView("new");
    setStep("menu");
  }

  function backToTables() {
    setStep("select-table");
  }

  async function confirmDeleteTable() {
    if (!shopId || !deleteTarget) return;
    setDeletingTable(true);
    try {
      await closeSession(shopId, deleteTarget.session.id);
      setOpenTables((prev) => prev.filter((t) => t.session.id !== deleteTarget.session.id));
      setDeleteTarget(null);
    } catch {
      setTableError("ລຶບໂຕະບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setDeletingTable(false);
    }
  }

  // ── Menu / cart logic ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prods, bunds] = await Promise.all([
        getProducts(shopId),
        getBundles(shopId).catch(() => [] as Bundle[]),
      ]);
      setProducts(prods);
      setBundles(bunds);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { if (step === "menu") load(); }, [load, step]);
  useEffect(() => { if (step === "menu") load(); }, [load, step]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  // Stock already added to this order isn't reserved server-side yet (that
  // only happens once "ຢືນຢັນຈັດຕຽມອໍເດີ" commits the transaction) — subtract it
  // client-side so re-opening the picker can't add more than what's left.
  // computeReserved also accounts for quantities hidden inside bundle items,
  // not just plain cart lines (see utils/stock.ts).
  const reserved = computeReserved(cart);
  const productsEffective = products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      const inCart = reserved.get(reservedKey(p.id, v.size, v.color)) ?? 0;
      return inCart > 0 ? { ...v, stock: Math.max(0, v.stock - inCart) } : v;
    }),
  }));

  // ເມນູທົ່ວໄປ/ໂປຣໂມຊັນ are both regular Products, distinguished only by
  // productType (mutually exclusive — see ProductForm's type selector);
  // ຊຸດ (bundle) is a separate collection entirely, rendered from `bundles`.
  const typeFiltered = productsEffective.filter((p) =>
    menuTab === "promotion" ? p.productType === "promotion" : p.productType !== "promotion"
  );
  const categories = [...new Set(typeFiltered.map((p) => p.category).filter(Boolean) as string[])];
  const categoryFiltered = activeCategory === "all" ? typeFiltered : typeFiltered.filter((p) => p.category === activeCategory);
  const searchQ = menuSearch.trim().toLowerCase();
  const filtered = searchQ ? categoryFiltered.filter((p) => p.name.toLowerCase().includes(searchQ)) : categoryFiltered;
  const filteredBundles = searchQ ? bundles.filter((b) => b.name.toLowerCase().includes(searchQ)) : bundles;

  function handleAddToCart(items: { variant: ProductVariant; quantity: number; unitPrice: number; costPrice?: number }[]) {
    if (!pickerProduct) return;
    items.forEach(({ variant, quantity, unitPrice, costPrice }) => {
      const newItem: SaleItem = {
        productId: pickerProduct.id,
        productName: pickerProduct.name,
        variant,
        quantity,
        originalPrice: unitPrice,
        unitPrice,
        costPrice,
        needsKitchen: pickerProduct.needsKitchen,
      };
      const key = itemKey(newItem);
      setCart((prev) => {
        const existing = prev.find((i) => itemKey(i) === key);
        if (existing) {
          return prev.map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity + quantity } : i));
        }
        return [...prev, newItem];
      });
    });
    // Stay on the menu grid instead of popping the cart open — the confirm
    // button reads "ເພີ່ມຫຼາຍລາຍການ" precisely so staff can keep picking more
    // items in one go; the floating cart bar (cartCount > 0 && !cartOpen)
    // already surfaces the running total, and staff open the cart manually
    // when they're actually done.
  }

  function removeCartItem(key: string) {
    setCart((prev) => prev.filter((i) => itemKey(i) !== key));
  }

  function openBundlePicker(bundle: Bundle) {
    setBundlePickerTarget(bundle);
    setChosenVariants({});
    setBundleQty(1);
  }

  function isBundleAvailable(bundle: Bundle): boolean {
    for (const bi of bundle.items) {
      const p = productsEffective.find((x) => x.id === bi.productId);
      if (!p) return false;
      const hasStock = p.trackStock === false || p.variants.some((v) => v.stock >= bi.quantity);
      if (!hasStock) return false;
    }
    return true;
  }

  const allVariantsChosen = bundlePickerTarget !== null &&
    bundlePickerTarget.items.every((item, idx) => {
      const p = productsEffective.find((x) => x.id === item.productId);
      if (!p) return false;
      if (p.variants.length === 1) return true;
      return !!chosenVariants[idx];
    });

  // Most units of this bundle configuration buildable from what's left in
  // stock right now (after subtracting what's already reserved in the cart).
  function computeMaxBundleQty(): number {
    if (!bundlePickerTarget) return 0;
    let max = Infinity;
    bundlePickerTarget.items.forEach((item, idx) => {
      const p = productsEffective.find((x) => x.id === item.productId);
      if (p?.trackStock === false) return; // untracked: doesn't constrain the max
      const autoVariant = p?.variants.length === 1 ? p.variants[0] : null;
      const chosen = autoVariant ?? chosenVariants[idx] ?? null;
      const stock = chosen?.stock ?? 0;
      max = Math.min(max, Math.floor(stock / item.quantity));
    });
    return Number.isFinite(max) ? Math.max(0, max) : 0;
  }
  const maxBundleQty = computeMaxBundleQty();

  useEffect(() => {
    setBundleQty((q) => Math.min(Math.max(q, 1), Math.max(maxBundleQty, 1)));
  }, [maxBundleQty]);

  function confirmBundleToCart() {
    if (!bundlePickerTarget) return;
    const bundleItemsWithVariants: BundleItem[] = bundlePickerTarget.items.map((item, idx) => {
      const p = productsEffective.find((x) => x.id === item.productId);
      const auto = p?.variants.length === 1 ? p.variants[0] : null;
      const chosen = auto ?? chosenVariants[idx];
      return { ...item, variantSize: chosen?.size ?? "", variantColor: chosen?.color ?? "" };
    });
    const costPrice = bundleItemsWithVariants.reduce((s, i) => s + (i.costPrice ?? 0) * i.quantity, 0);
    // Fingerprint the chosen sub-variants into the cart's itemKey so two adds
    // of the same bundle with DIFFERENT variant picks get separate cart lines.
    const variantFingerprint = bundleItemsWithVariants
      .map((bi) => `${bi.productId}:${bi.variantSize ?? ""}:${bi.variantColor ?? ""}`)
      .join("|");
    // A single SaleItem can't be split mid-bundle — if ANY component needs
    // the kitchen, route the whole ticket there.
    const needsKitchen = bundleItemsWithVariants.some((bi) => {
      const p = productsEffective.find((x) => x.id === bi.productId);
      return p?.needsKitchen !== false;
    });
    const newItem: SaleItem = {
      productId: bundlePickerTarget.id,
      productName: bundlePickerTarget.name,
      variant: { size: "__bundle__", color: variantFingerprint, stock: 99 },
      quantity: bundleQty,
      originalPrice: bundlePickerTarget.price,
      unitPrice: bundlePickerTarget.price,
      costPrice: costPrice > 0 ? costPrice : undefined,
      isBundle: true,
      bundleItems: bundleItemsWithVariants,
      needsKitchen,
    };
    const key = itemKey(newItem);
    setCart((prev) => {
      const existing = prev.find((i) => itemKey(i) === key);
      if (existing) {
        return prev.map((i) => (itemKey(i) === key ? { ...i, quantity: i.quantity + bundleQty } : i));
      }
      return [...prev, newItem];
    });
    // Same reasoning as handleAddToCart above — stay on the menu instead of
    // popping the cart open, so multiple bundles/items can be added in a row.
    setBundlePickerTarget(null);
  }

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  async function handleSendToKitchen() {
    if (!shopId || !user || cart.length === 0 || !tableLabel.trim()) return;
    setSending(true);
    setError(null);
    try {
      const session = await getOrCreateOpenSession(shopId, tableLabel.trim());
      await createOrder(shopId, cart, session.id, session.tableLabel, user.uid, displayName);
      setTableSession(session);
      setCart([]);
      setCartOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງອໍເດີ້ບໍ່ສຳເລັດ");
    } finally {
      setSending(false);
    }
  }

  const loadHistory = useCallback(async () => {
    if (!shopId || !tableSession) { setHistoryOrders([]); return; }
    setHistoryLoading(true);
    try {
      const orders = await getOrdersBySession(shopId, tableSession.id);
      setHistoryOrders([...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } finally {
      setHistoryLoading(false);
    }
  }, [shopId, tableSession]);

  useEffect(() => {
    // Also re-fires when the cart modal is (re)opened while already on the
    // history tab, so it doesn't show stale data from an earlier visit.
    if (cartOpen && orderView === "history") loadHistory();
  }, [cartOpen, orderView, loadHistory]);

  async function handleShowQr(label: string) {
    if (!shopId || !label.trim()) return;
    setQrBusy(true);
    setError(null);
    setTableError(null);
    try {
      const session = await getOrCreateOpenSession(shopId, label.trim());
      const url = `${window.location.origin}/order/${shopId}/${session.code}`;
      setQrDataUrl(await QRCode.toDataURL(url, { width: 240, margin: 1 }));
      setQrTableLabel(session.tableLabel);
      setQrOpen(true);
    } catch {
      setError("ສ້າງ QR ບໍ່ສຳເລັດ");
    } finally {
      setQrBusy(false);
    }
  }

  // ── Step 1 UI: table list ────────────────────────────────────────────
  if (step === "select-table") {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar className="has-shop-tag">
            <IonButtons slot="start">
              <IonMenuButton autoHide={false} />
            </IonButtons>
            <div slot="start"><ShopHeaderTag /></div>
            <IonTitle>ເລືອກໂຕະ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleManualRefresh} disabled={tablesLoading}>
                {tablesLoading
                  ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} />
                  : <IonIcon slot="icon-only" icon={refreshOutline} />
                }
              </IonButton>
              <IonButton routerLink="/tabs/manage-tables">
                <IonIcon slot="icon-only" icon={settingsOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonRefresher slot="fixed" onIonRefresh={handleTablesRefresh}>
            <IonRefresherContent />
          </IonRefresher>

          {/* Sticky: search + zone/status filters stay put while the tile
              grid below scrolls, instead of scrolling away with it. */}
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--ion-background-color)" }}>
            <div style={{ padding: "12px 16px 10px" }}>
              <IonSearchbar
                value={tableSearch}
                onIonInput={(e) => setTableSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາຊື່ໂຕະ ຫຼື ໂຊນ"
                style={{ padding: 0 }}
              />
            </div>

            {zones.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 10px", scrollbarWidth: "none" }}>
                {["all", ...zones].map((z) => {
                  const isActive = activeZone === z;
                  return (
                    <button
                      key={z}
                      onClick={() => setActiveZone(z)}
                      style={{
                        flexShrink: 0, padding: "6px 16px", borderRadius: 24,
                        border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                        background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                        color: isActive ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                        fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {z === "all" ? `ທັງໝົດ (${searchFiltered.length})` : `${z} (${zoneCounts.get(z) ?? 0})`}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 10px", scrollbarWidth: "none" }}>
              {STATUS_FILTERS.map(({ value, label }) => {
                const isActive = activeStatusFilter === value;
                return (
                  <button
                    key={value}
                    onClick={() => setActiveStatusFilter(value)}
                    style={{
                      flexShrink: 0, padding: "6px 16px", borderRadius: 24,
                      border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                      background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                      color: isActive ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                      fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {label} ({statusCounts[value]})
                  </button>
                );
              })}
            </div>
          </div>

          {tablesLoading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          )}
          {!tablesLoading && allTiles.length === 0 && (
            <EmptyState icon="🪑" title="ຍັງບໍ່ມີໂຕະ" subtitle="ກົດໄອຄອນຕັ້ງຄ່າດ້ານເທິງເພື່ອເພີ່ມລາຍການໂຕະ" />
          )}
          {!tablesLoading && allTiles.length > 0 && visibleTiles.length === 0 && (
            <EmptyState icon="🚫" title="ບໍ່ມີໂຕະໃນໂຊນທີ່ທ່ານໄດ້ຮັບອະນຸຍາດ" subtitle={`ອະນຸຍາດສະເພາະ: ${allowedZones.join(", ") || "ບໍ່ມີ"}`} />
          )}
          {!tablesLoading && visibleTiles.length > 0 && tiles.length === 0 && (
            <EmptyState icon="🔍" title="ບໍ່ພົບໂຕະທີ່ຄົ້ນຫາ" />
          )}

          {!tablesLoading && tiles.length > 0 && (
            <div style={{ padding: "0 10px 8px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {tiles.map((tile) => {
                const s = STATUS_LABEL[tile.status];
                return (
                  <div key={tableDisplayLabel(tile.label, tile.zone)} style={{
                    background: s.bg, borderRadius: 12, border: `1.5px solid ${s.color}`,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)", overflow: "hidden",
                  }}>
                    <div
                      role="button"
                      onClick={() => selectTable(tableDisplayLabel(tile.label, tile.zone))}
                      style={{ padding: "8px 4px 5px", textAlign: "center", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 2 }}>🪑</div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: "0.68rem", color: "var(--ion-text-color)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tile.label}{tile.physicalTables != null && tile.physicalTables > 1 ? " 🔗" : ""}
                      </p>
                      <p style={{
                        margin: "3px 0 0", fontSize: "0.5rem", fontWeight: 800, color: s.color,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {s.text}
                      </p>
                      {tile.qty > 0 ? (
                        <p style={{ margin: "2px 0 0", fontSize: "0.52rem", color: "var(--app-text-secondary)" }}>
                          {tile.qty} ລາຍການ
                        </p>
                      ) : tile.seats ? (
                        <p style={{ margin: "2px 0 0", fontSize: "0.52rem", color: "var(--app-text-secondary)" }}>
                          {tile.seats} ບ່ອນນັ່ງ
                        </p>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", borderTop: `1px solid ${s.color}`, background: "var(--ion-item-background, #fff)" }}>
                      <button
                        onClick={() => handleShowQr(tableDisplayLabel(tile.label, tile.zone))}
                        disabled={qrBusy}
                        style={{
                          flex: 1, minHeight: 30, background: "none", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ion-color-primary)",
                          fontSize: "0.72rem",
                          borderRight: tile.status === "empty" && tile.session ? "1px solid var(--app-border)" : "none",
                        }}
                      >
                        <IonIcon icon={qrCodeOutline} />
                      </button>
                      {tile.status === "empty" && tile.session && (
                        <button
                          onClick={() => setDeleteTarget({ session: tile.session!, qty: tile.qty, status: "empty" })}
                          style={{
                            flex: 1, minHeight: 30, background: "none", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--app-danger)",
                            fontSize: "0.72rem",
                          }}
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tableError && (
            <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", padding: "0 16px 16px" }}>{tableError}</p>
          )}
        </IonContent>

        <IonAlert
          isOpen={!!deleteTarget}
          header="ລຶບໂຕະ"
          message={`ຕ້ອງການລຶບ "ໂຕະ ${deleteTarget?.session.tableLabel}" ແມ່ນບໍ່? (ຍັງບໍ່ມີອໍເດີ້)`}
          buttons={[
            { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
            { text: deletingTable ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDeleteTable },
          ]}
          onDidDismiss={() => setDeleteTarget(null)}
        />

        {/* QR for a table — customer scans to order from their own phone */}
        <IonModal isOpen={qrOpen} onDidDismiss={() => setQrOpen(false)}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #qr-print-area, #qr-print-area * { visibility: visible; }
              #qr-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
            }
          `}</style>
          <IonHeader className="ion-no-print">
            <IonToolbar>
              <IonTitle style={{ fontSize: "1rem" }}>QR ໂຕະ {qrTableLabel}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setQrOpen(false)}>ປິດ</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div id="qr-print-area" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
              <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: "1.1rem" }}>ໂຕະ {qrTableLabel}</p>
              {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 12, border: "1px solid var(--app-border)" }} />}
              <p style={{ marginTop: 16, fontSize: "0.82rem", color: "var(--app-text-secondary)", textAlign: "center" }}>
                ໃຫ້ລູກຄ້າສະແກນເພື່ອສັ່ງເມນູເອງໄດ້ຈາກມືຖື
              </p>
              <IonButton
                className="ion-no-print" fill="outline" expand="block" onClick={() => window.print()}
                style={{ "--border-radius": "10px", marginTop: 16, width: "100%" }}
              >
                <IonIcon slot="start" icon={printOutline} />
                ພິມ QR
              </IonButton>
            </div>
          </IonContent>
        </IonModal>
      </IonPage>
    );
  }

  // ── Step 2 UI: menu + cart for the chosen table ─────────────────────────
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
            <IonButton onClick={backToTables}>
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>ໂຕະ {tableLabel}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Sticky: both the type tab row (ເມນູທົ່ວໄປ/ຊຸດ/ໂປຣໂມຊັນ) and the
            category chips below it stay put together while the grid
            scrolls — a single sticky wrapper so they stick as one unit
            instead of the category row alone sticking to the very top and
            covering the type row as it scrolls out of flow. */}
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--ion-background-color)" }}>
          <div style={{ padding: "10px 12px 0" }}>
            <IonSearchbar
              value={menuSearch}
              onIonInput={(e) => setMenuSearch(e.detail.value ?? "")}
              placeholder="ຄົ້ນຫາເມນູ"
              style={{ padding: 0 }}
            />
          </div>

          {/* Tab: ເມນູທົ່ວໄປ / ຊຸດ / ໂປຣໂມຊັນ */}
          <div style={{ display: "flex", padding: "10px 12px 4px", gap: 8 }}>
            {(["regular", "bundle", "promotion"] as const).map((tab) => {
              const active = menuTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => { setMenuTab(tab); setActiveCategory("all"); }}
                  style={{
                    padding: "7px 16px", borderRadius: 24, fontWeight: 700, fontSize: "0.82rem",
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                    background: active ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                    color: active ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                    boxShadow: active ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                  }}
                >
                  {tab === "regular" ? "ເມນູທົ່ວໄປ" : tab === "bundle" ? "🎁 ຊຸດ" : "🏷️ ໂປຣໂມຊັນ"}
                </button>
              );
            })}
          </div>

          {menuTab !== "bundle" && categories.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "6px 12px 6px", scrollbarWidth: "none" }}>
              {["all", ...categories].map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      flexShrink: 0, padding: "7px 18px", borderRadius: 24,
                      border: `1.5px solid ${isActive ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                      background: isActive ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                      color: isActive ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                      fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                      boxShadow: isActive ? "0 2px 8px rgba(224,123,57,0.3)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {cat === "all" ? "ທັງໝົດ" : cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}

        {/* ── ເມນູທົ່ວໄປ / ໂປຣໂມຊັນ tabs ── */}
        {menuTab !== "bundle" && !loading && typeFiltered.length === 0 && (
          <EmptyState icon={menuTab === "promotion" ? "🏷️" : "🍽️"} title={menuTab === "promotion" ? "ຍັງບໍ່ມີໂປຣໂມຊັນ" : "ຍັງບໍ່ມີເມນູ"} />
        )}
        {menuTab !== "bundle" && !loading && typeFiltered.length > 0 && filtered.length === 0 && (
          <EmptyState icon="🔍" title={searchQ ? "ບໍ່ພົບເມນູທີ່ຄົ້ນຫາ" : "ບໍ່ມີເມນູໃນໝວດນີ້"} />
        )}

        {menuTab !== "bundle" && !loading && filtered.length > 0 && (
          <IonGrid style={{ padding: "12px 8px" }}>
            <IonRow>
              {filtered.map((p) => {
                const tracked = p.trackStock !== false;
                const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                const outOfStock = tracked && totalStock === 0;
                const prices = p.variants.map((v) => v.price ?? p.price ?? 0);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                return (
                  <IonCol key={p.id} size="6" sizeMd="4" sizeLg="3" style={{ padding: 6 }}>
                    <button
                      disabled={outOfStock}
                      onClick={() => setPickerProduct(p)}
                      style={{
                        width: "100%", minHeight: 140, borderRadius: 16, border: "none",
                        background: outOfStock ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #ffffff)",
                        boxShadow: outOfStock ? "none" : "0 3px 14px rgba(224,123,57,0.14)",
                        padding: "14px 12px",
                        cursor: outOfStock ? "not-allowed" : "pointer",
                        opacity: outOfStock ? 0.55 : 1, textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: 38, marginBottom: 6, lineHeight: 1 }}>
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                          : p.color
                          ? <div style={{ width: 44, height: 44, borderRadius: 8, background: p.color }} />
                          : "🍽️"
                        }
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)", marginBottom: 3, lineHeight: 1.3 }}>
                        {p.name}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ion-color-primary)", marginBottom: 4 }}>
                        {minP === maxP ? `${fmtK(minP)} ກີບ` : `${fmtK(minP)}–${fmtK(maxP)} ກີບ`}
                      </div>
                      <div style={{
                        display: "inline-block", fontSize: "0.72rem", fontWeight: 600,
                        padding: "2px 8px", borderRadius: 20,
                        background: !tracked ? "rgba(107,114,128,0.12)" : outOfStock ? "rgba(220,38,38,0.12)" : "rgba(22,163,74,0.12)",
                        color: !tracked ? "var(--app-text-muted)" : outOfStock ? "var(--app-danger)" : "var(--app-success)",
                      }}>
                        {!tracked ? "ບໍ່ຈຳກັດ" : outOfStock ? "ໝົດ" : `${totalStock} ຈານ`}
                      </div>
                    </button>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}

        {/* ── ຊຸດ (bundle) tab ── */}
        {menuTab === "bundle" && !loading && bundles.length === 0 && (
          <EmptyState icon="🎁" title="ຍັງບໍ່ມີຊຸດ — ສ້າງໄດ້ທີ່ໜ້າເມນູ" />
        )}
        {menuTab === "bundle" && !loading && bundles.length > 0 && filteredBundles.length === 0 && (
          <EmptyState icon="🔍" title="ບໍ່ພົບຊຸດທີ່ຄົ້ນຫາ" />
        )}
        {menuTab === "bundle" && !loading && filteredBundles.length > 0 && (
          <IonGrid style={{ padding: "12px 8px" }}>
            <IonRow>
              {filteredBundles.map((b) => {
                const available = isBundleAvailable(b);
                return (
                  <IonCol key={b.id} size="6" sizeMd="4" sizeLg="3" style={{ padding: 6 }}>
                    <button
                      disabled={!available}
                      onClick={() => openBundlePicker(b)}
                      style={{
                        width: "100%", minHeight: 140, borderRadius: 16, border: "none",
                        background: !available ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #ffffff)",
                        boxShadow: !available ? "none" : "0 3px 14px rgba(224,123,57,0.14)",
                        padding: "14px 12px",
                        cursor: !available ? "not-allowed" : "pointer",
                        opacity: !available ? 0.55 : 1, textAlign: "left",
                        transition: "box-shadow 0.1s",
                      }}
                    >
                      <div style={{ fontSize: 34, marginBottom: 6, lineHeight: 1 }}>
                        {b.photoUrl
                          ? <img src={b.photoUrl} alt={b.name} loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                          : "🎁"
                        }
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)", marginBottom: 3, lineHeight: 1.3 }}>
                        {b.name}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ion-color-primary)", marginBottom: 4 }}>
                        {fmtK(b.price)} ກີບ
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--app-text-secondary)", lineHeight: 1.4 }}>
                        {b.items.map((i) => `${i.productName} ×${i.quantity}`).join(" + ")}
                      </div>
                      {!available && (
                        <div style={{
                          display: "inline-block", marginTop: 4,
                          fontSize: "0.68rem", fontWeight: 700,
                          padding: "2px 8px", borderRadius: 20,
                          background: "var(--app-danger-surface)", color: "var(--app-danger)",
                        }}>
                          ເມນູໝົດ
                        </div>
                      )}
                    </button>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}
      </IonContent>

      <VariantPicker product={pickerProduct} isOpen={!!pickerProduct} onAdd={handleAddToCart} onDismiss={() => setPickerProduct(null)} confirmLabel="ເພີ່ມຫຼາຍລາຍການ" />

      {/* ── Bundle variant picker ── */}
      <IonModal
        isOpen={!!bundlePickerTarget}
        onDidDismiss={() => setBundlePickerTarget(null)}
        initialBreakpoint={1}
        breakpoints={[0, 1]}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>🎁 {bundlePickerTarget?.name}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setBundlePickerTarget(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <div style={{ padding: "8px 16px 24px" }}>
            <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
              ເລືອກ variant ໃຫ້ແຕ່ລະເມນູໃນຊຸດ
            </p>
            {bundlePickerTarget?.items.map((item, idx) => {
              const p = productsEffective.find((x) => x.id === item.productId);
              const autoVariant = p?.variants.length === 1 ? p.variants[0] : null;
              const chosen = autoVariant ?? chosenVariants[idx] ?? null;
              return (
                <div key={idx} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>
                      {item.productName} ×{item.quantity}
                    </span>
                    {chosen && (
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-primary)", fontWeight: 700 }}>
                        {chosen.size}{chosen.color ? ` / ${chosen.color}` : ""}
                      </span>
                    )}
                  </div>
                  {autoVariant ? (
                    <div style={{
                      fontSize: "0.78rem", color: "var(--app-text-secondary)", padding: "8px 12px",
                      background: "var(--app-success-surface)", borderRadius: 8, border: "1px solid #bbf7d0",
                    }}>
                      ✓ {autoVariant.size}{autoVariant.color ? ` / ${autoVariant.color}` : ""} (ອັດຕະໂນມັດ)
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {p?.variants.map((v, vi) => {
                        const isChosen = chosenVariants[idx]?.size === v.size && chosenVariants[idx]?.color === v.color;
                        const outOfStock = p.trackStock !== false && v.stock < item.quantity * bundleQty;
                        return (
                          <button
                            key={vi}
                            disabled={outOfStock}
                            onClick={() => setChosenVariants((prev) => ({ ...prev, [idx]: v }))}
                            style={{
                              padding: "7px 14px", borderRadius: 20,
                              cursor: outOfStock ? "not-allowed" : "pointer",
                              border: `1.5px solid ${isChosen ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                              background: isChosen ? "var(--ion-color-primary)" : outOfStock ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                              color: isChosen ? "#fff" : outOfStock ? "var(--ion-color-medium, var(--app-text-muted))" : "var(--ion-text-color, var(--ion-text-color))",
                              fontWeight: 600, fontSize: "0.85rem",
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {isChosen && <IonIcon icon={checkmarkOutline} style={{ fontSize: 14 }} />}
                            {v.size}{v.color ? `/${v.color}` : ""}
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                              {p.trackStock === false ? "" : outOfStock ? " ໝົດ" : ` (${v.stock})`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </IonContent>

        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
            {allVariantsChosen && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-text-color)" }}>
                  ຈຳນວນຊຸດ {maxBundleQty > 0 && <span style={{ color: "var(--app-text-secondary)", fontWeight: 400 }}>(ເຫຼືອເຮັດໄດ້ {maxBundleQty} ຊຸດ)</span>}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setBundleQty((q) => Math.max(1, q - 1))}
                    disabled={bundleQty <= 1}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: "1.5px solid var(--ion-color-step-150, var(--app-border))",
                      background: bundleQty <= 1 ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: bundleQty <= 1 ? "not-allowed" : "pointer",
                      color: bundleQty <= 1 ? "var(--ion-color-step-300, #d4d4d0)" : "var(--ion-text-color)",
                    }}
                  >
                    <IonIcon icon={removeOutline} style={{ fontSize: 18 }} />
                  </button>
                  <span style={{ minWidth: 28, textAlign: "center", fontSize: "1.1rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
                    {bundleQty}
                  </span>
                  <button
                    onClick={() => setBundleQty((q) => Math.min(maxBundleQty, q + 1))}
                    disabled={bundleQty >= maxBundleQty}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: `1.5px solid ${bundleQty >= maxBundleQty ? "var(--ion-color-step-150, var(--app-border))" : "var(--ion-color-primary)"}`,
                      background: bundleQty >= maxBundleQty ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-color-primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: bundleQty >= maxBundleQty ? "not-allowed" : "pointer",
                      color: bundleQty >= maxBundleQty ? "#d4d4d0" : "#fff",
                    }}
                  >
                    <IonIcon icon={addOutline} style={{ fontSize: 18 }} />
                  </button>
                </div>
              </div>
            )}
            <IonButton
              expand="block"
              disabled={!allVariantsChosen || maxBundleQty === 0}
              onClick={confirmBundleToCart}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              {!allVariantsChosen ? "ເລືອກ variant ໃຫ້ຄົບກ່ອນ" : maxBundleQty === 0 ? "ເມນູໝົດ" : `ເພີ່ມໃສ່ອໍເດີ້ · ${fmtK((bundlePickerTarget?.price ?? 0) * bundleQty)} ກີບ`}
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      {cartCount > 0 && !cartOpen && (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 20 }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: "100%", padding: "14px 18px", borderRadius: 16, border: "none",
              background: "var(--ion-color-primary)", display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: "0 6px 20px rgba(224,123,57,0.4)", cursor: "pointer",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.95rem" }}>🧾 {cartCount} ລາຍການ — {fmtK(cartTotal)} ກີບ</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>ເບິ່ງອໍເດີ້ ›</span>
          </button>
        </div>
      )}

      <IonModal isOpen={cartOpen} onDidDismiss={() => setCartOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ອໍເດີ້ໂຕະ {tableLabel}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setCartOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {/* ເພີ່ມໃໝ່ (what's staged, not sent yet) vs ປະຫວັດການສັ່ງ (tickets
              already confirmed/sent for this table) */}
          <div style={{ display: "flex", padding: "12px 16px 0", gap: 8 }}>
            {(["new", "history"] as const).map((v) => {
              const active = orderView === v;
              return (
                <button
                  key={v}
                  onClick={() => setOrderView(v)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, fontWeight: 700, fontSize: "0.86rem",
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                    background: active ? "var(--ion-color-primary)" : "var(--ion-item-background, #ffffff)",
                    color: active ? "#ffffff" : "var(--ion-text-color, var(--app-text-secondary))",
                  }}
                >
                  {v === "new" ? "ເພີ່ມໃໝ່" : "ປະຫວັດການສັ່ງ"}
                </button>
              );
            })}
          </div>

          {orderView === "new" && (
          <div style={{ padding: "12px 16px" }}>
            {cart.length === 0 ? (
              <EmptyState icon="🧾" title="ຍັງບໍ່ມີລາຍການ" />
            ) : cart.map((item) => {
              const key = itemKey(item);
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--app-border)" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)", display: "flex", alignItems: "center", gap: 6 }}>
                      {item.productName} ×{item.quantity}
                      {item.isBundle && (
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "var(--app-accent-surface)", color: "var(--ion-color-primary)" }}>
                          ຊຸດ
                        </span>
                      )}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                      {item.isBundle
                        ? (item.bundleItems ?? []).map((bi) => `${bi.productName}${bi.variantSize ? ` (${bi.variantSize}${bi.variantColor ? `/${bi.variantColor}` : ""})` : ""}`).join(", ")
                        : `${item.variant.size}${item.variant.color ? ` / ${item.variant.color}` : ""}`
                      } — {fmtK(item.unitPrice * item.quantity)} ກີບ
                    </p>
                  </div>
                  <button onClick={() => removeCartItem(key)} style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>
              );
            })}

            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.85rem", marginTop: 12 }}>{error}</p>}
          </div>
          )}

          {orderView === "history" && (
            <div style={{ padding: "12px 16px 28px" }}>
              {historyLoading && (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              )}
              {!historyLoading && historyOrders.length === 0 && (
                <EmptyState icon="🧾" title="ຍັງບໍ່ມີປະຫວັດການສັ່ງ" subtitle="ອໍເດີ້ທີ່ຢືນຢັນຈັດຕຽມແລ້ວຈະສະແດງຢູ່ນີ້" />
              )}
              {!historyLoading && historyOrders.map((o) => {
                const cfg = ORDER_STATUS_LABEL[o.status];
                const qty = o.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={o.id} style={{
                    border: "1px solid var(--app-border)", borderRadius: 12, padding: "12px 14px", marginBottom: 10,
                    background: "var(--app-surface)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{
                        fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        color: cfg.color, background: cfg.bg,
                      }}>
                        {cfg.text}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                        {o.createdAt.toLocaleTimeString("lo-LA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {o.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "0.85rem" }}>
                        <span style={{ color: "var(--ion-text-color)" }}>
                          {it.productName}
                          {!it.isBundle && it.variant.size ? ` (${it.variant.size}${it.variant.color ? `/${it.variant.color}` : ""})` : ""}
                          {" "}×{it.quantity}
                        </span>
                        <span style={{ color: "var(--app-text-secondary)", fontWeight: 600 }}>{fmtK(it.unitPrice * it.quantity)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--app-border)" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>ລວມ {qty} ລາຍການ</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>{fmtK(o.total)} ກີບ</span>
                    </div>
                    {o.status === "cancelled" && o.cancelReason && (
                      <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--app-danger)" }}>ເຫດຜົນ: {o.cancelReason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </IonContent>
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: "0.9rem", fontWeight: 700 }}>
              <span style={{ color: "var(--app-text-secondary)" }}>ລວມ</span>
              <span style={{ color: "var(--ion-color-primary)" }}>{fmtK(cartTotal)} ກີບ</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <IonButton
                expand="block"
                disabled={cart.length === 0 || sending}
                onClick={handleSendToKitchen}
                style={{ flex: 1, minHeight: 52, "--border-radius": "14px", margin: 0 }}
              >
                {sending
                  ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງສົ່ງ...</span>)
                  : "ຢືນຢັນຈັດຕຽມອໍເດີ"
                }
              </IonButton>
              <IonButton
                fill="outline" onClick={() => setCartOpen(false)}
                style={{ flexShrink: 0, minHeight: 52, "--border-radius": "14px", margin: 0, "--padding-start": "12px", "--padding-end": "14px" }}
              >
                <IonIcon slot="start" icon={addOutline} />
                ເພີ່ມອີກ
              </IonButton>
            </div>
          </div>
        </IonFooter>
      </IonModal>
    </IonPage>
  );
};

export default TakeOrder;
