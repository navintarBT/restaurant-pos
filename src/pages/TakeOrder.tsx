import { useState, useCallback, useEffect } from "react";
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
  IonInput,
  IonMenuButton,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, qrCodeOutline } from "ionicons/icons";
import QRCode from "qrcode";
import { fmtK } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import { createOrder } from "../data/saleRepository";
import { getOrCreateOpenSession } from "../data/tableSessionRepository";
import VariantPicker from "../components/VariantPicker";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { Product, ProductVariant, SaleItem } from "../data/types";

function itemKey(item: Pick<SaleItem, "productId" | "variant">) {
  return `${item.productId}__${item.variant.size}__${item.variant.color}`;
}

const TakeOrder: React.FC = () => {
  const { shopId, user, displayName } = useAuth();
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

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setProducts(await getProducts(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  // Stock already added to this order isn't reserved server-side yet (that
  // only happens once "ສົ່ງເຂົ້າຄົວ" commits the transaction) — subtract it
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
      setTableLabel("");
      setCartOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງອໍເດີ້ບໍ່ສຳເລັດ");
    } finally {
      setSending(false);
    }
  }

  async function handleShowQr() {
    if (!shopId || !tableLabel.trim()) return;
    setQrBusy(true);
    setError(null);
    try {
      const session = await getOrCreateOpenSession(shopId, tableLabel.trim());
      const url = `${window.location.origin}/order/${shopId}/${session.code}`;
      setQrDataUrl(await QRCode.toDataURL(url, { width: 240, margin: 1 }));
      setQrOpen(true);
    } catch {
      setError("ສ້າງ QR ບໍ່ສຳເລັດ");
    } finally {
      setQrBusy(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ຮັບອໍເດີ້</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Set the table as soon as a customer sits down — before picking any
            menu item — so staff can hand over the QR right away. */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "12px 12px 4px" }}>
          <IonInput
            label="ໂຕະ / ປ້າຍ *" labelPlacement="stacked" placeholder="ເຊັ່ນ: 13"
            value={tableLabel} onIonInput={(e) => setTableLabel(e.detail.value ?? "")}
            fill="outline" style={{ "--border-radius": "10px", flex: 1 }}
          />
          <IonButton
            fill="outline" disabled={!tableLabel.trim() || qrBusy} onClick={handleShowQr}
            style={{ "--border-radius": "10px", height: 44, margin: 0 }}
          >
            {qrBusy ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : <IonIcon slot="icon-only" icon={qrCodeOutline} />}
          </IonButton>
        </div>

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

      <IonModal isOpen={cartOpen} onDidDismiss={() => setCartOpen(false)} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ອໍເດີ້ນີ້</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setCartOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "12px 16px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              padding: "8px 12px", borderRadius: 10, background: "var(--app-accent-surface)",
            }}>
              <span style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>ໂຕະ</span>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--ion-color-primary)" }}>
                {tableLabel || "— ຍັງບໍ່ໄດ້ຕັ້ງ —"}
              </span>
            </div>

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
                  <button onClick={() => removeCartItem(key)} style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", padding: 6 }}>
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
            <IonButton
              expand="block"
              disabled={cart.length === 0 || sending || !tableLabel.trim()}
              onClick={handleSendToKitchen}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              {sending
                ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງສົ່ງ...</span>)
                : "ສົ່ງເຂົ້າຄົວ"
              }
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      {/* QR for this table — customer scans to keep ordering from their own phone */}
      <IonModal isOpen={qrOpen} onDidDismiss={() => setQrOpen(false)} initialBreakpoint={0.55} breakpoints={[0, 0.55, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>QR ໂຕະ {tableLabel}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setQrOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 12, border: "1px solid var(--app-border)" }} />}
            <p style={{ marginTop: 16, fontSize: "0.82rem", color: "var(--app-text-secondary)", textAlign: "center" }}>
              ໃຫ້ລູກຄ້າສະແກນເພື່ອສັ່ງເມນູເພີ່ມເອງໄດ້ຈາກມືຖື
            </p>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default TakeOrder;
