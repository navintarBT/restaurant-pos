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
} from "@ionic/react";
import { trashOutline, addOutline, chevronBackOutline, filterOutline, createOutline, wifiOutline, bluetoothOutline, hardwareChipOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getPrinters, deletePrinter } from "../data/printerRepository";
import type { Printer, PrinterConnectionType, PrinterRole } from "../data/types";
import EmptyState from "../components/EmptyState";

const CONNECTION_ICON: Record<PrinterConnectionType, string> = {
  wifi: wifiOutline,
  bluetooth: bluetoothOutline,
  usb: hardwareChipOutline,
};
const CONNECTION_LABEL: Record<PrinterConnectionType, string> = {
  wifi: "WiFi",
  bluetooth: "Bluetooth",
  usb: "USB",
};
export const ROLE_LABELS: Record<PrinterRole, string> = {
  billInvoice: "ໃບຮຽກເກັບເງິນ",
  receipt: "ໃບຮັບເງິນ",
  qrDelivery: "QR ສົ່ງອາຫານ",
  kitchen1: "ຫ້ອງຄົວ1",
  kitchen2: "ຫ້ອງຄົວ2",
  bar1: "ບານໍ້າ1",
  bar2: "ບານໍ້າ2",
  reportsCancel: "ພິມລາຍງານ/ຍົກເລີກອໍເດີ",
};

const ManagePrinters: React.FC = () => {
  const { shopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Printer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setPrinters(await getPrinters(shopId));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  // Printer docs don't carry a createdAt today, so "oldest"/"newest" is just
  // the array-as-returned vs. reversed — same convention as ManageColors.tsx.
  const processed: Printer[] = (() => {
    let list = printers;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (sortOrder === "newest") list = [...list].reverse();
    if (pageSize !== "all") list = list.slice(0, pageSize);
    return list;
  })();

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePrinter(shopId, deleteTarget.id);
      setPrinters((prev) => prev.filter((p) => p.id !== deleteTarget.id));
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
          <IonTitle>ຈັດການເຄື່ອງພິມ</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/printer-form">
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
                ສະແດງ {processed.length} ຈາກ {printers.length} ເຄື່ອງພິມ
              </p>
              <IonButton routerLink="/tabs/printer-form" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                <IonIcon slot="start" icon={addOutline} />
                ເພີ່ມເຄື່ອງພິມ
              </IonButton>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາຊື່ເຄື່ອງພິມ"
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

            <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
              ລາຍການເຄື່ອງພິມ
            </p>

            {printers.length === 0 && <EmptyState icon="🖨️" title="ຍັງບໍ່ມີເຄື່ອງພິມ" subtitle="ກົດ 'ເພີ່ມເຄື່ອງພິມ' ເພື່ອເລີ່ມ" />}
            {printers.length > 0 && processed.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບເຄື່ອງພິມທີ່ຄົ້ນຫາ" />}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {processed.map((p) => (
                <div key={p.id} style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 12,
                  border: "1px solid var(--app-border)", background: "var(--app-surface)", width: "100%",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "var(--app-accent-surface)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <IonIcon icon={CONNECTION_ICON[p.connectionType]} style={{ fontSize: 18, color: "#c2410c" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--ion-text-color)" }}>{p.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
                        {CONNECTION_LABEL[p.connectionType]}
                        {p.connectionType === "wifi" && p.ip ? ` · ${p.ip}${p.port ? `:${p.port}` : ""}` : ""}
                        {p.connectionType === "bluetooth" && p.bluetoothAddress ? ` · ${p.bluetoothAddress}` : ""}
                        {` · ${p.paperSize}`}
                      </p>
                    </div>
                    <IonButton
                      fill="clear" size="small"
                      routerLink={`/tabs/printer-form/${p.id}`}
                      style={{ margin: 0, "--color": "var(--ion-color-primary)", "--padding-start": "8px", "--padding-end": "8px" }}
                    >
                      <IonIcon slot="icon-only" icon={createOutline} />
                    </IonButton>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <IonIcon icon={trashOutline} style={{ fontSize: 18 }} />
                    </button>
                  </div>
                  {p.roles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 46 }}>
                      {p.roles.map((r) => (
                        <span key={r} style={{
                          fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: "var(--app-surface-alt)", color: "var(--app-text-secondary)",
                        }}>
                          {ROLE_LABELS[r]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບເຄື່ອງພິມ"
        message={`ລຶບ "${deleteTarget?.name}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default ManagePrinters;
