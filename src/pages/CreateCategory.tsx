import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getCategories, addCategory } from "../data/categoryRepository";
import { getFoodGroups } from "../data/shopRepository";
import IconPicker from "../components/IconPicker";
import CategoryIconGlyph from "../components/CategoryIconGlyph";

const NO_GROUP = "__none__";

// Dedicated "create one category" screen — kept separate from
// ManageCategories.tsx (which only lists/edits/deletes what's already
// saved), mirroring TableForm.tsx's split. Creates a single category per
// visit (see TableForm.tsx's own one-at-a-time change for the same reason).
const CreateCategory: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [foodGroups, setFoodGroups] = useState<string[]>([]);
  const [foodGroup, setFoodGroup] = useState<string>(NO_GROUP);
  const [icon, setIcon] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    getFoodGroups(shopId).then(setFoodGroups).finally(() => setLoading(false));
  }, [shopId]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      // Re-fetch fresh right before writing, same reasoning as TableForm.tsx.
      const current = await getCategories(shopId);
      if (current.some((c) => c.name === trimmed)) {
        showResult(false, `ໝວດໝູ່ "${trimmed}" ມີຢູ່ແລ້ວ`);
        return;
      }
      await addCategory(shopId, trimmed, foodGroup === NO_GROUP ? undefined : foodGroup, icon || undefined);
      showResult(true, "ສ້າງໝວດໝູ່ສຳເລັດ");
    } catch {
      showResult(false, "ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ສ້າງໝວດໝູ່ໃໝ່</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-categories" routerDirection="back">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ໝວດໝູ່
              </p>

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                Icon
              </p>
              <button
                onClick={() => setPickerOpen(true)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: 64, height: 64, borderRadius: 14, cursor: "pointer", marginBottom: 16,
                  border: "1.5px solid var(--app-accent-border)", background: "var(--app-accent-surface)",
                  fontSize: 13, color: "#c2410c", fontWeight: 700,
                }}
              >
                {icon ? <CategoryIconGlyph icon={icon} size={30} /> : "ເລືອກ"}
              </button>

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຊື່ໝວດໝູ່
              </p>
              <IonInput
                placeholder="ເຊັ່ນ: ອາຫານທອດ" value={name}
                onIonInput={(e) => setName(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 16 }}
              />

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ກຸ່ມອາຫານ
              </p>
              <IonSelect
                value={foodGroup}
                onIonChange={(e) => setFoodGroup(e.detail.value)}
                interface="popover"
                fill="outline"
                style={{ "--border-radius": "10px", border: "1px solid var(--app-border)", borderRadius: 10, width: "100%" }}
              >
                <IonSelectOption value={NO_GROUP}>ບໍ່ມີກຸ່ມ</IonSelectOption>
                {foodGroups.map((g) => (
                  <IonSelectOption key={g} value={g}>{g}</IonSelectOption>
                ))}
              </IonSelect>
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || !name.trim()}
            onClick={handleSubmit}
            style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
          >
            {saving
              ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງບັນທຶກ...</span>)
              : "ບັນທຶກ"
            }
          </IonButton>
          <IonButton
            expand="block" fill="outline" disabled={saving}
            routerLink="/tabs/manage-categories" routerDirection="back"
            style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
          >
            ຍົກເລີກ
          </IonButton>
        </div>
      </IonFooter>

      <style>{`
        .table-form-alert-error::part(message) { color: #dc2626; font-weight: 600; }
        .table-form-alert-success::part(message) { color: #16a34a; font-weight: 600; }
      `}</style>
      <IonAlert
        isOpen={resultOpen}
        cssClass={resultSuccess ? "table-form-alert-success" : "table-form-alert-error"}
        header={resultSuccess ? "ສຳເລັດ" : "ມີຂໍ້ຜິດພາດ"}
        message={resultMessage}
        buttons={[
          {
            text: "ຕົກລົງ",
            handler: () => {
              setResultOpen(false);
              if (resultSuccess) history.push("/tabs/manage-categories");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />

      <IconPicker
        isOpen={pickerOpen}
        value={icon}
        onSelect={(emoji) => { setIcon(emoji); setPickerOpen(false); }}
        onDismiss={() => setPickerOpen(false)}
      />
    </IonPage>
  );
};

export default CreateCategory;
