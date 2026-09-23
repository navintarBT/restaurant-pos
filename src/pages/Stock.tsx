import { useCallback, useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonSpinner,
  IonButtons,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  useIonViewWillEnter,
} from "@ionic/react";
import { alertCircleOutline, warningOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getProducts } from "../data/productRepository";
import type { Product, ProductVariant } from "../data/types";
import ShopHeaderTag from "../components/ShopHeaderTag";

interface AlertEntry {
  product: Product;
  variant: ProductVariant;
}

// "ສະຕັອກ" — used to be a bell-icon notification on ເມນູ (Products.tsx),
// opening StockAlertSheet as a modal. Moved here as its own sidebar page
// instead, carrying the same alert count badge.
const Stock: React.FC = () => {
  const { shopId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setProducts(await getProducts(shopId));
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

  const outOfStock: AlertEntry[] = [];
  const lowStock: AlertEntry[] = [];
  products.forEach((p) => {
    p.variants.forEach((v) => {
      if (v.stock === 0) {
        outOfStock.push({ product: p, variant: v });
      } else if (v.stock <= (v.minStock ?? 5)) {
        lowStock.push({ product: p, variant: v });
      }
    });
  });
  const hasAlerts = outOfStock.length > 0 || lowStock.length > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
          </IonButtons>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle>ສະຕັອກ</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : !hasAlerts ? (
          <div style={{ textAlign: "center", padding: "64px 32px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <IonText color="medium">
              <p style={{ fontWeight: 600 }}>ສະຕັອກທຸກລາຍການຢູ່ໃນລະດັບດີ</p>
            </IonText>
          </div>
        ) : (
          <div style={{ padding: "8px 0 32px" }}>
            {outOfStock.length > 0 && (
              <>
                <div style={{ padding: "12px 16px 6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--app-danger)" }}>
                  ❌ ໝົດແລ້ວ — {outOfStock.length} variant
                </div>
                {outOfStock.map(({ product: p, variant: v }, i) => (
                  <IonItem key={i} lines="inset" style={{ "--background": "var(--app-danger-surface)" }}>
                    <IonIcon icon={alertCircleOutline} color="danger" slot="start" style={{ fontSize: 22 }} />
                    <IonLabel>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", marginTop: 2 }}>
                        {v.size} / {v.color}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--app-danger)", marginTop: 2 }}>ເມນູໝົດ</div>
                    </IonLabel>
                  </IonItem>
                ))}
              </>
            )}

            {lowStock.length > 0 && (
              <>
                <div style={{ padding: "16px 16px 6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--app-warning)" }}>
                  ⚠️ ໃກ້ໝົດ — {lowStock.length} variant
                </div>
                {lowStock.map(({ product: p, variant: v }, i) => (
                  <IonItem key={i} lines="inset" style={{ "--background": "var(--app-warning-surface)" }}>
                    <IonIcon icon={warningOutline} color="warning" slot="start" style={{ fontSize: 22 }} />
                    <IonLabel>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", marginTop: 2 }}>
                        {v.size} / {v.color}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--app-warning)", marginTop: 2 }}>
                        ເຫຼືອ {v.stock} ຊິ້ນ · ເຕືອນທີ່ ≤ {v.minStock ?? 5} ຊິ້ນ
                      </div>
                    </IonLabel>
                  </IonItem>
                ))}
              </>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Stock;
