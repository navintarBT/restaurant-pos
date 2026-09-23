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
  useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getSalesByDateRange } from "../data/saleRepository";
import type { Sale } from "../data/types";
import { fmtK, fmtDateTime } from "../utils/format";
import DateRangeFilter, { todayStr, monthStartStr } from "../components/DateRangeFilter";
import EmptyState from "../components/EmptyState";

// "ປະຫວັດການຍົກເລີກບິນ" — read-only log of every bill cancelled via
// CancelBill.tsx (status:"cancelled"), with who/when/why — the audit trail
// the old hard-delete in SalesHistory.tsx never kept.
const CancelledBillHistory: React.FC = () => {
  const { shopId } = useAuth();
  const [fromDate, setFromDate] = useState(monthStartStr());
  const [toDate, setToDate] = useState(todayStr());
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const all = await getSalesByDateRange(shopId, new Date(fromDate), new Date(toDate));
      setSales(all.filter((s) => s.status === "cancelled"));
    } finally {
      setLoading(false);
    }
  }, [shopId, fromDate, toDate]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  const totalCancelled = sales.reduce((s, sale) => s + sale.total, 0);

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
          <IonTitle>ປະຫວັດການຍົກເລີກບິນ</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <div style={{ padding: "0 12px 10px" }}>
            <DateRangeFilter from={fromDate} to={toDate} setFrom={setFromDate} setTo={setToDate} disabled={loading} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: "12px 16px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : sales.length === 0 ? (
            <EmptyState icon="🗒️" title="ບໍ່ມີບິນທີ່ຍົກເລີກໃນຊ່ວງນີ້" />
          ) : (
            <>
              <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                ຍົກເລີກທັງໝົດ {sales.length} ບິນ — ມູນຄ່າລວມ {fmtK(totalCancelled)} ກີບ
              </p>
              {sales.map((sale) => (
                <div key={sale.id} style={{
                  padding: "12px 14px", borderRadius: 12, border: "1px solid var(--app-border)",
                  borderLeft: "4px solid var(--app-danger)", marginBottom: 8, background: "var(--app-surface)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.92rem" }}>
                      {sale.tableLabel ? `ໂຕະ ${sale.tableLabel}` : "ຂາຍໜ້າຮ້ານ"}
                    </p>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: "0.92rem", color: "var(--app-danger)" }}>
                      {fmtK(sale.total)} ກີບ
                    </p>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                    {sale.items.length} ລາຍການ · ສ້າງເມື່ອ {fmtDateTime(sale.createdAt)}
                  </p>
                  {sale.cancelReason && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--ion-text-color)" }}>
                      ເຫດຜົນ: {sale.cancelReason}
                    </p>
                  )}
                  <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--app-text-muted)" }}>
                    ຍົກເລີກໂດຍ {sale.cancelledByName || "-"}{sale.cancelledAt ? ` · ${fmtDateTime(sale.cancelledAt)}` : ""}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CancelledBillHistory;
