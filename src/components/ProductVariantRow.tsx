import { IonButton, IonIcon, IonSelect, IonSelectOption } from "@ionic/react";
import { trashOutline, chevronDownOutline } from "ionicons/icons";
import type { ProductVariant } from "../data/types";
import NumInput from "./NumInput";

interface Props {
  variant: ProductVariant;
  index: number;
  trackStock: boolean;
  invalid: { size?: boolean };
  errorMsg?: string;
  canDelete: boolean;
  onChange: (field: keyof ProductVariant, value: string | number) => void;
  onDelete: () => void;
  onOpenSizePicker: () => void;
}

const ProductVariantRow: React.FC<Props> = ({
  variant: v, trackStock, invalid, errorMsg, canDelete, onChange, onDelete, onOpenSizePicker,
}) => {
  const borderNormal = "1.5px solid var(--app-border)";

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <div
        onClick={onOpenSizePicker}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 44, padding: "0 12px", borderRadius: 8, cursor: "pointer", marginBottom: 8,
          border: `1.5px solid ${invalid.size ? "var(--app-danger)" : "var(--app-border)"}`,
          background: "var(--app-surface)",
        }}
      >
        <span style={{ fontSize: "0.92rem", color: v.size ? "var(--ion-text-color)" : "var(--app-text-muted)" }}>
          {v.size || "ຂະໜາດ *"}
        </span>
        <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 16 }} />
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
