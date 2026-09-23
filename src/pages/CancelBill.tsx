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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonAlert,
  useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getOpenOrders, getSalesByDateRange, cancelSale } from "../data/saleRepository";
import type { Sale } from "../data/types";
import { fmtK, fmtDateTime } from "../utils/format";
import DateRangeFilter, { todayStr, monthStartStr } from "../components/DateRangeFilter";
import EmptyState from "../components/EmptyState";

const STATUS_TEXT: Record<Sale["status"], string> = {
  pending: "ລໍຖ້າຄົວ", cooking: "ກຳລັງເຮັດ", ready: "ພ້ອມເສີບ", served: "ລໍຖ້າເກັບເງິນ",
  paid: "ຈ່າຍແລ້ວ", cancelled: "ຍົກເລີກແລ້ວ",
};

// "ຍົກເລີກບິນ" — cancels a bill in ANY state (still unpaid, or already
// paid) via cancelSale() (soft: keeps the doc with a reason, unlike the old
// hard-delete in SalesHistory.tsx). Shows up afterward in
// "ປະຫວັດການຍົກເລີກບິນ".
const CancelBill: React.FC = () => {
  const { shopId, user, displayName } = useAuth();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");

  const [unpaid, setUnpaid] = useState<Sale[]>([]);
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [paid, setPaid] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState<Sale | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUnpaid = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setUnpaid(await getOpenOrders(shopId, ["pending", "cooking", "ready", "served"]));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  const loadPaid = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const sales = await getSalesByDateRange(shopId, new Date(fromDate), new Date(toDate));
      setPaid(sales.filter((s) => s.status === "paid"));
    } finally {
      setLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  const load = useCallback(() => {
    if (tab === "unpaid") loadUnpaid();
    else loadPaid();
  }, [tab, loadUnpaid, loadPaid]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  async function handleConfirmCancel(reason: string) {
    if (!shopId || !target || !user) return false;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError("ກະລຸນາລະບຸເຫດຜົນ");
      return false;
    }
    setCancelling(true);
    setError(null);
    try {
      await cancelSale(shopId, target, {
        reason: trimmed, restoreStock: true,
        cancelledByUid: user.uid, cancelledByName: displayName,
      });
      setTarget(null);
      await load();
      return true;
    } catch {
      setError("ຍົກເລີກບໍ່ສຳເລັດ, ລອງໃໝ່");
      return false;
    } finally {
      setCancelling(false);
    }
  }

  const list = tab === "unpaid" ? unpaid : paid;

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
          <IonTitle>ຍົກເລີກບິນ</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as "unpaid" | "paid")}>
            <IonSegmentButton value="unpaid">
              <IonLabel>ບິນທີ່ຍັງບໍ່ຈ່າຍ</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="paid">
              <IonLabel>ບິນທີ່ຈ່າຍແລ້ວ</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
        {tab === "paid" && (
          <IonToolbar>
            <div style={{ padding: "0 12px 10px" }}>
              <DateRangeFilter from={fromDate} to={toDate} setFrom={setFromDate} setTo={setToDate} disabled={loading} />
            </div>
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent>
        <div style={{ padding: "12px 16px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon="🧾" title={tab === "unpaid" ? "ບໍ່ມີບິນທີ່ຍັງບໍ່ຈ່າຍ" : "ບໍ່ມີບິນທີ່ຈ່າຍແລ້ວໃນຊ່ວງນີ້"} />
          ) : (
            list.map((sale) => (
              <div key={sale.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12, border: "1px solid var(--app-border)", marginBottom: 8,
                background: "var(--app-surface)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: "0.92rem" }}>
                    {sale.tableLabel ? `ໂຕະ ${sale.tableLabel}` : "ຂາຍໜ້າຮ້ານ"}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                    {sale.items.length} ລາຍການ · {fmtK(sale.total)} ກີບ · {STATUS_TEXT[sale.status]}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-muted)" }}>
                    {fmtDateTime(sale.createdAt)}
                  </p>
                </div>
                <IonButton
                  fill="outline" color="danger" size="small"
                  onClick={() => { setReasonError(null); setTarget(sale); }}
                  style={{ "--border-radius": "10px", flexShrink: 0 }}
                >
                  <IonIcon slot="start" icon={trashOutline} />
                  ຍົກເລີກ
                </IonButton>
              </div>
            ))
          )}
          {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
        </div>
      </IonContent>

      <style>{`.cancel-bill-alert-error::part(message) { color: #dc2626; font-weight: 600; }`}</style>
      <IonAlert
        isOpen={!!target}
        cssClass={reasonError ? "cancel-bill-alert-error" : undefined}
        header="ຍົກເລີກບິນ"
        message={reasonError ?? `ຍົກເລີກ${target?.tableLabel ? ` ໂຕະ ${target.tableLabel}` : ""} ${target ? fmtK(target.total) : ""} ກີບ — ເມນູຈະຄືນສູ່ສະຕັອກ`}
        inputs={[{ name: "reason", type: "textarea", placeholder: "ເຫດຜົນທີ່ຍົກເລີກ (ຈຳເປັນ)" }]}
        buttons={[
          { text: "ປິດ", role: "cancel", handler: () => setTarget(null) },
          {
            text: cancelling ? "ກຳລັງຍົກເລີກ..." : "ຢືນຢັນຍົກເລີກ",
            role: "destructive",
            handler: async (data: { reason?: string }) => handleConfirmCancel(data.reason ?? ""),
          },
        ]}
        onDidDismiss={() => { setTarget(null); setReasonError(null); }}
      />
    </IonPage>
  );
};

export default CancelBill;
