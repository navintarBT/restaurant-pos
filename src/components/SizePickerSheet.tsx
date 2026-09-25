import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonAlert,
} from "@ionic/react";
import { addOutline, checkmarkOutline, createOutline, trashOutline } from "ionicons/icons";
import { setSizes } from "../data/shopRepository";

interface Props {
  isOpen: boolean;
  shopId?: string;
  sizes: string[];
  value: string;
  onPick: (size: string) => void;
  onSizesChanged: (sizes: string[]) => void;
  onDismiss: () => void;
}

// Single-select over the shop's reusable Sizes list (same list ManageSizes.tsx
// manages), with inline create/edit/delete right here — mirrors the Category
// picker's manageCatMode pattern in ProductForm.tsx, but index-based array
// rewrite via setSizes (sizes have no per-item id, unlike categories).
const SizePickerSheet: React.FC<Props> = ({ isOpen, shopId, sizes, value, onPick, onSizesChanged, onDismiss }) => {
  const [manageMode, setManageMode] = useState(false);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ index: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId) return;
    if (sizes.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setError(`ຂະໜາດ "${trimmed}" ມີຢູ່ແລ້ວ`);
      return;
    }
    try {
      const next = [...sizes, trimmed];
      await setSizes(shopId, next);
      onSizesChanged(next);
      onPick(trimmed);
      onDismiss();
    } catch {
      setError("ສ້າງຂະໜາດບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  async function handleEdit(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId || !editTarget) return;
    const dup = sizes.some((s, i) => i !== editTarget.index && s.toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setError(`ຂະໜາດ "${trimmed}" ມີຢູ່ແລ້ວ`);
      setEditTarget(null);
      return;
    }
    try {
      const oldName = editTarget.name;
      const next = sizes.map((s, i) => (i === editTarget.index ? trimmed : s));
      await setSizes(shopId, next);
      onSizesChanged(next);
      if (value === oldName) onPick(trimmed);
      setEditTarget(null);
    } catch {
      setError("ແກ້ໄຂຂະໜາດບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !shopId) return;
    try {
      const next = sizes.filter((_, i) => i !== deleteTarget.index);
      await setSizes(shopId, next);
      onSizesChanged(next);
      if (value === deleteTarget.name) onPick("");
      setDeleteTarget(null);
    } catch {
      setError("ລຶບຂະໜາດບໍ່ສຳເລັດ — ລອງໃໝ່");
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={() => { setManageMode(false); onDismiss(); }} initialBreakpoint={0.6} breakpoints={[0, 0.6, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ເລືອກຂະໜາດ</IonTitle>
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
              ສ້າງຂະໜາດໃໝ່
            </IonButton>
            {sizes.length > 0 && (
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

          {!manageMode && (
            <IonItem button detail={false} onClick={() => { onPick(""); onDismiss(); }}>
              <IonLabel style={{ color: "var(--app-text-secondary)" }}>— ບໍ່ລະບຸ —</IonLabel>
              {value === "" && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            </IonItem>
          )}

          {sizes.map((s, i) => (
            <IonItem
              key={s}
              button={!manageMode} detail={false}
              onClick={() => { if (!manageMode) { onPick(s); onDismiss(); } }}
            >
              <IonLabel style={{ fontWeight: value === s ? 700 : 400 }}>{s}</IonLabel>
              {!manageMode && value === s && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
              {manageMode && (
                <>
                  <IonButton fill="clear" size="small" slot="end"
                    onClick={(e) => { e.stopPropagation(); setEditTarget({ index: i, name: s }); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                  <IonButton fill="clear" size="small" color="danger" slot="end"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ index: i, name: s }); }}
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
        header="ສ້າງຂະໜາດໃໝ່"
        inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ນ້ອຍ, ກາງ, ໃຫຍ່" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewAlertOpen(false) },
          { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreate(data.name); setNewAlertOpen(false); } },
        ]}
        onDidDismiss={() => setNewAlertOpen(false)}
      />

      <IonAlert
        isOpen={!!editTarget}
        header="ແກ້ໄຂຂະໜາດ"
        inputs={[{ type: "text", value: editTarget?.name, placeholder: "ຊື່ຂະໜາດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          { text: "ບັນທຶກ", handler: (data) => handleEdit(data[0]) },
        ]}
        onDidDismiss={() => setEditTarget(null)}
      />

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບຂະໜາດ"
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

export default SizePickerSheet;
