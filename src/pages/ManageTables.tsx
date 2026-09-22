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
  IonSegment,
  IonSegmentButton,
  IonSearchbar,
  IonModal,
  IonInput,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, addOutline, chevronBackOutline, createOutline, chevronDownOutline, filterOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getTableRoster, setTableRoster, encodeEntryKey, tableDisplayLabel, type TableRosterEntry } from "../data/shopRepository";
import { getOpenSessions } from "../data/tableSessionRepository";
import { getOrdersBySession } from "../data/saleRepository";
import EmptyState from "../components/EmptyState";

type TableStatus = "available" | "empty" | "busy" | "ready" | "served";

// Same palette/meaning as the "ເລືອກໂຕະ" tile grid (TakeOrder.tsx) — vacant is
// green, every occupied state gets its own distinct color.
const STATUS_LABEL: Record<TableStatus, { text: string; color: string; bg: string }> = {
  available: { text: "ວ່າງ", color: "var(--app-success)", bg: "var(--app-success-surface)" },
  empty: { text: "ບໍ່ວ່າງ · ລໍຖ້າສັ່ງ", color: "var(--app-text-secondary)", bg: "var(--app-surface-alt)" },
  busy: { text: "🔥 ກຳລັງເຮັດ", color: "var(--app-warning)", bg: "var(--app-warning-surface)" },
  ready: { text: "✅ ພ້ອມເສີບ", color: "var(--ion-color-primary)", bg: "var(--app-accent-surface)" },
  served: { text: "🧾 ລໍຖ້າເກັບເງິນ", color: "var(--app-danger)", bg: "var(--app-danger-surface)" },
};

