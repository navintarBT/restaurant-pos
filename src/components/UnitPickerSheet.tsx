import { useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonAlert,
} from "@ionic/react";
import { addOutline, checkmarkOutline } from "ionicons/icons";
import { setUnits } from "../data/shopRepository";

interface Props {
  isOpen: boolean;
  shopId?: string;
  units: string[];
  value: string;
  onPick: (unit: string) => void;
  onUnitsChanged: (units: string[]) => void;
  onDismiss: () => void;
}

// Single-select over the shop's reusable Units list, with an inline "+ add
// new" that appends to that same shop-wide list (no full manage-mode
// edit/delete here — ManageUnits.tsx already covers that separately).
const UnitPickerSheet: React.FC<Props> = ({ isOpen, shopId, units, value, onPick, onUnitsChanged, onDismiss }) => {
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !shopId) return;
    if (units.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      setError(`ຫົວໜ່ວຍ "${trimmed}" ມີຢູ່ແລ້ວ`);
      return;
    }
    try {
      const next = [...units, trimmed];
      await setUnits(shopId, next);
      onUnitsChanged(next);
      onPick(trimmed);
      onDismiss();
    } catch {
      setError("ສ້າງຫົວໜ່ວຍບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.6} breakpoints={[0, 0.6, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ເລືອກຫົວໜ່ວຍ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onDismiss}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonItem detail={false} style={{ "--background": "#fff8f5" }}>
            <IonButton fill="clear" size="small" onClick={() => setNewAlertOpen(true)}
              style={{ fontWeight: 700, fontSize: "0.88rem", "--padding-start": "4px", "--padding-end": "8px" }}>
              <IonIcon slot="start" icon={addOutline} />
              ສ້າງຫົວໜ່ວຍໃໝ່
            </IonButton>
          </IonItem>
          <IonItem button detail={false} onClick={() => { onPick(""); onDismiss(); }}>
            <IonLabel style={{ color: "var(--app-text-secondary)" }}>— ບໍ່ລະບຸ —</IonLabel>
            {value === "" && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
          </IonItem>
          {units.map((u) => (
            <IonItem key={u} button detail={false} onClick={() => { onPick(u); onDismiss(); }}>
              <IonLabel style={{ fontWeight: value === u ? 700 : 400 }}>{u}</IonLabel>
              {value === u && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            </IonItem>
          ))}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={newAlertOpen}
        header="ສ້າງຫົວໜ່ວຍໃໝ່"
        inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ຈານ, ແກ້ວ, ຂວດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewAlertOpen(false) },
          { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreate(data.name); setNewAlertOpen(false); } },
        ]}
        onDidDismiss={() => setNewAlertOpen(false)}
      />
      <IonAlert isOpen={!!error} header="ຂໍ້ຜິດພາດ" message={error ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setError(null)} />
    </>
  );
};

export default UnitPickerSheet;
