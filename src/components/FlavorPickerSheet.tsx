import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonCheckbox, IonAlert,
} from "@ionic/react";
import { addOutline, createOutline, trashOutline } from "ionicons/icons";
import { setFlavors } from "../data/shopRepository";

interface Props {
  isOpen: boolean;
  shopId?: string;
  flavors: string[];
  selectedNames: string[];
  onToggleSelect: (name: string) => void;
  onFlavorsChanged: (flavors: string[]) => void;
  onDismiss: () => void;
}

// Reuses the shop-wide Flavors list — selecting a checkbox here builds
// Product.flavors (the subset of the shop's flavors offered for THIS
// product). Also lets staff create/edit/delete flavors inline, mirroring
// ToppingPickerSheet.tsx exactly, minus the per-entry price field.
const FlavorPickerSheet: React.FC<Props> = ({
  isOpen, shopId, flavors, selectedNames, onToggleSelect, onFlavorsChanged, onDismiss,
}) => {
  const [manageMode, setManageMode] = useState(false);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ index: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId) return;
    if (flavors.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      setError(`ລົດຊາດ "${trimmed}" ມີຢູ່ແລ້ວ`);
      return;
    }
    try {
      const next = [...flavors, trimmed];
      await setFlavors(shopId, next);
      onFlavorsChanged(next);
    } catch {
      setError("ສ້າງລົດຊາດບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  async function handleEdit(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId || !editTarget) return;
    const dup = flavors.some((f, i) => i !== editTarget.index && f.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setError(`ລົດຊາດ "${trimmed}" ມີຢູ່ແລ້ວ`);
      setEditTarget(null);
      return;
    }
    try {
      const oldName = editTarget.name;
      const next = flavors.map((f, i) => (i === editTarget.index ? trimmed : f));
      await setFlavors(shopId, next);
      onFlavorsChanged(next);
      // Keep the product's selection pointing at the renamed flavor.
      if (oldName !== trimmed && selectedNames.includes(oldName)) {
        onToggleSelect(oldName);
        onToggleSelect(trimmed);
      }
      setEditTarget(null);
    } catch {
      setError("ແກ້ໄຂລົດຊາດບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !shopId) return;
    try {
      const next = flavors.filter((_, i) => i !== deleteTarget.index);
      await setFlavors(shopId, next);
      onFlavorsChanged(next);
      if (selectedNames.includes(deleteTarget.name)) onToggleSelect(deleteTarget.name);
      setDeleteTarget(null);
    } catch {
      setError("ລຶບລົດຊາດບໍ່ສຳເລັດ — ລອງໃໝ່");
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { setManageMode(false); onDismiss(); }} initialBreakpoint={0.7} breakpoints={[0, 0.7, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ລົດຊາດ</IonTitle>
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
              ສ້າງລົດຊາດໃໝ່
            </IonButton>
            {flavors.length > 0 && (
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

          {flavors.length === 0 && (
            <p style={{ padding: 24, textAlign: "center", fontSize: "0.85rem", color: "var(--app-text-secondary)" }}>
              ຍັງບໍ່ມີລົດຊາດ — ກົດ "ສ້າງລົດຊາດໃໝ່"
            </p>
          )}

          {flavors.map((f, i) => (
            <IonItem
              key={f}
              button={!manageMode} detail={false}
              onClick={() => { if (!manageMode) onToggleSelect(f); }}
            >
              {!manageMode && (
                <IonCheckbox
                  slot="start"
                  checked={selectedNames.includes(f)}
                  onIonChange={() => onToggleSelect(f)}
                />
              )}
              <IonLabel style={{ fontWeight: 600 }}>{f}</IonLabel>
              {manageMode && (
                <>
                  <IonButton fill="clear" size="small" slot="end"
                    onClick={(e) => { e.stopPropagation(); setEditTarget({ index: i, name: f }); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                  <IonButton fill="clear" size="small" color="danger" slot="end"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ index: i, name: f }); }}
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
        header="ສ້າງລົດຊາດໃໝ່"
        inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ເຜັດ, ບໍ່ເຜັດ, ຫວານ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewAlertOpen(false) },
          { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreate(data.name); setNewAlertOpen(false); } },
        ]}
        onDidDismiss={() => setNewAlertOpen(false)}
      />

      <IonAlert
        isOpen={!!editTarget}
        header="ແກ້ໄຂລົດຊາດ"
        inputs={[{ type: "text", value: editTarget?.name, placeholder: "ຊື່ລົດຊາດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          { text: "ບັນທຶກ", handler: (data) => handleEdit(data[0]) },
        ]}
        onDidDismiss={() => setEditTarget(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບລົດຊາດ"
        message={`ລຶບ "${deleteTarget?.name}" ແມ່ນບໍ?`}
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

export default FlavorPickerSheet;