// Table CREATE/EDIT both live on their own page (TableForm.tsx, reached via
// the "+" button or a row's edit icon) — this page is just a read-only list,
// so there's nothing staged here that needs its own "save" button; delete
// applies immediately. The shop-wide service charge master switch + percent
// lives on ManageZones.tsx.
const ManageTables: React.FC = () => {
  const { shopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TableRosterEntry[]>([]);
  const [statusByLabel, setStatusByLabel] = useState<Map<string, TableStatus>>(new Map());
  const [deleteTarget, setDeleteTarget] = useState<TableRosterEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "zone">("all");
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"oldest" | "newest">("oldest");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [roster, sessions] = await Promise.all([getTableRoster(shopId), getOpenSessions(shopId)]);
      setEntries(roster);
      const withStatus = await Promise.all(sessions.map(async (session) => {
        const orders = await getOrdersBySession(shopId, session.id);
        let status: TableStatus = "empty";
        if (orders.some((o) => o.status === "pending" || o.status === "cooking")) status = "busy";
        else if (orders.some((o) => o.status === "ready")) status = "ready";
        else if (orders.some((o) => o.status === "served")) status = "served";
        return [session.tableLabel, status] as const;
      }));
      setStatusByLabel(new Map(withStatus));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  function toggleZone(zone: string) {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }

  // Roster entries are appended to the end of the array when created (see
  // TableForm.tsx), so array order already IS creation order — "oldest" is
  // just the array as-is, "newest" is that reversed. No separate timestamp
  // field needed.
  const processed: TableRosterEntry[] = (() => {
    let list = entries;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        e.label.toLowerCase().includes(q) || (e.zone ?? "").toLowerCase().includes(q)
      );
    }
    if (sortOrder === "newest") list = [...list].reverse();
    if (pageSize !== "all") list = list.slice(0, pageSize);
    return list;
  })();

  const NO_ZONE_LABEL = "ບໍ່ມີໂຊນ";
  const zoneGroups: [string, TableRosterEntry[]][] = (() => {
    const map = new Map<string, TableRosterEntry[]>();
    for (const entry of processed) {
      const key = entry.zone ?? NO_ZONE_LABEL;
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    }
    // Named zones first (in first-seen order), "ບໍ່ມີໂຊນ" last.
    const keys = [...map.keys()].filter((k) => k !== NO_ZONE_LABEL);
    if (map.has(NO_ZONE_LABEL)) keys.push(NO_ZONE_LABEL);
    return keys.map((k) => [k, map.get(k)!]);
  })();

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    // Match on (label, zone) together — the same label can exist in more
    // than one zone now, so matching by label alone could delete the wrong
    // (or an extra) entry.
    const isTarget = (e: TableRosterEntry) =>
      e.label === deleteTarget.label && (e.zone ?? undefined) === (deleteTarget.zone ?? undefined);
    try {
      const current = await getTableRoster(shopId);
      await setTableRoster(shopId, current.filter((e) => !isTarget(e)));
      setEntries((prev) => prev.filter((e) => !isTarget(e)));
      setDeleteTarget(null);
    } catch {
      setError("ລຶບບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setDeleting(false);
    }
  }

  function renderRow(entry: TableRosterEntry) {
    const status = statusByLabel.get(tableDisplayLabel(entry.label, entry.zone)) ?? "available";
    const s = STATUS_LABEL[status];
    return (
      <div key={encodeEntryKey(entry.zone, entry.label)} style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--app-surface)", borderRadius: 12, padding: "8px 10px",
        border: "1px solid var(--app-border)", borderLeft: `4px solid ${s.color}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--ion-text-color)" }}>
              ໂຕະ {entry.label}
            </span>
            {entry.physicalTables != null && entry.physicalTables > 1 && (
              <span style={{
                fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                color: "var(--ion-color-primary)", background: "var(--app-accent-surface)",
              }}>
                🔗 ລວມ {entry.physicalTables} ໂຕະ
              </span>
            )}
            <span style={{
              fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 20,
              color: s.color, background: s.bg,
            }}>
              {s.text}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2, fontSize: "0.72rem", color: "var(--app-text-secondary)" }}>
            <span>📍 {entry.zone ?? "ບໍ່ມີໂຊນ"}</span>
            <span>👥 {entry.seats != null ? `${entry.seats} ບ່ອນ` : "—"}</span>
            <span style={{ color: entry.serviceCharge ? "var(--app-success)" : "var(--app-text-secondary)", fontWeight: entry.serviceCharge ? 700 : 400 }}>
              🧾 ຄ່າບໍລິການ{entry.serviceCharge ? "ເປີດ" : "ປິດ"}
            </span>
          </div>
        </div>
        <IonButton
          fill="clear"
          routerLink={`/tabs/create-table/${encodeEntryKey(entry.zone, entry.label)}`}
          style={{
            margin: 0, "--color": "var(--ion-color-primary)",
            "--padding-start": "8px", "--padding-end": "8px",
          }}
        >
          <IonIcon slot="icon-only" icon={createOutline} />
        </IonButton>
        <button
          onClick={() => setDeleteTarget(entry)}
          style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <IonIcon icon={trashOutline} />
        </button>
      </div>
    );
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
          <IonTitle>ຈັດການໂຕະ</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/create-table">
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
                ສະແດງ {processed.length} ຈາກ {entries.length} ໂຕະ
              </p>
              <IonButton routerLink="/tabs/create-table" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                <IonIcon slot="start" icon={addOutline} />
                ສ້າງໂຕະ
              </IonButton>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາຊື່ໂຕະ ຫຼື ໂຊນ"
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

            <IonSegment
              value={viewMode}
              onIonChange={(e) => setViewMode(e.detail.value as "all" | "zone")}
              style={{ marginBottom: 14 }}
            >
              <IonSegmentButton value="all">ສະແດງທັ້ງໝົດ</IonSegmentButton>
              <IonSegmentButton value="zone">ສະແດງຮູບແບບໂຊນ</IonSegmentButton>
            </IonSegment>

            {entries.length === 0 && <EmptyState icon="🪑" title="ຍັງບໍ່ມີລາຍການໂຕະ" subtitle="ກົດ 'ສ້າງໂຕະ' ເພື່ອເລີ່ມ" />}
            {entries.length > 0 && processed.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບໂຕະທີ່ຄົ້ນຫາ" />}

            {processed.length > 0 && viewMode === "all" && (
              <div>
                {zoneGroups.map(([zone, zoneEntries]) => (
                  <div key={zone} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                        📍 {zone} ({zoneEntries.length})
                      </span>
                      <div style={{ flex: 1, height: 1, background: "var(--app-border)" }} />
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {zoneEntries.map((entry) => renderRow(entry))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {processed.length > 0 && viewMode === "zone" && (
              <div style={{ display: "grid", gap: 10 }}>
                {zoneGroups.map(([zone, zoneEntries]) => {
                  const isOpen = expandedZones.has(zone);
                  return (
                    <div key={zone} style={{
                      border: "1px solid var(--app-border)", borderRadius: 12, overflow: "hidden",
                      background: "var(--app-surface)",
                    }}>
                      <button
                        onClick={() => toggleZone(zone)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>📍 {zone}</span>
                          <span style={{
                            fontSize: "0.68rem", fontWeight: 700, padding: "1px 8px", borderRadius: 20,
                            background: "var(--app-accent-surface)", color: "var(--ion-color-primary)",
                          }}>
                            {zoneEntries.length} ໂຕະ
                          </span>
                        </span>
                        <IonIcon
                          icon={chevronDownOutline}
                          style={{ fontSize: "0.9rem", color: "var(--app-text-muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                        />
                      </button>
                      {isOpen && (
                        <div style={{ display: "grid", gap: 8, padding: "0 10px 10px" }}>
                          {zoneEntries.map((entry) => renderRow(entry))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບໂຕະ"
        message={`ຕ້ອງການລຶບ "ໂຕະ ${deleteTarget?.label}" ແມ່ນບໍ່?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default ManageTables;
