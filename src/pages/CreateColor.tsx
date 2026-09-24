import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
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
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getColors, setColors } from "../data/shopRepository";
import ColorPicker from "../components/ColorPicker";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// One page, two modes: /tabs/create-color (create) and
// /tabs/create-color/:hex (edit that color, :hex URI-encoded since it
// contains "#") — mirrors TableForm.tsx/CustomerForm.tsx's unified
// create/edit split.
const CreateColor: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const { hex: editHexParam } = useParams<{ hex?: string }>();
  const editHex = editHexParam ? decodeURIComponent(editHexParam) : null;
  const isEdit = !!editHex;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hex, setHex] = useState("#e07b39");
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    getColors(shopId)
      .then((colors) => {
        if (editHex) {
          const found = colors.find((c) => c.toLowerCase() === editHex.toLowerCase());
          if (found) setHex(found);
          else setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [shopId, editHex]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId || !HEX_RE.test(hex)) return;
    const normalized = hex.toLowerCase();
    setSaving(true);
    try {
      // Re-fetch fresh right before writing, same reasoning as TableForm.tsx.
      const current = await getColors(shopId);
      if (isEdit && editHex) {
        const collides = current.some((c) => c.toLowerCase() !== editHex.toLowerCase() && c.toLowerCase() === normalized);
        if (collides) {
          showResult(false, `ສີ "${hex}" ມີຢູ່ແລ້ວ`);
          return;
        }
        const updated = current.map((c) => (c.toLowerCase() === editHex.toLowerCase() ? normalized : c));
        await setColors(shopId, updated);
        showResult(true, "ບັນທຶກສີສຳເລັດ");
      } else {
        if (current.some((c) => c.toLowerCase() === normalized)) {
          showResult(false, `ສີ "${hex}" ມີຢູ່ແລ້ວ`);
          return;
        }
        await setColors(shopId, [...current, normalized]);
        showResult(true, "ສ້າງສີສຳເລັດ");
      }
    } catch {
      showResult(false, isEdit ? "ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່" : "ສ້າງສີບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? "ແກ້ໄຂສີ" : "ສ້າງສີໃໝ່"}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-colors" routerDirection="back">
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
        ) : notFound ? (
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບສີນີ້</p>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ເລືອກສີ
              </p>
              <ColorPicker value={hex} onChange={setHex} />
              {!HEX_RE.test(hex) && (
                <p style={{ margin: "10px 0 0", fontSize: "0.72rem", color: "var(--app-danger)", fontWeight: 600 }}>
                  ⚠️ ລະຫັດສີຕ້ອງເປັນຮູບແບບ #000000
                </p>
              )}
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || notFound || !HEX_RE.test(hex)}
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
            routerLink="/tabs/manage-colors" routerDirection="back"
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
              if (resultSuccess) history.push("/tabs/manage-colors");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default CreateColor;
