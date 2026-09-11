import { useCallback, useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonSpinner,
  IonModal,
  useIonViewWillEnter,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { getOpenSessions, closeSession } from "../data/tableSessionRepository";
import { getOrdersBySession, closeBill } from "../data/saleRepository";
import { fmtK } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { PaymentType, Sale, TableSession } from "../data/types";

interface TableBill {
  session: TableSession;
  orders: Sale[];
  total: number;
}

function saleItemLabel(item: Sale["items"][number]): string {
  const v = [item.variant.size, item.variant.color].filter((s) => s && s !== "__bundle__").join("/");
  return v ? `${item.productName} (${v})` : item.productName;
}

const CheckBill: React.FC = () => {
  const { shopId } = useAuth();
  const [bills, setBills] = useState<TableBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TableBill | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const sessions = await getOpenSessions(shopId);
      const withOrders = await Promise.all(
        sessions.map(async (session) => {
          const orders = await getOrdersBySession(shopId, session.id);
          return { session, orders, total: orders.reduce((s, o) => s + o.total, 0) };
        })
      );
      // Tables that opened but never actually ordered anything aren't a bill yet.
      setBills(withOrders.filter((b) => b.orders.length > 0));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  async function handleRefresh(e: CustomEvent) {
    await load();
    (e.target as HTMLIonRefresherElement).complete();
  }

  async function handleClose(paymentType: PaymentType) {
    if (!shopId || !target) return;
    setClosing(true);
    setError(null);
    try {
      await closeBill(shopId, target.orders.map((o) => o.id), paymentType);
      await closeSession(shopId, target.session.id);
      setBills((prev) => prev.filter((b) => b.session.id !== target.session.id));
      setTarget(null);
    } catch {
      setError("ປິດບິນບໍ່ສຳເລັດ, ກະລຸນາລອງໃໝ່");
    } finally {
      setClosing(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ເຊັກບິນ</IonTitle>
          <IonButtons slot="end">
            <IonMenuButton autoHide={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}
        {!loading && bills.length === 0 && <EmptyState icon="🧾" title="ບໍ່ມີໂຕະລໍຖ້າເກັບເງິນ" />}

        <div style={{ padding: "12px 16px 28px", display: "grid", gap: 12 }}>
          {bills.map((bill) => {
            const qty = bill.orders.reduce((s, o) => s + o.items.reduce((is, i) => is + i.quantity, 0), 0);
            return (
              <div
                key={bill.session.id}
                onClick={() => setTarget(bill)}
                style={{
                  background: "var(--app-warning-surface)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.07)", border: "1.5px solid var(--app-warning)",
                  cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem", color: "var(--ion-text-color)" }}>
                    {bill.session.tableLabel}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                    {bill.orders.length} ອໍເດີ້ · {qty} ຈານ
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                    {fmtK(bill.total)} ກີບ
                  </div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--app-warning)" }}>ປິດບິນ ›</div>
                </div>
              </div>
            );
          })}
        </div>
      </IonContent>

      <IonModal
        isOpen={!!target}
        onDidDismiss={() => { setTarget(null); setError(null); }}
        initialBreakpoint={0.6}
        breakpoints={[0, 0.6, 1]}
        canDismiss={async () => !closing}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>{target?.session.tableLabel}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setTarget(null)} disabled={closing}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "8px 16px 32px" }}>
            {target && (
              <div style={{ marginBottom: 16 }}>
                {target.orders.map((order) => (
                  <div key={order.id} style={{ marginBottom: 8 }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", padding: "4px 0" }}>
                        <span style={{ color: "var(--ion-text-color)" }}>{saleItemLabel(item)} ×{item.quantity}</span>
                        <span style={{ fontWeight: 600 }}>{fmtK(item.unitPrice * item.quantity)} ກີບ</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--app-border)",
                }}>
                  <span style={{ fontWeight: 700 }}>ຍອດລວມ ({target.orders.length} ອໍເດີ້)</span>
                  <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--ion-color-primary)" }}>{fmtK(target.total)} ກີບ</span>
                </div>
              </div>
            )}

            <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
              ຈ່າຍດ້ວຍຫຍັງ?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {(
                [
                  { v: "cash" as const, label: "💵 ສົດ", color: "var(--app-success)" },
                  { v: "qr" as const, label: "📱 ໂອນ", color: "var(--app-info)" },
                  { v: "cod" as const, label: "📦 COD", color: "var(--app-warning)" },
                ]
              ).map(({ v, label, color }) => (
                <button
                  key={v}
                  disabled={closing}
                  onClick={() => handleClose(v)}
                  style={{
                    flex: 1, padding: "14px 0", borderRadius: 12, border: "none",
                    background: color, color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                    cursor: closing ? "not-allowed" : "pointer", opacity: closing ? 0.6 : 1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.85rem", marginTop: 12 }}>{error}</p>}
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default CheckBill;
