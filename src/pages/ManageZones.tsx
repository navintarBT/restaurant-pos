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
import { trashOutline, addOutline, chevronBackOutline, filterOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getTableZones, setTableZones } from "../data/shopRepository";
import EmptyState from "../components/EmptyState";

// Zone CREATION lives on its own page (CreateZone.tsx, reached via the "+"
// button below) and supports adding several zones in one save — this page
// is just the list. Deleting a zone applies immediately. The shop-wide
// service-charge settings live on ShopProfileSettings.tsx instead.
//
// Search/sort/limit controls mirror ManageTables.tsx exactly, for the same
// reason: the list of zones/tables both grow unbounded, and staff scanning
// either one benefit from the same muscle memory.
const ManageZones: React.FC = () => {
  const { shopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setZones(await getTableZones(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  // Zones are appended to the end of the array when created (see
  // CreateZone.tsx), so array order already IS creation order — "oldest" is
  // just the array as-is, "newest" is that reversed.
  const processed: string[] = (() => {
    let list = zones;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((z) => z.toLowerCase().includes(q));
    if (sortOrder === "newest") list = [...list].reverse();
    if (pageSize !== "all") list = list.slice(0, pageSize);
    return list;
  })();

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const current = await getTableZones(shopId);
      await setTableZones(shopId, current.filter((z) => z !== deleteTarget));
      setZones((prev) => prev.filter((z) => z !== deleteTarget));
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
          <IonTitle>ຈັດການໂຊນ</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/create-zone">
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
                ສະແດງ {processed.length} ຈາກ {zones.length} ໂຊນ
              </p>
              <IonButton routerLink="/tabs/create-zone" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                <IonIcon slot="start" icon={addOutline} />
                ສ້າງໂຊນ
              </IonButton>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາຊື່ໂຊນ"
                style={{ padding: 0, flex: 1 }}
              />
              <IonButton
                fill={pageSize !== "all" || sortOrder !== "oldest" ? "solid" : "outline"}
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
                        { v: "oldest" as const, label: "ເກົ່າສຸດ" },
                        { v: "newest" as const, label: "ໃໝ່ສຸດ" },
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

            {zones.length === 0 && <EmptyState icon="🗺️" title="ຍັງບໍ່ມີໂຊນ" subtitle="ກົດ 'ສ້າງໂຊນ' ເພື່ອເລີ່ມ" />}
            {zones.length > 0 && processed.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບໂຊນທີ່ຄົ້ນຫາ" />}
            {processed.map((z) => (
              <div key={z} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--app-border)" }}>
                <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>{z}</span>
                <button
                  onClick={() => setDeleteTarget(z)}
                  style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <IonIcon icon={trashOutline} />
                </button>
              </div>
            ))}
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບໂຊນ"
        message={`ຕ້ອງການລຶບໂຊນ "${deleteTarget}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default ManageZones;
