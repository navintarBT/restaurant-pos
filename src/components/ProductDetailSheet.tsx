import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonButton, IonIcon,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import type { Product } from "../data/types";
import { fmtK } from "../utils/format";

interface Props {
  product: Product | null;
  canViewFinance: boolean;
  onDismiss: () => void;
}

const ProductDetailSheet: React.FC<Props> = ({ product, canViewFinance, onDismiss }) => {
  if (!product) return null;

  const tracked = product.trackStock !== false;
  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  const reorderPoint = product.reorderPoint ?? 5;

  const prices = product.variants.map((v) => v.price ?? product.price ?? 0);
  const costs = product.variants.map((v) => v.costPrice ?? product.costPrice ?? 0);
  const [minP, maxP] = [Math.min(...prices), Math.max(...prices)];
  const [minC, maxC] = [Math.min(...costs), Math.max(...costs)];
  const hasCost = canViewFinance && maxC > 0;
  const [minProfit, maxProfit] = [minP - maxC, maxP - minC];

  const gridCols = product.hasFlavors
    ? (canViewFinance ? "1fr 1fr 70px 70px 70px" : "1fr 1fr 70px")
    : (canViewFinance ? "1fr 70px 70px 70px" : "1fr 70px");

  return (
    <IonModal isOpen={!!product} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontWeight: 700 }}>{product.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Fixed-height image/color area */}
        <div style={{ height: 200, overflow: "hidden", flexShrink: 0, background: "var(--app-surface-alt)" }}>
          {product.photoUrl ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : product.color ? (
            <div style={{ height: "100%", background: product.color }} />
          ) : (
            <div style={{
              height: "100%",
              background: "linear-gradient(135deg, var(--app-accent-border), #fdba74)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 72,
            }}>
              🍽️
            </div>
          )}
        </div>

        <div style={{ padding: "20px 16px 32px" }}>
          {/* Name + category */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.2rem", color: "var(--ion-text-color)", flex: 1, lineHeight: 1.3 }}>
              {product.name}
            </p>
            {product.category && (
              <span style={{
                marginLeft: 10, flexShrink: 0,
                background: "var(--app-surface-alt)", color: "var(--app-text-secondary)",
                fontSize: "0.7rem", fontWeight: 700,
                padding: "3px 10px", borderRadius: 20,
              }}>
                {product.category}
              </span>
            )}
          </div>

          {(product.code || product.unit) && (
            <p style={{ margin: "0 0 14px", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
              {[product.code && `ລະຫັດ: ${product.code}`, product.unit && `ຫົວໜ່ວຍ: ${product.unit}`].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Price info */}
          <div style={{
            display: "grid",
            gridTemplateColumns: hasCost ? "1fr 1fr 1fr" : "1fr",
            gap: 8, marginBottom: 20,
          }}>
            <div style={{ background: "var(--app-accent-surface)", borderRadius: 12, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--app-text-secondary)", fontWeight: 600 }}>ລາຄາຂາຍ</p>
              <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>
                {minP === maxP ? `${fmtK(minP)} ກີບ` : `${fmtK(minP)}–${fmtK(maxP)} ກີບ`}
              </p>
            </div>
            {hasCost && (
              <>
                <div style={{ background: "var(--app-cost-surface)", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--app-text-secondary)", fontWeight: 600 }}>ຕົ້ນທຶນ</p>
                  <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--app-cost)" }}>
                    {minC === maxC ? `${fmtK(minC)} ກີບ` : `${fmtK(minC)}–${fmtK(maxC)} ກີບ`}
                  </p>
                </div>
                <div style={{ background: "var(--app-success-surface)", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--app-text-secondary)", fontWeight: 600 }}>ກຳໄລ</p>
                  <p style={{ margin: "4px 0 0", fontSize: "1.15rem", fontWeight: 800, color: "var(--app-success)" }}>
                    {minProfit === maxProfit ? `${fmtK(minProfit)} ກີບ` : `${fmtK(minProfit)}–${fmtK(maxProfit)} ກີບ`}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Variants table */}
          <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
            ລາຍການຕົວເລືອກ/ຂະໜາດ
          </p>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--app-surface-alt)" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: gridCols,
              background: "var(--app-surface-alt)", padding: "8px 14px", gap: 4,
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ຂະໜາດ</span>
              {product.hasFlavors && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ລົດຊາດ</span>}
              {canViewFinance && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)", textAlign: "right" }}>ຕົ້ນທຶນ</span>}
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)", textAlign: "right" }}>ລາຄາ</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-text-secondary)", textAlign: "right" }}>ສະຕ໋ອກ</span>
            </div>

            {/* Variant rows */}
            {product.variants.map((v, i) => {
              const inactive = v.status === "inactive";
              const empty = tracked && v.stock === 0;
              const low = tracked && !empty && v.stock <= reorderPoint;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: gridCols, gap: 4,
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--app-surface-alt)" : "none",
                    background: empty ? "var(--app-danger-surface)" : "var(--app-surface)",
                    opacity: inactive ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-text-color)" }}>
                    {v.size}{inactive ? " (ປິດ)" : ""}
                  </span>
                  {product.hasFlavors && <span style={{ fontSize: "0.85rem", color: "var(--app-text-secondary)" }}>{v.color}</span>}
                  {canViewFinance && (
                    <span style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)", textAlign: "right" }}>
                      {fmtK(v.costPrice ?? product.costPrice ?? 0)}
                    </span>
                  )}
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ion-text-color)", textAlign: "right" }}>
                    {fmtK(v.price ?? product.price ?? 0)}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: "0.8rem", fontWeight: 700,
                      color: !tracked ? "var(--app-text-muted)" : empty ? "var(--app-danger)" : low ? "var(--app-warning)" : "var(--app-success)",
                    }}>
                      {!tracked ? "—" : empty ? "ໝົດ" : v.stock}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total stock summary */}
          <div style={{
            marginTop: 14,
            background: !tracked ? "var(--app-surface-alt)" : totalStock === 0 ? "var(--app-danger-surface)" : "var(--app-success-surface)",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--app-text-secondary)" }}>ສະຕ໋ອກທັງໝົດ</span>
            <span style={{
              fontSize: "1.1rem", fontWeight: 800,
              color: !tracked ? "var(--app-text-muted)" : totalStock === 0 ? "var(--app-danger)" : "var(--app-success)",
            }}>
              {!tracked ? "ບໍ່ຕິດຕາມສະຕ໋ອກ" : totalStock === 0 ? "ໝົດສະຕ໋ອກ" : `${totalStock} ຊີ້ນ`}
            </span>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ProductDetailSheet;
