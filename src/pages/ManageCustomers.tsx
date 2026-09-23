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
  IonSearchbar,
  IonModal,
  IonInput,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, addOutline, chevronBackOutline, createOutline, filterOutline, callOutline, locationOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getCustomers, deleteCustomer } from "../data/customerRepository";
import type { Customer } from "../data/types";
import EmptyState from "../components/EmptyState";

// Customer CREATE/EDIT both live on their own page (CustomerForm.tsx,
// reached via the "+" button or a row's edit icon) — this page is just a
// read-only list, so there's nothing staged here that needs its own "save"
// button; delete applies immediately.
const ManageCustomers: React.FC = () => {
  const { shopId, role } = useAuth();
  // Deleting a customer is owner-only, same restriction as categories.
  const isOwner = role === "customer";
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"az" | "za">("az");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setCustomers(await getCustomers(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  // getCustomers() already returns them ordered by name (A→Z) — "za" is just
  // that reversed.
  const processed: Customer[] = (() => {
    let list = customers;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    if (sortOrder === "za") list = [...list].reverse();
    if (pageSize !== "all") list = list.slice(0, pageSize);
    return list;
  })();

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCustomer(shopId, deleteTarget.phone);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
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
            <IonButton routerLink="/tabs/products" routerDirection="back">
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>ຂໍ້ມູນລູກຄ້າ</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/customer-form">
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                ສະແດງ {processed.length} ຈາກ {customers.length} ລູກຄ້າ
              </p>
              <IonButton routerLink="/tabs/customer-form" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                <IonIcon slot="start" icon={addOutline} />
                ເພີ່ມລູກຄ້າ
              </IonButton>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາຊື່ ຫຼື ເບີໂທ"
                style={{ padding: 0, flex: 1 }}
              />
              <IonButton
                fill={pageSize !== "all" || sortOrder !== "az" ? "solid" : "outline"}
                onClick={() => setFilterOpen(true)}
                style={{ margin: 0, height: 44, flexShrink: 0, "--border-radius": "10px" }}
              >
                <IonIcon slot="icon-only" icon={filterOutline} />
              </IonButton>
            </div>

            <IonModal
              isOpen={filterOpen}
              onDidDismiss={() => setFilterOpen(false)}
              initialBreakpoint={0.85}
              breakpoints={[0, 0.5, 0.85]}
            >
              <IonHeader>
                <IonToolbar>
                  <IonTitle style={{ fontSize: "1rem" }}>ຕົວກອງ</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setFilterOpen(false)}>ປິດ</IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent>
                <div style={{ padding: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                    1. ຈຳນວນລາຍການທີ່ຢາກໃຫ້ສະແດງ
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {([10, 20, 50, "all"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setPageSize(v)}
                        style={{
                          padding: "7px 14px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${pageSize === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          background: pageSize === v ? "var(--ion-color-primary)" : "transparent",
                          color: pageSize === v ? "#fff" : "var(--app-text-secondary)",
                        }}
                      >
                        {v === "all" ? "ທັງໝົດ" : `${v}`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", flexShrink: 0 }}>ຫຼືກຳນົດເອງ:</span>
                    <IonInput
                      type="number" min="1" placeholder="ເຊັ່ນ: 15"
                      value={pageSize === "all" ? "" : pageSize}
                      onIonInput={(e) => {
                        const v = e.detail.value ?? "";
                        if (!v.trim()) return;
                        setPageSize(Math.max(1, parseInt(v, 10) || 1));
                      }}
                      fill="outline" style={{ "--border-radius": "8px", flex: 1 }}
                    />
                  </div>

                  <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                    2. ຈັດລຽງ
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(
                      [
                        { v: "az" as const, label: "ກ-ຮ" },
                        { v: "za" as const, label: "ຮ-ກ" },
                      ]
                    ).map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => setSortOrder(v)}
                        style={{
                          flex: 1, padding: "12px 0", borderRadius: 10, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${sortOrder === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          background: sortOrder === v ? "var(--app-accent-surface)" : "transparent",
                          color: sortOrder === v ? "var(--ion-color-primary)" : "var(--app-text-secondary)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </IonContent>
            </IonModal>

            {customers.length === 0 && <EmptyState icon="🧑‍🤝‍🧑" title="ຍັງບໍ່ມີລູກຄ້າ" subtitle="ກົດ 'ເພີ່ມລູກຄ້າ' ເພື່ອເລີ່ມ" />}
            {customers.length > 0 && processed.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບລູກຄ້າທີ່ຄົ້ນຫາ" />}
            {processed.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--app-border)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>{c.name}</p>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      color: c.enabled ? "var(--app-success)" : "var(--app-danger)",
                      background: c.enabled ? "var(--app-success-surface)" : "var(--app-danger-surface)",
                    }}>
                      {c.enabled ? "ໃຊ້ງານ" : "ບໍ່ໃຊ້ງານ"}
                    </span>
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                    <IonIcon icon={callOutline} style={{ fontSize: 12 }} />
                    {c.phone}
                  </p>
                  {c.address && (
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                      <IonIcon icon={locationOutline} style={{ fontSize: 12 }} />
                      {c.address}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <IonButton
                    fill="clear"
                    routerLink={`/tabs/customer-form/${c.phone}`}
                    style={{ margin: 0, "--color": "var(--ion-color-primary)", "--padding-start": "8px", "--padding-end": "8px" }}
                  >
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                  {isOwner && (
                    <button
                      onClick={() => setDeleteTarget(c)}
                      style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <IonIcon icon={trashOutline} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບລູກຄ້າ"
        message={`ລຶບ "${deleteTarget?.name}" (${deleteTarget?.phone}) ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default ManageCustomers;
