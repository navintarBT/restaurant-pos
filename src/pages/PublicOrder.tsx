import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { signInAnonymously } from "firebase/auth";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonModal,
  IonFooter,
} from "@ionic/react";
import { trashOutline, checkmarkCircleOutline, addOutline, receiptOutline, printOutline } from "ionicons/icons";
import { auth } from "../firebase";
import { fmtK } from "../utils/format";
import { getProducts } from "../data/productRepository";
import { getShopProfile } from "../data/shopRepository";
import { createOrder } from "../data/saleRepository";
import { getSessionByCode } from "../data/tableSessionRepository";
import VariantPicker from "../components/VariantPicker";
import EmptyState from "../components/EmptyState";
import type { Product, ProductVariant, SaleItem, ShopProfile, TableSession } from "../data/types";

function itemKey(item: Pick<SaleItem, "productId" | "variant">) {
  return `${item.productId}__${item.variant.size}__${item.variant.color}`;
}

type PageState = "loading" | "invalid" | "ready";

const PublicOrder: React.FC = () => {
  const { shopId, code } = useParams<{ shopId: string; code: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Everything this customer has submitted this visit — tracked client-side
  // (not re-read from Firestore) so the bill view works without opening up
  // sales reads to anonymous sessions. Resets if they reload the page.
  const [orderedRounds, setOrderedRounds] = useState<{ items: SaleItem[]; total: number; at: Date }[]>([]);
  const [billOpen, setBillOpen] = useState(false);

  const init = useCallback(async () => {
    if (!shopId || !code) return;
    setState("loading");
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const [foundSession, shopProfile, prods] = await Promise.all([
        getSessionByCode(shopId, code),
        getShopProfile(shopId),
        getProducts(shopId),
      ]);
      if (!foundSession) {
        setState("invalid");
        return;
      }
      setSession(foundSession);
      setShop(shopProfile);
      setProducts(prods);
      setState("ready");
    } catch {
      setState("invalid");
    }
  }, [shopId, code]);

  useEffect(() => { init(); }, [init]);

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

  // Every round merged into one itemized bill (same product+variant across
  // rounds is summed into a single line) — this is what the customer sees
  // and can print, not the raw round-by-round submission history.
  const billItems = (() => {
    const map = new Map<string, SaleItem>();
    for (const round of orderedRounds) {
      for (const item of round.items) {
        const key = itemKey(item);
        const existing = map.get(key);
        map.set(key, existing ? { ...existing, quantity: existing.quantity + item.quantity } : { ...item });
      }
    }
    return [...map.values()];
  })();
  const billTotal = orderedRounds.reduce((s, r) => s + r.total, 0);

  async function handleSubmit() {
    if (!shopId || !session || !auth.currentUser || cart.length === 0) return;
    setSending(true);
    setError(null);
    try {
      await createOrder(shopId, cart, session.id, session.tableLabel, auth.currentUser.uid, "ລູກຄ້າ");
      setOrderedRounds((prev) => [...prev, { items: cart, total: cartTotal, at: new Date() }]);
      setCart([]);
      setCartOpen(false);
      setSent(true);
      // Refresh stock so the menu reflects what was just reserved.
      setProducts(await getProducts(shopId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງອໍເດີ້ບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSending(false);
    }
  }

  if (state === "loading") {
    return (
      <IonPage>
        <IonContent>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (state === "invalid") {
    return (
      <IonPage>
        <IonContent>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: 32, gap: 12, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>ລະຫັດນີ້ໃຊ້ບໍ່ໄດ້ແລ້ວ</h2>
            <p style={{ margin: 0, color: "var(--app-text-secondary)", fontSize: "0.85rem" }}>
              ໂຕະນີ້ອາດຈະປິດບິນໄປແລ້ວ — ກະລຸນາສອບຖາມພະນັກງານ
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {shop?.name ?? "ເມນູ"} · ໂຕະ {session?.tableLabel}
          </IonTitle>
          {orderedRounds.length > 0 && (
            <IonButtons slot="end">
              <IonButton onClick={() => setBillOpen(true)}>
                <IonIcon slot="icon-only" icon={receiptOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {sent && (
          <div style={{
            margin: "10px 12px 0", padding: "10px 14px", borderRadius: 12,
            background: "var(--app-success-surface)", border: "1px solid #86efac",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <IonIcon icon={checkmarkCircleOutline} style={{ color: "var(--app-success)", fontSize: 20 }} />
            <span style={{ fontSize: "0.85rem", color: "var(--app-success)", fontWeight: 600 }}>ສົ່ງອໍເດີ້ແລ້ວ — ສັ່ງເພີ່ມໄດ້ຕໍ່</span>
          </div>
        )}

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
                  }}
                >
                  {cat === "all" ? "ທັງໝົດ" : cat}
                </button>
              );
            })}
          </div>
        )}

        {products.length === 0 && <EmptyState icon="🍽️" title="ຍັງບໍ່ມີເມນູ" />}
        {products.length > 0 && filtered.length > 0 && (
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
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>ເບິ່ງກະຕ່າ ›</span>
          </button>
        </div>
      )}

      <IonModal isOpen={cartOpen} onDidDismiss={() => setCartOpen(false)} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ອໍເດີ້ຂອງທ່ານ</IonTitle>
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

            <IonButton
              fill="outline" expand="block" onClick={() => setCartOpen(false)}
              style={{ "--border-radius": "10px", marginTop: 14 }}
            >
              <IonIcon slot="start" icon={addOutline} />
              ເພີ່ມອີກ
            </IonButton>

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
              disabled={cart.length === 0 || sending}
              onClick={handleSubmit}
              style={{ minHeight: 52, "--border-radius": "14px" }}
            >
              {sending
                ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງສົ່ງ...</span>)
                : "ສັ່ງອາຫານ"
              }
            </IonButton>
          </div>
        </IonFooter>
      </IonModal>

      {/* Bill summary — everything ordered this visit, mergeable across rounds, printable */}
      <IonModal isOpen={billOpen} onDidDismiss={() => setBillOpen(false)} initialBreakpoint={0.8} breakpoints={[0, 0.8, 1]}>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #public-bill-print, #public-bill-print * { visibility: visible; }
            #public-bill-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          }
        `}</style>
        <IonHeader className="ion-no-print">
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ບິນ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setBillOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div id="public-bill-print" style={{ padding: "16px 20px 32px" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-text-color)" }}>{shop?.name ?? ""}</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--app-text-secondary)" }}>ໂຕະ {session?.tableLabel}</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-muted)" }}>
                {orderedRounds[0]?.at.toLocaleString("lo-LA")}
              </p>
            </div>

            <div style={{ borderTop: "1px dashed var(--app-border)", borderBottom: "1px dashed var(--app-border)", padding: "10px 0" }}>
              {billItems.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", padding: "5px 0" }}>
                  <span style={{ color: "var(--ion-text-color)" }}>
                    {item.productName}
                    {item.variant.size && item.variant.color !== "__bundle__" ? ` (${item.variant.size}${item.variant.color ? `/${item.variant.color}` : ""})` : ""}
                    {" "}×{item.quantity}
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmtK(item.unitPrice * item.quantity)} ກີບ</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>ລວມທັງໝົດ</span>
              <span style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--ion-color-primary)" }}>{fmtK(billTotal)} ກີບ</span>
            </div>
            <p style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--app-text-muted)", textAlign: "center" }}>
              * ຍັງບໍ່ໄດ້ຊຳລະ — ພະນັກງານຈະເປັນຄົນປິດບິນ
            </p>

            <IonButton
              className="ion-no-print" expand="block" fill="outline" onClick={() => window.print()}
              style={{ "--border-radius": "10px", marginTop: 20 }}
            >
              <IonIcon slot="start" icon={printOutline} />
              ພິມບິນ
            </IonButton>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default PublicOrder;
