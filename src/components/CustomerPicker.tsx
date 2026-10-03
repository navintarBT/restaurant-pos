import { useEffect, useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonIcon, IonSearchbar, IonAlert,
} from "@ionic/react";
import { addOutline, checkmarkOutline, chevronDownOutline, personOutline } from "ionicons/icons";
import { getCustomers, addCustomer } from "../data/customerRepository";
import type { Customer } from "../data/types";

interface Props {
  shopId?: string;
  // null = "ລູກຄ້າທົ່ວໄປ" (walk-in, no customer linked) — the default for
  // cash/transfer/split; ຕິດໜີ້ mode requires a real customer instead.
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  required?: boolean;
}

const PHONE_RE = /^\d{8}$/;

// Tappable field + search sheet over the existing shop-wide Customers list
// (getCustomers/addCustomer, same data ManageCustomers.tsx/CustomerForm.tsx
// use) — with a quick inline "+ add new" so a first-time credit customer
// doesn't need a trip to the full customer-management page first.
const CustomerPicker: React.FC<Props> = ({ shopId, value, onChange, required }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sheetOpen && shopId) {
      setLoading(true);
      getCustomers(shopId).then(setCustomers).catch(() => {}).finally(() => setLoading(false));
    }
  }, [sheetOpen, shopId]);

  const q = search.trim().toLowerCase();
  const filtered = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : customers;

  async function handleCreate(phone: string, name: string) {
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    if (!shopId || !trimmedName) return;
    if (!PHONE_RE.test(trimmedPhone)) {
      setError("ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ໂຕ");
      return;
    }
    if (customers.some((c) => c.phone === trimmedPhone)) {
      setError(`ເບີ "${trimmedPhone}" ມີລູກຄ້ານີ້ຢູ່ແລ້ວ`);
      return;
    }
    try {
      await addCustomer(shopId, { phone: trimmedPhone, name: trimmedName, enabled: true });
      const newCustomer: Customer = { id: trimmedPhone, phone: trimmedPhone, name: trimmedName, enabled: true };
      setCustomers((prev) => [...prev, newCustomer]);
      onChange(newCustomer);
      setSheetOpen(false);
    } catch {
      setError("ເພີ່ມລູກຄ້າບໍ່ສຳເລັດ — ລອງໃໝ່");
    }
  }

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          borderRadius: 10, cursor: "pointer",
          border: `1.5px solid ${required && !value ? "var(--app-danger)" : "var(--app-border)"}`,
          background: "var(--app-surface)",
        }}
      >
        <IonIcon icon={personOutline} style={{ color: "var(--app-text-muted)", fontSize: 18 }} />
        <span style={{ flex: 1, fontSize: "0.92rem", fontWeight: 600, color: value ? "var(--ion-text-color)" : "var(--app-text-muted)" }}>
          {value ? `${value.name} (${value.phone})` : "ລູກຄ້າທົ່ວໄປ"}
        </span>
        <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 16 }} />
      </div>
      {required && !value && (
        <p style={{ margin: "4px 0 0", fontSize: "0.72rem", fontWeight: 600, color: "var(--app-danger)" }}>
          ⚠ ຕິດໜີ້ຕ້ອງເລືອກລູກຄ້າ
        </p>
      )}

      <IonModal isOpen={sheetOpen} onDidDismiss={() => setSheetOpen(false)} initialBreakpoint={0.7} breakpoints={[0, 0.7, 1]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: "1rem" }}>ເລືອກລູກຄ້າ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setSheetOpen(false)}>ປິດ</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: "10px 12px" }}>
            <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? "")} placeholder="ຄົ້ນຫາຊື່ ຫຼື ເບີໂທ" style={{ padding: 0 }} />
          </div>
          <IonItem detail={false} style={{ "--background": "#fff8f5" }}>
            <IonButton fill="clear" size="small" onClick={() => setNewAlertOpen(true)}
              style={{ fontWeight: 700, fontSize: "0.88rem", "--padding-start": "4px", "--padding-end": "8px" }}>
              <IonIcon slot="start" icon={addOutline} />
              ເພີ່ມລູກຄ້າໃໝ່
            </IonButton>
          </IonItem>
          {!required && (
            <IonItem button detail={false} onClick={() => { onChange(null); setSheetOpen(false); }}>
              <IonLabel style={{ color: "var(--app-text-secondary)" }}>ລູກຄ້າທົ່ວໄປ</IonLabel>
              {!value && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            </IonItem>
          )}
          {!loading && filtered.map((c) => (
            <IonItem key={c.id} button detail={false} onClick={() => { onChange(c); setSheetOpen(false); }}>
              <IonLabel>
                <span style={{ fontWeight: value?.id === c.id ? 700 : 400 }}>{c.name}</span>
                <p style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>{c.phone}</p>
              </IonLabel>
              {value?.id === c.id && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            </IonItem>
          ))}
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={newAlertOpen}
        header="ເພີ່ມລູກຄ້າໃໝ່"
        inputs={[
          { name: "phone", type: "tel", placeholder: "ເບີໂທ (8 ໂຕ)" },
          { name: "name", type: "text", placeholder: "ຊື່ລູກຄ້າ" },
        ]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewAlertOpen(false) },
          { text: "ເພີ່ມ", handler: (data) => { handleCreate(data.phone ?? "", data.name ?? ""); setNewAlertOpen(false); } },
        ]}
        onDidDismiss={() => setNewAlertOpen(false)}
      />
      <IonAlert isOpen={!!error} header="ຂໍ້ຜິດພາດ" message={error ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setError(null)} />
    </>
  );
};

export default CustomerPicker;
