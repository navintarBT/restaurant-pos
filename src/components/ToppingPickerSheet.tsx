import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonCheckbox, IonAlert,
} from "@ionic/react";
import { addOutline, createOutline, trashOutline } from "ionicons/icons";
import { setToppings, type ToppingEntry } from "../data/shopRepository";
import { fmtK } from "../utils/format";

interface Props {
  isOpen: boolean;
  shopId?: string;
  toppings: ToppingEntry[];
  selectedNames: string[];
  onToggleSelect: (name: string) => void;
  onToppingsChanged: (toppings: ToppingEntry[]) => void;
  onDismiss: () => void;
}

// Reuses the shop-wide Toppings list (ManageToppings.tsx/getToppings/
// setToppings) — selecting a checkbox here builds Product.toppingNames.
// Also lets staff create/edit/delete toppings inline, mirroring the
// Category picker's manageCatMode pattern in ProductForm.tsx, but with
// index-based array rewrite via setToppings (toppings have no per-item id).
const ToppingPickerSheet: React.FC<Props> = ({
  isOpen, shopId, toppings, selectedNames, onToggleSelect, onToppingsChanged, onDismiss,
}) => {
  const [manageMode, setManageMode] = useState(false);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ index: number; entry: ToppingEntry } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; entry: ToppingEntry } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parsePrice(raw?: string): number | undefined {
    const n = parseInt((raw ?? "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  async function handleCreate(name: string, priceRaw?: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId) return;
    if (toppings.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`ທັອບປິ້ງ "${trimmed}" ມີຢູ່ແລ້ວ`);
      return;
    }
    try {
      const next = [...toppings, { name: trimmed, price: parsePrice(priceRaw) }];
      await setToppings(shopId, next);
      onToppingsChanged(next);
    } catch {
      setError("ສ້າງທັອບປິ້ງບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  async function handleEdit(name: string, priceRaw?: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId || !editTarget) return;
    const dup = toppings.some((t, i) => i !== editTarget.index && t.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setError(`ທັອບປິ້ງ "${trimmed}" ມີຢູ່ແລ້ວ`);
      setEditTarget(null);
      return;
    }
    try {
      const oldName = editTarget.entry.name;
      const next = toppings.map((t, i) => (i === editTarget.index ? { name: trimmed, price: parsePrice(priceRaw) } : t));
      await setToppings(shopId, next);
      onToppingsChanged(next);
      // Keep the product's selection pointing at the renamed topping.
      if (oldName !== trimmed && selectedNames.includes(oldName)) {
        onToggleSelect(oldName);
        onToggleSelect(trimmed);
      }
      setEditTarget(null);
    } catch {
      setError("ແກ້ໄຂທັອບປິ້ງບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !shopId) return;
    try {
      const next = toppings.filter((_, i) => i !== deleteTarget.index);
      await setToppings(shopId, next);
      onToppingsChanged(next);
      if (selectedNames.includes(deleteTarget.entry.name)) onToggleSelect(deleteTarget.entry.name);
      setDeleteTarget(null);
    } catch {
      setError("ລຶບທັອບປິ້ງບໍ່ສຳເລັດ — ລອງໃໝ່");
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { setManageMode(false); onDismiss(); }} initialBreakpoint={0.7} breakpoints={[0, 0.7, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ທັອບປິ້ງ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => { setManageMode(false); onDismiss(); }}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonItem detail={false} style={{ "--background": "#fff8f5", "--inner-padding-end": "8px" }}>
            <IonButton fill="clear" size="small" onClick={() => setNewAlertOpen(true)}
              style={{ fontWeight: 700, fontSize: "0.88rem", "--padding-start": "4px", "--padding-end": "8px" }}>
              <IonIcon slot="start" icon={addOutline} />
              ສ້າງທັອບປິ້ງໃໝ່
            </IonButton>
            {toppings.length > 0 && (
              <IonButton
                fill={manageMode ? "solid" : "clear"} size="small"
                color={manageMode ? "warning" : "medium"} slot="end"
                onClick={() => setManageMode((m) => !m)}
                style={{ fontWeight: 600, fontSize: "0.82rem", "--padding-start": "8px", "--padding-end": "8px" }}
              >
                <IonIcon slot="start" icon={createOutline} />
                {manageMode ? "ບັນທຶກ" : "ຈັດການ"}
              </IonButton>
            )}
          </IonItem>

          {toppings.length === 0 && (
            <p style={{ padding: 24, textAlign: "center", fontSize: "0.85rem", color: "var(--app-text-secondary)" }}>
              ຍັງບໍ່ມີທັອບປິ້ງ — ກົດ "ສ້າງທັອບປິ້ງໃໝ່"
            </p>
          )}

          {toppings.map((t, i) => (
            <IonItem
              key={t.name}
              button={!manageMode} detail={false}
              onClick={() => { if (!manageMode) onToggleSelect(t.name); }}
            >
              {!manageMode && (
                <IonCheckbox
                  slot="start"
                  checked={selectedNames.includes(t.name)}
                  onIonChange={() => onToggleSelect(t.name)}
                />
              )}
              <IonLabel>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                {t.price != null && t.price > 0 && (
                  <span style={{ marginLeft: 8, fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                    +{fmtK(t.price)} ກີບ
                  </span>
                )}
              </IonLabel>
              {manageMode && (
                <>
                  <IonButton fill="clear" size="small" slot="end"
                    onClick={(e) => { e.stopPropagation(); setEditTarget({ index: i, entry: t }); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                  <IonButton fill="clear" size="small" color="danger" slot="end"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ index: i, entry: t }); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={trashOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                </>
              )}
            </IonItem>
          ))}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={newAlertOpen}
        header="ສ້າງທັອບປິ້ງໃໝ່"
        inputs={[
          { name: "name", type: "text", placeholder: "ຊື່ທັອບປິ້ງ" },
          { name: "price", type: "number", placeholder: "ລາຄາເພີ່ມ (ບໍ່ບັງຄັບ)" },
        ]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewAlertOpen(false) },
          { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreate(data.name, data.price); setNewAlertOpen(false); } },
        ]}
        onDidDismiss={() => setNewAlertOpen(false)}
      />

      <IonAlert
        isOpen={!!editTarget}
        header="ແກ້ໄຂທັອບປິ້ງ"
        inputs={[
          { type: "text", value: editTarget?.entry.name, placeholder: "ຊື່ທັອບປິ້ງ" },
          { type: "number", value: editTarget?.entry.price, placeholder: "ລາຄາເພີ່ມ (ບໍ່ບັງຄັບ)" },
        ]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          { text: "ບັນທຶກ", handler: (data) => handleEdit(data[0], data[1]) },
        ]}
        onDidDismiss={() => setEditTarget(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບທັອບປິ້ງ"
        message={`ລຶບ "${deleteTarget?.entry.name}" ແມ່ນບໍ?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: handleDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <IonAlert isOpen={!!error} header="ຂໍ້ຜິດພາດ" message={error ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setError(null)} />
    </>
  );
};

export default ToppingPickerSheet;
