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
  IonSpinner,
  IonMenuButton,
  IonAlert,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, addOutline, chevronBackOutline, createOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import {
  getExchangeRates, setExchangeRates,
  CURRENCY_LABELS, CURRENCY_FLAGS, ALL_CURRENCIES,
  type ExchangeRate,
} from "../data/shopRepository";
import { fmtK } from "../utils/format";
import EmptyState from "../components/EmptyState";

// Exchange-rate CREATION lives on its own page (CreateExchangeRate.tsx,
// reached via the "+" button below) — single entry at a time since the
// currency picker there must exclude whichever currencies are already
// configured (at most ALL_CURRENCIES.length rows can ever exist). This page
// is just the list: toggle enabled/disabled inline, edit the rate, or delete.
const ManageExchangeRates: React.FC = () => {
  const { shopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rates, setRatesState] = useState<ExchangeRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExchangeRate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<ExchangeRate | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setRatesState(await getExchangeRates(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  const allConfigured = rates.length >= ALL_CURRENCIES.length;

  async function toggleEnabled(target: ExchangeRate) {
    if (!shopId) return;
    setError(null);
    try {
      const current = await getExchangeRates(shopId);
      const updated = current.map((r) => (r.currency === target.currency ? { ...r, enabled: !r.enabled } : r));
      await setExchangeRates(shopId, updated);
      setRatesState(updated);
    } catch {
      setError("ບໍ່ສາມາດປ່ຽນສະຖານະໄດ້, ລອງໃໝ່");
    }
  }

  async function handleEditRate(newRate: string) {
    if (!shopId || !editTarget) return false;
    const rate = parseFloat(newRate);
    if (!newRate.trim() || isNaN(rate) || rate <= 0) {
      setEditError("ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ");
      return false;
    }
    setSaving(true);
    try {
      const current = await getExchangeRates(shopId);
      const updated = current.map((r) => (r.currency === editTarget.currency ? { ...r, rate } : r));
      await setExchangeRates(shopId, updated);
      setRatesState(updated);
      return true;
    } catch {
      setEditError("ແກ້ໄຂບໍ່ສຳເລັດ, ລອງໃໝ່");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const current = await getExchangeRates(shopId);
      const updated = current.filter((r) => r.currency !== deleteTarget.currency);
      await setExchangeRates(shopId, updated);
      setRatesState(updated);
      setDeleteTarget(null);
    } catch {
      setError("ລຶບບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setDeleting(false);
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
          <IonTitle>ອັດຕາແລກປ່ຽນ</IonTitle>
          <IonButtons slot="end">
            {!allConfigured && (
              <IonButton routerLink="/tabs/create-exchange-rate">
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}
        {!loading && (
          <div style={{ padding: "12px 16px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                {rates.length} / {ALL_CURRENCIES.length} ສະກຸນເງິນ
              </p>
              {!allConfigured && (
                <IonButton routerLink="/tabs/create-exchange-rate" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                  <IonIcon slot="start" icon={addOutline} />
                  ເພີ່ມສະກຸນເງິນ
                </IonButton>
              )}
            </div>

            {rates.length === 0 && <EmptyState icon="💱" title="ຍັງບໍ່ມີອັດຕາແລກປ່ຽນ" subtitle="ກົດ 'ເພີ່ມສະກຸນເງິນ' ເພື່ອເລີ່ມ" />}
            {rates.map((r) => (
              <div key={r.currency} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--app-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 10,
                    border: "1.5px solid var(--app-accent-border)", background: "var(--app-accent-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  }}>
                    {CURRENCY_FLAGS[r.currency]}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>{CURRENCY_LABELS[r.currency]}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                      1 {r.currency} = {fmtK(r.rate)} ກີບ
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div
                    onClick={() => toggleEnabled(r)}
                    role="button"
                    style={{
                      width: 44, height: 26, borderRadius: 13, flexShrink: 0, cursor: "pointer",
                      background: r.enabled ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
                      position: "relative", transition: "background 0.15s", marginRight: 6,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2, left: r.enabled ? 20 : 2,
                      width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
                    }} />
                  </div>
                  <button
                    onClick={() => { setEditError(null); setEditTarget(r); }}
                    style={{ background: "none", border: "none", color: "var(--ion-color-primary)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <IonIcon icon={createOutline} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>
              </div>
            ))}
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບສະກຸນເງິນ"
        message={`ຕ້ອງການລຶບ "${deleteTarget ? CURRENCY_LABELS[deleteTarget.currency] : ""}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <style>{`.manage-fx-alert-error::part(message) { color: #dc2626; font-weight: 600; }`}</style>
      <IonAlert
        isOpen={!!editTarget}
        cssClass={editError ? "manage-fx-alert-error" : undefined}
        header={`ອັດຕາແລກປ່ຽນ ${editTarget ? CURRENCY_LABELS[editTarget.currency] : ""}`}
        message={editError ?? undefined}
        inputs={[{ name: "rate", type: "number", value: editTarget?.rate, placeholder: "ອັດຕາແລກປ່ຽນ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          {
            text: saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ",
            handler: async (data: { rate?: string }) => {
              const ok = await handleEditRate(data.rate ?? "");
              if (ok) setEditTarget(null);
              return ok;
            },
          },
        ]}
        onDidDismiss={() => { setEditTarget(null); setEditError(null); }}
      />
    </IonPage>
  );
};

export default ManageExchangeRates;
