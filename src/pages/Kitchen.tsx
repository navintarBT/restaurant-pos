import { useEffect, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonSpinner,
} from "@ionic/react";
import { useAuth } from "../context/AuthContext";
import { subscribeToOpenOrders, advanceOrderStatus } from "../data/saleRepository";
import { playOrderAlert } from "../utils/notifySound";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import type { Sale } from "../data/types";

function timeAgo(d: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "ຫາກໍ່";
  if (mins < 60) return `${mins} ນາທີກ່ອນ`;
  return `${Math.floor(mins / 60)} ຊມ ${mins % 60} ນທ ກ່ອນ`;
}

const Kitchen: React.FC = () => {
  const { shopId } = useAuth();
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // null until the first snapshot lands — lets us tell "new order arrived
  // while I was watching" (play a sound) apart from "just loaded the
  // already-existing queue" (stay quiet).
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    knownIds.current = null;
    const unsubscribe = subscribeToOpenOrders(shopId, ["pending", "cooking"], (newOrders) => {
      const ids = new Set(newOrders.map((o) => o.id));
      if (knownIds.current !== null && [...ids].some((id) => !knownIds.current!.has(id))) {
        playOrderAlert();
      }
      knownIds.current = ids;
      setOrders(newOrders);
      setLoading(false);
    });
    return unsubscribe;
  }, [shopId]);

  async function advance(order: Sale) {
    if (!shopId) return;
    const next = order.status === "pending" ? "cooking" : "ready";
    setBusyId(order.id);
    try {
      await advanceOrderStatus(shopId, order.id, next);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
          </IonButtons>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ຫ້ອງຄົວ</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}
        {!loading && orders.length === 0 && <EmptyState icon="👨‍🍳" title="ບໍ່ມີອໍເດີ້ຄ້າງ" />}

        <div style={{ padding: "12px 16px 28px", display: "grid", gap: 12 }}>
          {orders.map((order) => {
            const isCooking = order.status === "cooking";
            return (
              <div
                key={order.id}
                style={{
                  background: "var(--app-surface)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                  border: `1.5px solid ${isCooking ? "var(--app-warning)" : "var(--app-border)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ion-text-color)" }}>
                    {order.tableLabel || "ບໍ່ລະບຸໂຕະ"}
                  </span>
                  <span style={{
                    fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                    background: isCooking ? "var(--app-warning-surface)" : "var(--app-surface-alt)",
                    color: isCooking ? "var(--app-warning)" : "var(--app-text-secondary)",
                  }}>
                    {isCooking ? "ກຳລັງເຮັດ" : "ລໍຖ້າ"} · {timeAgo(order.createdAt)}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <span style={{ color: "var(--ion-text-color)" }}>
                        {item.productName}{item.variant.color && item.variant.color !== "__bundle__" ? ` (${item.variant.size}/${item.variant.color})` : item.variant.size ? ` (${item.variant.size})` : ""}
                        {item.selectedFlavors?.length ? ` · ${item.selectedFlavors.join("+")}` : ""}
                        {item.selectedToppings?.length ? ` · ${item.selectedToppings.join(", ")}` : ""}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--ion-color-primary)" }}>×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <IonButton
                  expand="block"
                  color={isCooking ? "success" : "primary"}
                  disabled={busyId === order.id}
                  onClick={() => advance(order)}
                  style={{ "--border-radius": "10px", height: 42 }}
                >
                  {busyId === order.id
                    ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} />
                    : isCooking ? "ພ້ອມເສີບແລ້ວ" : "ເລີ່ມເຮັດ"
                  }
                </IonButton>
              </div>
            );
          })}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Kitchen;
