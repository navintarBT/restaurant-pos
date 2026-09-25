import { useEffect, useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonCheckbox,
} from "@ionic/react";
import { addOutline, removeOutline, checkmarkOutline } from "ionicons/icons";
import type { Product, ProductVariant } from "../data/types";
import { getToppings, type ToppingEntry } from "../data/shopRepository";
import { fmtK } from "../utils/format";

interface PickedItem {
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  selectedFlavors?: string[];
  selectedToppings?: string[];
}

interface Props {
  product: Product | null;
  isOpen: boolean;
  shopId?: string;
  onAdd: (items: PickedItem[]) => void;
  onDismiss: () => void;
  // Text on the confirm button once at least 1 item is picked — defaults to
  // "add to cart" wording; TakeOrder.tsx overrides it to "add several
  // items" since confirming there returns to the menu grid to keep picking,
  // rather than opening the cart.
  confirmLabel?: string;
}

function variantKey(v: ProductVariant) {
  return `${v.size}|${v.color}`;
}

function variantPrice(v: ProductVariant, product: Product): number {
  return v.price ?? product.price ?? 0;
}

const VariantPicker: React.FC<Props> = ({ product, isOpen, shopId, onAdd, onDismiss, confirmLabel = "ເພີ່ມໃສ່ກະຕ່າ" }) => {
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [shopToppings, setShopToppings] = useState<ToppingEntry[]>([]);

  function handleOpen() {
    setQtys({});
    setSelectedFlavors([]);
    setSelectedToppings([]);
  }

  useEffect(() => {
    if (isOpen && shopId && product?.hasToppings) {
      getToppings(shopId).then(setShopToppings).catch(() => {});
    }
  }, [isOpen, shopId, product?.hasToppings]);

  function toggleFlavor(name: string) {
    if (!product) return;
    const max = product.maxFlavors || 1;
    setSelectedFlavors((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (max === 1) return [name]; // single-pick: replaces, not adds
      if (prev.length >= max) return prev; // multi-pick: cap reached, ignore
      return [...prev, name];
    });
  }

  function toggleTopping(name: string) {
    if (!product) return;
    const max = product.maxToppings;
    setSelectedToppings((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (max && prev.length >= max) return prev;
      return [...prev, name];
    });
  }

  function setQty(v: ProductVariant, delta: number, cap: number) {
    const key = variantKey(v);
    setQtys((prev) => {
      const next = Math.max(0, Math.min(cap, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  }

  function handleAdd() {
    if (!product) return;
    const items = sellable
      .filter((v) => (qtys[variantKey(v)] ?? 0) > 0)
      .map((v) => ({
        variant: v,
        quantity: qtys[variantKey(v)],
        unitPrice: variantPrice(v, product) + toppingSurcharge,
        costPrice: v.costPrice ?? product.costPrice,
        selectedFlavors: product.hasFlavors ? selectedFlavors : undefined,
        selectedToppings: product.hasToppings && selectedToppings.length > 0 ? selectedToppings : undefined,
      }));
    if (items.length === 0) return;
    onAdd(items);
    onDismiss();
  }

  if (!product) return null;

  const tracked = product.trackStock !== false;
  // Variants marked inactive (item 16) aren't orderable at all.
  const sellable = product.variants.filter((v) => v.status !== "inactive");

  const toppingSurcharge = selectedToppings.reduce(
    (s, name) => s + (shopToppings.find((t) => t.name === name)?.price ?? 0), 0
  );

  const totalQty = Object.values(qtys).reduce((s, q) => s + q, 0);
  const totalPrice = sellable.reduce((s, v) => s + (qtys[variantKey(v)] ?? 0) * (variantPrice(v, product) + toppingSurcharge), 0);

  const prices = sellable.map((v) => variantPrice(v, product));
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;

  // Only actually blocking if there's something to pick — "hasFlavors: true"
  // with an empty flavors list would otherwise permanently disable Add with
  // no visible section to satisfy it.
  const flavorsMissing = !!product.hasFlavors && (product.flavors?.length ?? 0) > 0 && selectedFlavors.length === 0;

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      onWillPresent={handleOpen}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>{product.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "12px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--ion-color-primary)" }}>
            {minP === maxP ? `${fmtK(minP)} ກີບ / ຊິ້ນ` : `${fmtK(minP)}–${fmtK(maxP)} ກີບ / ຊິ້ນ`}
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
            ເລືອກໄດ້ຫຼາຍ variant
          </span>
        </div>

        {/* ── Flavor (required, capped at product.maxFlavors, default 1) ── */}
        {product.hasFlavors && product.flavors && product.flavors.length > 0 && (
          <div style={{ padding: "8px 16px 4px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
              ລົດຊາດ * {(product.maxFlavors || 1) > 1 && (
                <span style={{ fontWeight: 400, color: "var(--app-text-secondary)" }}>
                  (ເລືອກໄດ້ {selectedFlavors.length}/{product.maxFlavors})
                </span>
              )}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {product.flavors.map((f) => {
                const active = selectedFlavors.includes(f);
                const disabled = !active && (product.maxFlavors || 1) > 1 && selectedFlavors.length >= (product.maxFlavors || 1);
                return (
                  <button
                    key={f}
                    disabled={disabled}
                    onClick={() => toggleFlavor(f)}
                    style={{
                      padding: "8px 16px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 700,
                      cursor: disabled ? "not-allowed" : "pointer",
                      border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                      background: active ? "var(--ion-color-primary)" : disabled ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                      color: active ? "#fff" : disabled ? "var(--ion-color-step-300, #d4d4d0)" : "var(--ion-text-color)",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {active && <IonIcon icon={checkmarkOutline} style={{ fontSize: 14 }} />}
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Toppings (optional, capped at product.maxToppings, undefined = unlimited) ── */}
        {product.hasToppings && product.toppingNames && product.toppingNames.length > 0 && (
          <div style={{ padding: "8px 16px 4px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
              ທັອບປິ້ງ {product.maxToppings && (
                <span style={{ fontWeight: 400, color: "var(--app-text-secondary)" }}>
                  (ເລືອກໄດ້ {selectedToppings.length}/{product.maxToppings})
                </span>
              )}
            </p>
            {product.toppingNames.map((name) => {
              const entry = shopToppings.find((t) => t.name === name);
              const active = selectedToppings.includes(name);
              const disabled = !active && !!product.maxToppings && selectedToppings.length >= product.maxToppings;
              return (
                <div
                  key={name}
                  onClick={() => { if (!disabled) toggleTopping(name); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10,
                    marginBottom: 6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
                    border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    background: active ? "var(--app-accent-surface)" : "var(--ion-item-background, #fff)",
                  }}
                >
                  <IonCheckbox checked={active} disabled={disabled} onIonChange={() => toggleTopping(name)} onClick={(e) => e.stopPropagation()} />
                  <span style={{ flex: 1, fontSize: "0.88rem", fontWeight: 600, color: "var(--ion-text-color)" }}>{name}</span>
                  {entry?.price != null && entry.price > 0 && (
                    <span style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)", fontWeight: 700 }}>+{fmtK(entry.price)} ກີບ</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: "8px 16px 16px" }}>
          {sellable.map((v, i) => {
            const key = variantKey(v);
            const qty = qtys[key] ?? 0;
            const cap = tracked ? v.stock : Infinity;
            const outOfStock = tracked && v.stock === 0;
            const selected = qty > 0;
            const price = variantPrice(v, product);
            // Live remaining after what's currently dialed in on the +/- stepper
            // or typed into the qty box — not just the raw stock number — so
            // the seller can see at a glance how much is left as they select.
            const remaining = v.stock - qty;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  border: `2px solid ${selected ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
                  background: selected ? "rgba(224,123,57,0.06)" : outOfStock ? "var(--ion-color-step-50, var(--app-surface-alt))" : "var(--ion-item-background, #ffffff)",
                  opacity: outOfStock ? 0.5 : 1,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Left: variant info */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ion-text-color, var(--ion-text-color))" }}>
                    {v.size}{v.color ? ` / ${v.color}` : ""}
                  </div>
                  {minP !== maxP && (
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ion-color-primary)", marginTop: 2 }}>
                      {fmtK(price)} ກີບ
                    </div>
                  )}
                  {tracked ? (
                    <div style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: "0.72rem", fontWeight: 600,
                      padding: "2px 8px", borderRadius: 20,
                      background: outOfStock ? "rgba(220,38,38,0.12)" : remaining <= (product.reorderPoint ?? 5) ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.12)",
                      color: outOfStock ? "var(--app-danger)" : remaining <= (product.reorderPoint ?? 5) ? "var(--app-warning)" : "var(--app-success)",
                    }}>
                      {outOfStock ? "ໝົດ" : `ເຫຼືອ ${remaining} ຊິ້ນ`}
                    </div>
                  ) : (
                    <div style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: "0.72rem", fontWeight: 600,
                      padding: "2px 8px", borderRadius: 20,
                      background: "rgba(107,114,128,0.12)", color: "var(--app-text-muted)",
                    }}>
                      ບໍ່ຈຳກັດ
                    </div>
                  )}
                </div>

                {/* Right: stepper */}
                {outOfStock ? (
                  <span style={{ fontSize: "0.8rem", color: "var(--app-danger)", fontWeight: 600 }}>ໝົດ</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => setQty(v, -1, cap)}
                      disabled={qty === 0}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: "1.5px solid var(--ion-color-step-150, var(--app-border))",
                        background: qty === 0 ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-item-background, #fff)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: qty === 0 ? "not-allowed" : "pointer",
                        color: qty === 0 ? "var(--ion-color-step-300, #d4d4d0)" : "var(--ion-text-color, var(--ion-text-color))",
                      }}
                    >
                      <IonIcon icon={removeOutline} style={{ fontSize: 18 }} />
                    </button>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={qty > 0 ? fmtK(qty) : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        const n = parseInt(digits) || 0;
                        const clamped = Math.max(0, Math.min(cap, n));
                        const k = variantKey(v);
                        setQtys((prev) => ({ ...prev, [k]: clamped }));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      style={{
                        width: 52, height: 36, textAlign: "center",
                        fontSize: "1.1rem", fontWeight: 700,
                        color: qty > 0 ? "var(--ion-color-primary)" : "var(--ion-color-medium, var(--app-text-muted))",
                        border: "1.5px solid var(--ion-color-step-150, var(--app-border))", borderRadius: 10,
                        outline: "none", background: "var(--ion-item-background, #fff)",
                      }}
                    />

                    <button
                      onClick={() => setQty(v, +1, cap)}
                      disabled={qty >= cap}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: `1.5px solid ${qty >= cap ? "var(--ion-color-step-150, var(--app-border))" : "var(--ion-color-primary)"}`,
                        background: qty >= cap ? "var(--ion-color-step-50, #f5f5f4)" : "var(--ion-color-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: qty >= cap ? "not-allowed" : "pointer",
                        color: qty >= cap ? "#d4d4d0" : "#fff",
                      }}
                    >
                      <IonIcon icon={addOutline} style={{ fontSize: 18 }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </IonContent>

      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--ion-color-step-150, var(--app-border))" }}>
          {totalQty > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginBottom: 10, fontSize: "0.9rem", fontWeight: 600,
            }}>
              <span style={{ color: "var(--ion-text-color, var(--app-text-secondary))" }}>ທັງໝົດ {totalQty} ຊິ້ນ</span>
              <span style={{ color: "var(--ion-color-primary)", fontWeight: 800 }}>
                {fmtK(totalPrice)} ກີບ
              </span>
            </div>
          )}
          {flavorsMissing && totalQty > 0 && (
            <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 600, color: "var(--app-danger)" }}>
              ⚠ ກະລຸນາເລືອກລົດຊາດ
            </p>
          )}
          <IonButton
            expand="block"
            disabled={totalQty === 0 || flavorsMissing}
            onClick={handleAdd}
            style={{ minHeight: 52, "--border-radius": "14px" }}
          >
            {totalQty === 0
              ? "ເລືອກເມນູກ່ອນ"
              : `${confirmLabel} (${totalQty} ລາຍການ)`}
          </IonButton>
        </div>
      </IonFooter>
    </IonModal>
  );
};

export default VariantPicker;
