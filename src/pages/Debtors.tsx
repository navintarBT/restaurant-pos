import { useCallback, useEffect, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonSpinner, IonMenuButton,
  IonModal, IonAlert, IonSearchbar, useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline, cashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getAllCustomerCredits, getCreditTransactions, recordCreditPayment } from "../data/creditRepository";
import { fmtK, fmtDateTime } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { CustomerCredit, CreditTransaction } from "../data/types";

// ລູກໜີ້ — customers with an outstanding (or, rarely, negative/overpaid)
// ຕິດໜີ້ balance. Charges land here automatically the instant a bill is
// closed on credit (see closeBill in saleRepository.ts); this page is only
// for reviewing who owes what and recording them paying it down.
const Debtors: React.FC = () => {
  const { shopId, user, displayName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<CustomerCredit | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const all = await getAllCustomerCredits(shopId);
      setCredits(all.sort((a, b) => b.balance - a.balance));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  async function openDetail(c: CustomerCredit) {
    setTarget(c);
    setTxLoading(true);
    try {
      if (shopId) setTransactions(await getCreditTransactions(shopId, c.customerId));
    } finally {
      setTxLoading(false);
    }
  }

  async function handleRecordPayment(amountRaw: string) {
    const amount = parseInt(amountRaw, 10);
    if (!shopId || !target || !Number.isFinite(amount) || amount <= 0) return;
    setPaying(true);
    setError(null);
    try {
      await recordCreditPayment(shopId, {
        customerId: target.customerId,
        customerName: target.customerName,
        amount,
        createdByUid: user?.uid,
        createdByName: displayName,
      });
      setPayOpen(false);
      setTarget(null);
      await load();
    } catch {
      setError("ບັນທຶກການຮັບຊຳລະບໍ່ສຳເລັດ — ລອງໃໝ່");
    } finally {
      setPaying(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q ? credits.filter((c) => c.customerName.toLowerCase().includes(q)) : credits;
  const totalOwed = credits.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
            <IonButton routerLink="/tabs/summary" routerDirection="back">
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ລູກໜີ້</IonTitle>
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
            {credits.length > 0 && (
              <div style={{
                background: "var(--app-warning-surface)", borderRadius: 14, padding: "14px 16px", marginBottom: 14,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ຍອດຄ້າງທັງໝົດ</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--app-warning)" }}>{fmtK(totalOwed)} ກີບ</span>
              </div>
            )}
            <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? "")} placeholder="ຄົ້ນຫາຊື່ລູກຄ້າ" style={{ padding: 0, marginBottom: 10 }} />

            {credits.length === 0 && <EmptyState icon="✅" title="ບໍ່ມີລູກຄ້າຄ້າງຈ່າຍ" />}
            {credits.length > 0 && filtered.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບລູກຄ້າທີ່ຄົ້ນຫາ" />}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openDetail(c)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid var(--app-border)", background: "var(--app-surface)",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--ion-text-color)" }}>{c.customerName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>ອັບເດດ {fmtDateTime(c.updatedAt)}</p>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: c.balance > 0 ? "var(--app-warning)" : "var(--app-success)" }}>
                    {fmtK(Math.abs(c.balance))} ກີບ {c.balance < 0 ? "(ເກີນ)" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </IonContent>

      <IonModal isOpen={!!target} onDidDismiss={() => setTarget(null)} initialBreakpoint={0.65} breakpoints={[0, 0.65, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>{target?.customerName}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setTarget(null)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "12px 16px 8px" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--app-warning-surface)", borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ຍອດຄ້າງ</span>
              <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--app-warning)" }}>{fmtK(target?.balance ?? 0)} ກີບ</span>
            </div>
            <IonButton expand="block" onClick={() => setPayOpen(true)} style={{ marginBottom: 14, "--border-radius": "12px" }}>
              <IonIcon slot="start" icon={cashOutline} />
              ຮັບຊຳລະ
            </IonButton>

            <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ປະຫວັດ</p>
            {txLoading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <IonSpinner name="crescent" color="primary" />
              </div>
            )}
            {!txLoading && transactions.length === 0 && <EmptyState icon="🧾" title="ຍັງບໍ່ມີປະຫວັດ" />}
            {!txLoading && transactions.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--app-border)" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-text-color)" }}>
                    {t.type === "charge" ? "ຕິດໜີ້ໃໝ່" : "ຮັບຊຳລະ"} {t.billNumber ? `· ${t.billNumber}` : ""}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>{fmtDateTime(t.createdAt)}</p>
                </div>
                <span style={{ fontWeight: 700, color: t.type === "charge" ? "var(--app-warning)" : "var(--app-success)" }}>
                  {t.type === "charge" ? "+" : "−"}{fmtK(t.amount)} ກີບ
                </span>
              </div>
            ))}
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={payOpen}
        header="ຮັບຊຳລະ"
        message={`ຍອດຄ້າງ ${fmtK(target?.balance ?? 0)} ກີບ`}
        inputs={[{ name: "amount", type: "number", placeholder: "ຈຳນວນເງິນ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setPayOpen(false) },
          { text: paying ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ", handler: (data) => handleRecordPayment(data.amount ?? "") },
        ]}
        onDidDismiss={() => setPayOpen(false)}
      />
      <IonAlert isOpen={!!error} header="ຂໍ້ຜິດພາດ" message={error ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setError(null)} />
    </IonPage>
  );
};

export default Debtors;
