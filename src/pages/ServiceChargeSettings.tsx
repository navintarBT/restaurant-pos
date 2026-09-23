import { useCallback, useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonSpinner,
  useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getServiceChargeSettings, setServiceChargeSettings } from "../data/shopRepository";

const cardStyle: React.CSSProperties = {
  background: "var(--app-surface)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
};

// Was a section inside ShopProfileSettings.tsx ("ໂປຣໄຟລ໌ຮ້ານ") — moved out
// to its own settings page, same tier as "ອັດຕາແລກປ່ຽນ" (money/checkout
// settings gated by canTakeOrders, not tied to shop identity).
const ServiceChargeSettings: React.FC = () => {
  const { shopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scEnabled, setScEnabled] = useState(false);
  const [scPercent, setScPercent] = useState("0");
  const [scSaving, setScSaving] = useState(false);
  const [scMessage, setScMessage] = useState<string | null>(null);
  const [scMessageError, setScMessageError] = useState(false);

  useEffect(() => {
    if (!scMessage) return;
    const t = setTimeout(() => setScMessage(null), 3000);
    return () => clearTimeout(t);
  }, [scMessage]);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const sc = await getServiceChargeSettings(shopId);
      setScEnabled(sc.enabled);
      setScPercent(String(sc.percent));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);

  async function handleSave() {
    if (!shopId) return;
    setScSaving(true);
    setScMessage(null);
    try {
      const percent = Math.max(0, parseFloat(scPercent) || 0);
      await setServiceChargeSettings(shopId, { enabled: scEnabled, percent });
      setScMessageError(false);
      setScMessage("ບັນທຶກຄ່າບໍລິການແລ້ວ");
    } catch {
      setScMessageError(true);
      setScMessage("ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setScSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
            <IonButton routerLink="/tabs/take-order" routerDirection="back">
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>ຄ່າບໍລິການ</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : (
          <div style={{ padding: "16px 16px 28px" }}>
            <section style={cardStyle}>
              <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                ເປີດໃຊ້ ແລ້ວຕັ້ງເປີເຊັນ, ຈາກນັ້ນເລືອກວ່າໂຕະໃດຄິດຄ່າບໍລິການຢູ່ໜ້າ "ຈັດການໂຕະ"
              </p>
              <div
                onClick={() => setScEnabled((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "10px 12px", borderRadius: 10,
                  background: scEnabled ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
                  {scEnabled ? `ໃຊ້ງານ / ${scPercent}%` : "ປິດໃຊ້ງານ"}
                </span>
                <div style={{
                  width: 46, height: 26, borderRadius: 13, flexShrink: 0,
                  background: scEnabled ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
                  position: "relative", transition: "background 0.15s",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: scEnabled ? 22 : 2,
                    width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
                  }} />
                </div>
              </div>
              {scEnabled && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <IonInput
                    type="number" min="0" max="100" value={scPercent}
                    onIonInput={(e) => setScPercent(e.detail.value ?? "0")}
                    fill="outline" style={{ "--border-radius": "12px", flex: 1 }}
                  />
                  <span style={{ fontWeight: 700, color: "var(--app-text-secondary)" }}>%</span>
                </div>
              )}
              {scMessage && (
                <div style={{ marginTop: 10, fontWeight: 700, fontSize: "0.82rem", color: scMessageError ? "var(--app-danger)" : "var(--app-success)" }}>
                  {scMessage}
                </div>
              )}
              <IonButton
                expand="block" size="small" disabled={scSaving}
                onClick={handleSave}
                style={{ marginTop: 12, "--border-radius": "10px" }}
              >
                {scSaving ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : "ບັນທຶກຄ່າບໍລິການ"}
              </IonButton>
            </section>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ServiceChargeSettings;
