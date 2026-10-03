import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonSpinner, IonMenuButton,
  IonModal, IonAlert, IonSearchbar, IonInput, useIonViewWillEnter,
} from "@ionic/react";
import { chevronBackOutline, addOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getAllDeposits, getCustomerDeposits, getDepositTransactions, depositProduct, withdrawProduct } from "../data/depositRepository";
import { getProducts } from "../data/productRepository";
import { fmtDateTime } from "../utils/format";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import CustomerPicker from "../components/CustomerPicker";
import type { ProductDeposit, DepositTransaction, Customer, Product } from "../data/types";

interface CustomerGroup {
  customerId: string;
  customerName: string;
  items: ProductDeposit[];
}

// ຝາກ — bottle-keeping. A customer leaves the rest of what they bought (a
// drink, most often) in storage at the shop to reclaim on a future visit.
// Recording a deposit assumes staff only do it for something already paid
// for; nothing here cross-checks a specific Sale doc for that.
const Deposits: React.FC = () => {
  const { shopId, user, displayName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<ProductDeposit[]>([]);
  const [search, setSearch] = useState("");

  const [target, setTarget] = useState<CustomerGroup | null>(null);
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<ProductDeposit | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addCustomer, setAddCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [addProduct, setAddProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setDeposits(await getAllDeposits(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const byCustomer = new Map<string, CustomerGroup>();
    for (const d of deposits) {
      const g = byCustomer.get(d.customerId) ?? { customerId: d.customerId, customerName: d.customerName, items: [] };
      g.items.push(d);
      byCustomer.set(d.customerId, g);
    }
    return Array.from(byCustomer.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [deposits]);

  const q = search.trim().toLowerCase();
  const filtered = q ? groups.filter((g) => g.customerName.toLowerCase().includes(q)) : groups;

  async function openDetail(g: CustomerGroup) {
    setTarget(g);
    setTxLoading(true);
    try {
      if (shopId) setTransactions(await getDepositTransactions(shopId, g.customerId));
    } finally {
      setTxLoading(false);
    }
  }

  async function openAdd() {
    setAddCustomer(null);
    setAddProduct(null);
    setProductSearch("");
    setAddQty("");
    setError(null);
    setAddOpen(true);
    if (shopId && products.length === 0) {
      try { setProducts(await getProducts(shopId)); } catch { /* ignore */ }
    }
  }

  async function handleConfirmAdd() {
    const qty = parseFloat(addQty);
    if (!shopId || !addCustomer || !addProduct || !Number.isFinite(qty) || qty <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await depositProduct(shopId, {
        customerId: addCustomer.id,
        customerName: addCustomer.name,
        productId: addProduct.id,
        productName: addProduct.name,
        quantity: qty,
        createdByUid: user?.uid,
        createdByName: displayName,
      });
      setAddOpen(false);
      await load();
    } catch {
      setError("ບັນທຶກການຝາກບໍ່ສຳເລັດ — ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw(qtyRaw: string) {
    const qty = parseFloat(qtyRaw);
    if (!shopId || !withdrawTarget || !Number.isFinite(qty) || qty <= 0) return;
    try {
      await withdrawProduct(shopId, {
        customerId: withdrawTarget.customerId,
        customerName: withdrawTarget.customerName,
        productId: withdrawTarget.productId,
        productName: withdrawTarget.productName,
        quantity: qty,
        createdByUid: user?.uid,
        createdByName: displayName,
      });
      setWithdrawTarget(null);
      await load();
      if (target) {
        const freshItems = await getCustomerDeposits(shopId, target.customerId);
        if (freshItems.length === 0) {
          setTarget(null);
        } else {
          setTarget({ ...target, items: freshItems });
          setTransactions(await getDepositTransactions(shopId, target.customerId));
        }
      }
    } catch {
      setError("ບັນທຶກການຖອນບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  const pq = productSearch.trim().toLowerCase();
  const filteredProducts = pq ? products.filter((p) => p.name.toLowerCase().includes(pq)) : products;

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
          <IonTitle>ຝາກ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={openAdd}>
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
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
            <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? "")} placeholder="ຄົ້ນຫາຊື່ລູກຄ້າ" style={{ padding: 0, marginBottom: 10 }} />

            {groups.length === 0 && <EmptyState icon="🍾" title="ຍັງບໍ່ມີການຝາກ" />}
            {groups.length > 0 && filtered.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບລູກຄ້າທີ່ຄົ້ນຫາ" />}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((g) => (
                <div
                  key={g.customerId}
                  onClick={() => openDetail(g)}
                  style={{
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    border: "1px solid var(--app-border)", background: "var(--app-surface)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--ion-text-color)" }}>{g.customerName}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                    {g.items.map((it) => `${it.productName} ×${it.quantity}`).join(" · ")}
                  </p>
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
            <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ຝາກໄວ້</p>
            {target?.items.map((it) => (
              <div key={it.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0", borderBottom: "1px solid var(--app-border)",
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem", color: "var(--ion-text-color)" }}>{it.productName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>ເຫຼືອ {it.quantity}</p>
                </div>
                <IonButton size="small" fill="outline" onClick={() => setWithdrawTarget(it)}>ຖອນ</IonButton>
              </div>
            ))}

            <p style={{ margin: "16px 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ປະຫວັດ</p>
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
                    {t.type === "deposit" ? "ຝາກ" : "ຖອນ"} · {t.productName}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>{fmtDateTime(t.createdAt)}</p>
                </div>
                <span style={{ fontWeight: 700, color: t.type === "deposit" ? "var(--app-success)" : "var(--app-warning)" }}>
                  {t.type === "deposit" ? "+" : "−"}{t.quantity}
                </span>
              </div>
            ))}
          </div>
        </IonContent>
      </IonModal>

      <IonModal isOpen={addOpen} onDidDismiss={() => setAddOpen(false)} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ຝາກໃໝ່</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setAddOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "12px 16px 32px" }}>
            <div style={{ marginBottom: 14 }}>
              <CustomerPicker shopId={shopId ?? undefined} value={addCustomer} onChange={setAddCustomer} required />
            </div>

            <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ສິນຄ້າ</p>
            {addProduct ? (
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                border: "1.5px solid var(--ion-color-primary)", borderRadius: 10, padding: "10px 12px", marginBottom: 14,
              }}>
                <span style={{ fontWeight: 600 }}>{addProduct.name}</span>
                <IonButton size="small" fill="clear" onClick={() => setAddProduct(null)}>ປ່ຽນ</IonButton>
              </div>
            ) : (
              <>
                <IonSearchbar value={productSearch} onIonInput={(e) => setProductSearch(e.detail.value ?? "")} placeholder="ຄົ້ນຫາສິນຄ້າ" style={{ padding: 0, marginBottom: 8 }} />
                <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
                  {filteredProducts.slice(0, 50).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setAddProduct(p)}
                      style={{ padding: "10px 8px", borderBottom: "1px solid var(--app-border)", cursor: "pointer" }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>ຈຳນວນ</p>
            <IonInput
              type="number" inputmode="decimal" value={addQty}
              onIonInput={(e) => setAddQty(String(e.detail.value ?? ""))}
              placeholder="0" fill="outline"
              style={{ marginBottom: 16, "--padding-start": "12px" }}
            />

            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}

            <IonButton
              expand="block"
              disabled={!addCustomer || !addProduct || !addQty || saving}
              onClick={handleConfirmAdd}
              style={{ minHeight: 52, "--border-radius": "14px", margin: 0 }}
            >
              {saving ? <IonSpinner name="dots" style={{ width: 20, height: 20 }} /> : "ບັນທຶກການຝາກ"}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={!!withdrawTarget}
        header="ຖອນ"
        message={withdrawTarget ? `${withdrawTarget.productName} — ເຫຼືອ ${withdrawTarget.quantity}` : ""}
        inputs={[{ name: "qty", type: "number", placeholder: "ຈຳນວນທີ່ຈະຖອນ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setWithdrawTarget(null) },
          { text: "ຖອນ", handler: (data) => handleWithdraw(data.qty ?? "") },
        ]}
        onDidDismiss={() => setWithdrawTarget(null)}
      />
      <IonAlert isOpen={!!error && !addOpen} header="ຂໍ້ຜິດພາດ" message={error ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setError(null)} />
    </IonPage>
  );
};

export default Deposits;
