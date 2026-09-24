import { IonButton, IonIcon, IonInput, IonSelect, IonSelectOption } from "@ionic/react";
import { trashOutline } from "ionicons/icons";
import type { ProductVariant } from "../data/types";
import NumInput from "./NumInput";

interface Props {
  variant: ProductVariant;
  index: number;
  hasFlavors: boolean;
  flavors: string[];
  trackStock: boolean;
  invalid: { size?: boolean; color?: boolean };
  errorMsg?: string;
  canDelete: boolean;
  onChange: (field: keyof ProductVariant, value: string | number) => void;
  onDelete: () => void;
}

const cellStyle: React.CSSProperties = {
  "--min-height": "44px", textAlign: "center",
} as React.CSSProperties;

const ProductVariantRow: React.FC<Props> = ({
  variant: v, hasFlavors, flavors, trackStock, invalid, errorMsg, canDelete, onChange, onDelete,
}) => {
  const borderNormal = "1.5px solid var(--app-border)";

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: hasFlavors ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <IonInput
            fill="outline" placeholder="ຂະໜາດ *" value={v.size}
            onIonInput={(e) => onChange("size", e.detail.value ?? "")}
            style={{
              ...cellStyle,
              "--border-color": invalid.size ? "var(--app-danger)" : undefined,
              "--highlight-color-focused": invalid.size ? "var(--app-danger)" : undefined,
            }}
          />
        </div>
        {hasFlavors && (
          <div>
            <IonSelect
              interface="popover"
              placeholder="ລົດຊາດ *"
              value={v.color || undefined}
              onIonChange={(e) => onChange("color", e.detail.value ?? "")}
              style={{
                border: `1.5px solid ${invalid.color ? "var(--app-danger)" : "var(--app-border)"}`,
                borderRadius: 8, minHeight: 44, "--padding-start": "10px", "--padding-end": "10px",
              }}
            >
              {flavors.map((f) => <IonSelectOption key={f} value={f}>{f}</IonSelectOption>)}
            </IonSelect>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 600, color: "var(--app-text-muted)" }}>ລາຄາຕົ້ນທຶນ *</p>
          <NumInput
            value={v.costPrice ?? 0}
            onChange={(n) => onChange("costPrice", n)}
            placeholder="0"
            style={{ width: "100%", height: 44, textAlign: "center", border: borderNormal, borderRadius: 4, outline: "none", background: "var(--app-surface)", color: "var(--ion-text-color)", fontSize: "0.95rem" }}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 600, color: "var(--app-text-muted)" }}>ລາຄາຂາຍ *</p>
          <NumInput
            value={v.price ?? 0}
            onChange={(n) => onChange("price", n)}
            placeholder="0"
            style={{ width: "100%", height: 44, textAlign: "center", border: borderNormal, borderRadius: 4, outline: "none", background: "var(--app-surface)", color: "var(--ion-text-color)", fontSize: "0.95rem" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 44px", gap: 8, alignItems: "end" }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 600, color: "var(--app-text-muted)" }}>ຈຳນວນສະຕັອກ</p>
          <NumInput
            value={v.stock}
            onChange={(n) => onChange("stock", n)}
            placeholder="0"
            style={{ width: "100%", height: 44, textAlign: "center", border: borderNormal, borderRadius: 4, outline: "none", background: "var(--app-surface)", color: "var(--ion-text-color)", fontSize: "0.95rem" }}
          />
        </div>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 600, color: "var(--app-text-muted)" }}>ຮູບແບບສະຕັອກ</p>
          <div style={{
            height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, fontSize: "0.74rem", fontWeight: 700,
            background: trackStock ? "rgba(22,163,74,0.1)" : "rgba(107,114,128,0.1)",
            color: trackStock ? "var(--app-success)" : "var(--app-text-muted)",
          }}>
            {trackStock ? "ຕັດສະຕັອກ" : "ບໍ່ຕັດ"}
          </div>
        </div>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "0.68rem", fontWeight: 600, color: "var(--app-text-muted)" }}>ສະຖານະ</p>
          <IonSelect
            interface="popover"
            value={v.status ?? "active"}
            onIonChange={(e) => onChange("status", e.detail.value)}
            style={{ border: borderNormal, borderRadius: 4, minHeight: 44, "--padding-start": "8px", "--padding-end": "4px", fontSize: "0.85rem" }}
          >
            <IonSelectOption value="active">ເປີດຂາຍ</IonSelectOption>
            <IonSelectOption value="inactive">ປິດຂາຍ</IonSelectOption>
          </IonSelect>
        </div>
        <IonButton fill="clear" color="danger" onClick={onDelete} disabled={!canDelete}
          style={{ minHeight: 44, minWidth: 44, margin: 0 }}>
          <IonIcon slot="icon-only" icon={trashOutline} />
        </IonButton>
      </div>

      {errorMsg && (
        <p style={{ margin: "6px 0 0", fontSize: "0.74rem", fontWeight: 600, color: "var(--app-danger)" }}>{errorMsg}</p>
      )}
    </div>
  );
};

export default ProductVariantRow;
