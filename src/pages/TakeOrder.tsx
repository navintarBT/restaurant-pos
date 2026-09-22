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
import { trashOutline, qrCodeOutline, addOutline, chevronBackOutline, printOutline, settingsOutline, refreshOutline } from "ionicons/icons";
import QRCode from "qrcode";
import { fmtK } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import { createOrder, getOrdersBySession } from "../data/saleRepository";
import { getOrCreateOpenSession, getOpenSessions, closeSession } from "../data/tableSessionRepository";
import { getTableRoster, tableDisplayLabel, type TableRosterEntry } from "../data/shopRepository";
import VariantPicker from "../components/VariantPicker";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { Product, ProductVariant, SaleItem, TableSession } from "../data/types";

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

const TakeOrder: React.FC = () => {
  const { shopId, user, displayName } = useAuth();

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
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [tableLabel, setTableLabel] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const zones = [...new Set(roster.map((r) => r.zone).filter(Boolean) as string[])];

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
  const searchFiltered = allTiles.filter((t) => {
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
      setProducts(await getProducts(shopId));
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
  const reserved = new Map<string, number>();
  for (const item of cart) {
    const k = itemKey(item);
    reserved.set(k, (reserved.get(k) ?? 0) + item.quantity);
  }
  const productsEffective = products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      const inCart = reserved.get(`${p.id}__${v.size}__${v.color}`) ?? 0;
      return inCart > 0 ? { ...v, stock: Math.max(0, v.stock - inCart) } : v;
    }),
  }));

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];
  const filtered = activeCategory === "all" ? productsEffective : productsEffective.filter((p) => p.category === activeCategory);

  function handleAddToCart(items: { variant: ProductVariant; quantity: number }[]) {
    if (!pickerProduct) return;
    items.forEach(({ variant, quantity }) => {
      const newItem: SaleItem = {
        productId: pickerProduct.id,
        productName: pickerProduct.name,
        variant,
        quantity,
        originalPrice: pickerProduct.price,
        unitPrice: pickerProduct.price,
        costPrice: pickerProduct.costPrice,
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
    setCartOpen(true);
  }

  function removeCartItem(key: string) {
    setCart((prev) => prev.filter((i) => itemKey(i) !== key));
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
      setCart([]);
      setCartOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງອໍເດີ້ບໍ່ສຳເລັດ");
    } finally {
      setSending(false);
    }
  }

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
          {!tablesLoading && allTiles.length > 0 && tiles.length === 0 && (
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
          <IonButtons slot="end">
            <IonButton disabled={qrBusy} onClick={() => handleShowQr(tableLabel)}>
              {qrBusy ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : <IonIcon slot="icon-only" icon={qrCodeOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {categories.length > 0 && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px 6px", scrollbarWidth: "none",
            position: "sticky", top: 0, zIndex: 5, background: "var(--ion-background-color)",
          }}>
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

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}
        {!loading && products.length === 0 && <EmptyState icon="🍽️" title="ຍັງບໍ່ມີເມນູ" />}
        {!loading && products.length > 0 && filtered.length === 0 && <EmptyState icon="🔍" title="ບໍ່ມີເມນູໃນໝວດນີ້" />}

        {!loading && filtered.length > 0 && (
          <IonGrid style={{ padding: "12px 8px" }}>
            <IonRow>
              {filtered.map((p) => {
                const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                const outOfStock = totalStock === 0;
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
                          : "🍽️"
                        }
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)", marginBottom: 3, lineHeight: 1.3 }}>
                        {p.name}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ion-color-primary)", marginBottom: 4 }}>
                        {fmtK(p.price)} ກີບ
                      </div>
                      <div style={{
                        display: "inline-block", fontSize: "0.72rem", fontWeight: 600,
                        padding: "2px 8px", borderRadius: 20,
                        background: outOfStock ? "rgba(220,38,38,0.12)" : "rgba(22,163,74,0.12)",
                        color: outOfStock ? "var(--app-danger)" : "var(--app-success)",
                      }}>
                        {outOfStock ? "ໝົດ" : `${totalStock} ຈານ`}
                      </div>
                    </button>
                  </IonCol>
                );
              })}
            </IonRow>
          </IonGrid>
        )}
      </IonContent>

      <VariantPicker product={pickerProduct} isOpen={!!pickerProduct} onAdd={handleAddToCart} onDismiss={() => setPickerProduct(null)} />

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
          <div style={{ padding: "12px 16px" }}>
            {cart.length === 0 ? (
              <EmptyState icon="🧾" title="ຍັງບໍ່ມີລາຍການ" />
            ) : cart.map((item) => {
              const key = itemKey(item);
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--app-border)" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{item.productName} ×{item.quantity}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                      {item.variant.size}{item.variant.color ? ` / ${item.variant.color}` : ""} — {fmtK(item.unitPrice * item.quantity)} ກີບ
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

      {/* QR for this table — customer scans to keep ordering from their own phone */}
      <IonModal isOpen={qrOpen} onDidDismiss={() => setQrOpen(false)} initialBreakpoint={0.55} breakpoints={[0, 0.55, 1]}>
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
              ໃຫ້ລູກຄ້າສະແກນເພື່ອສັ່ງເມນູເພີ່ມເອງໄດ້ຈາກມືຖື
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
};

export default TakeOrder;
