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
import {
  getExchangeRates, setExchangeRates,
  CURRENCY_LABELS, CURRENCY_FLAGS, ALL_CURRENCIES,
  type CurrencyCode, type ExchangeRate,
} from "../data/shopRepository";

// Dedicated "create one exchange rate" screen — kept separate from
// ManageExchangeRates.tsx (which only lists/edits/deletes what's already
// saved), mirroring TableForm.tsx/CreateCategory.tsx's split. Single entry
// at a time (not bulk like zones/units) since the currency picker must
// exclude whichever currencies are already configured.
const CreateExchangeRate: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<ExchangeRate[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode | "">("");
  const [rate, setRate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const available = ALL_CURRENCIES.filter((c) => !existing.some((r) => r.currency === c));

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    getExchangeRates(shopId)
      .then((rates) => {
        setExisting(rates);
        const first = ALL_CURRENCIES.find((c) => !rates.some((r) => r.currency === c));
        if (first) setCurrency(first);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId || !currency) return;
    const rateNum = parseFloat(rate);
    if (!rate.trim() || isNaN(rateNum) || rateNum <= 0) {
      showResult(false, "ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ");
      return;
    }

    setSaving(true);
    try {
      // Re-fetch fresh right before writing, same reasoning as TableForm.tsx.
      const current = await getExchangeRates(shopId);
      if (current.some((r) => r.currency === currency)) {
        showResult(false, `ສະກຸນເງິນ "${CURRENCY_LABELS[currency]}" ມີຢູ່ແລ້ວ`);
        return;
      }
      const entry: ExchangeRate = { currency, rate: rateNum, enabled };
      await setExchangeRates(shopId, [...current, entry]);
      showResult(true, "ສ້າງອັດຕາແລກປ່ຽນສຳເລັດ");
    } catch {
      showResult(false, "ສ້າງບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ເພີ່ມສະກຸນເງິນ</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-exchange-rates" routerDirection="back">
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
        ) : available.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--app-text-secondary)" }}>ຕັ້ງຄ່າຄົບທຸກສະກຸນເງິນແລ້ວ</p>
          </div>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ອັດຕາແລກປ່ຽນ
              </p>

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                1. ສະກຸນເງິນ
              </p>
              <IonSelect
                value={currency}
                onIonChange={(e) => setCurrency(e.detail.value)}
                interface="popover"
                fill="outline"
                style={{ "--border-radius": "10px", border: "1px solid var(--app-border)", borderRadius: 10, width: "100%", marginBottom: 16 }}
              >
                {available.map((c) => (
                  <IonSelectOption key={c} value={c}>{CURRENCY_FLAGS[c]} {CURRENCY_LABELS[c]}</IonSelectOption>
                ))}
              </IonSelect>

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                2. ອັດຕາແລກປ່ຽນ (1 ໜ່ວຍ = ? ກີບ)
              </p>
              <IonInput
                type="number" min="0" placeholder="ເຊັ່ນ: 650" value={rate}
                onIonInput={(e) => setRate(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 16 }}
              />

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                3. ສະຖານະການໃຊ້ງານ
              </p>
              <div
                onClick={() => setEnabled((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "10px 12px", borderRadius: 10,
                  background: enabled ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
                  {enabled ? "ເປີດໃຊ້ງານ" : "ປິດໃຊ້ງານ"}
                </span>
                <div style={{
                  width: 46, height: 26, borderRadius: 13, flexShrink: 0,
                  background: enabled ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
                  position: "relative", transition: "background 0.15s",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: enabled ? 22 : 2,
                    width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || !currency || !rate.trim() || available.length === 0}
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
            routerLink="/tabs/manage-exchange-rates" routerDirection="back"
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
              if (resultSuccess) history.push("/tabs/manage-exchange-rates");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default CreateExchangeRate;
