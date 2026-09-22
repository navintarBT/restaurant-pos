import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
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
  IonInput,
  IonSelect,
  IonSelectOption,
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { closeOutline, addOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import {
  getTableRoster, setTableRoster, getTableZones, setTableZones, getServiceChargeSettings,
  decodeEntryKey, type TableRosterEntry,
} from "../data/shopRepository";

const NO_ZONE = "__none__";

// One page, two modes: /tabs/create-table (create) and
// /tabs/create-table/:key (edit that table, :key identifying it by
// zone+label — see encodeEntryKey). Tapping a row on ManageTables.tsx's list
// opens this in edit mode instead of editing inline — keeps the list page a
// plain read-only list with no staged edits, so there's nothing there that
// needs its own "save" button.
const TableForm: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const { key: editKey } = useParams<{ key?: string }>();
  const isEdit = !!editKey;
  const editTarget = editKey ? decodeEntryKey(editKey) : null;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [scEnabled, setScEnabled] = useState(false);
  const [scPercent, setScPercent] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [physicalTables, setPhysicalTables] = useState("1");
  const [zone, setZone] = useState<string>(NO_ZONE);
  const [serviceCharge, setServiceCharge] = useState(false);

  const [saving, setSaving] = useState(false);

  const [newZoneOpen, setNewZoneOpen] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);

  // Save result — shown as a popup rather than inline text, so success is
  // just as visible as failure instead of a silent page transition.
  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  // Per-field validation — each field shows its own warning right below
  // itself (rather than one combined message), and Save stays disabled
  // while any of them is invalid.
  const seatsNumPreview = seats.trim() ? parseInt(seats, 10) : null;
  const seatsInvalid = seatsNumPreview !== null && (Number.isNaN(seatsNumPreview) || seatsNumPreview < 0);
  const physicalTablesNumPreview = physicalTables.trim() ? parseInt(physicalTables, 10) : null;
  const physicalTablesInvalid = physicalTablesNumPreview !== null && (Number.isNaN(physicalTablesNumPreview) || physicalTablesNumPreview < 1);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      setLoading(true);
      try {
        const [roster, tableZones, sc] = await Promise.all([
          getTableRoster(shopId), getTableZones(shopId), getServiceChargeSettings(shopId),
        ]);
        setZones(tableZones);
        setScEnabled(sc.enabled);
        setScPercent(sc.percent);
        setTotalCount(roster.length);
        if (editTarget) {
          const existing = roster.find((e) => e.label === editTarget.label && (e.zone ?? undefined) === editTarget.zone);
          if (existing) {
            setName(existing.label);
            setSeats(existing.seats != null ? String(existing.seats) : "");
            setPhysicalTables(existing.physicalTables != null ? String(existing.physicalTables) : "1");
            setZone(existing.zone ?? NO_ZONE);
            setServiceCharge(!!existing.serviceCharge);
          } else {
            setNotFound(true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, editKey]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId) return;
    const trimmedName = name.trim();
    if (!trimmedName || seatsInvalid || physicalTablesInvalid) return;
    setSaving(true);
    try {
      // Re-fetch fresh right before writing (rather than reuse whatever was
      // loaded on mount) so a duplicate check is never stale and a
      // concurrent edit elsewhere isn't clobbered.
      const currentRoster = await getTableRoster(shopId);
      const seatsNum = seats.trim() ? Math.max(0, parseInt(seats, 10) || 0) : undefined;
      const zoneVal = zone === NO_ZONE ? undefined : zone;
      const physicalTablesNum = Math.max(1, parseInt(physicalTables, 10) || 1);
      const physicalTablesVal = physicalTablesNum > 1 ? physicalTablesNum : undefined;

      // Firestore rejects `undefined` field values outright (this app
      // doesn't set ignoreUndefinedProperties) — build the entry with only
      // the keys that actually have a value, rather than assigning
      // `undefined` to zone/seats/serviceCharge/physicalTables directly,
      // which would throw before the write ever reaches the server.
      const entry: TableRosterEntry = { label: trimmedName };
      if (zoneVal !== undefined) entry.zone = zoneVal;
      if (seatsNum !== undefined) entry.seats = seatsNum;
      if (serviceCharge) entry.serviceCharge = true;
      if (physicalTablesVal !== undefined) entry.physicalTables = physicalTablesVal;

      // A label only needs to be unique WITHIN its zone — "5" in "ໃນຮ້ານ" and
      // "5" in "ນອກຮ້ານ" are different tables. Every real-world identity
      // downstream (table sessions, QR, kitchen tickets) is built from
      // tableDisplayLabel(label, zone), so this pairing is what actually
      // needs to stay unique, not the bare label.
      const collidesWithOther = (other: TableRosterEntry) =>
        other.label === trimmedName && (other.zone ?? undefined) === zoneVal;

      if (isEdit && editTarget) {
        const isSameEntry = (e: TableRosterEntry) =>
          e.label === editTarget.label && (e.zone ?? undefined) === editTarget.zone;
        if (currentRoster.some((e) => !isSameEntry(e) && collidesWithOther(e))) {
          showResult(false, "ໂຕະນີ້ມີຢູ່ແລ້ວໃນໂຊນດຽວກັນ");
          return;
        }
        const updated = currentRoster.map((e) => (isSameEntry(e) ? entry : e));
        await setTableRoster(shopId, updated);
      } else {
        if (currentRoster.some(collidesWithOther)) {
          showResult(false, "ໂຕະນີ້ມີຢູ່ແລ້ວໃນໂຊນດຽວກັນ");
          return;
        }
        await setTableRoster(shopId, [...currentRoster, entry]);
      }
      showResult(true, isEdit ? "ບັນທຶກໂຕະສຳເລັດ" : "ສ້າງໂຕະສຳເລັດ");
    } catch {
      showResult(false, isEdit ? "ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່" : "ສ້າງໂຕະບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  // Returning false keeps the alert open so the duplicate message stays
  // visible instead of silently dismissing.
  async function handleCreateZone(name: string): Promise<boolean> {
    if (!shopId) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (zones.includes(trimmed)) {
      setZoneError("ໂຊນນີ້ມີແລ້ວ");
      return false;
    }
    try {
      const nextZones = [...zones, trimmed];
      await setTableZones(shopId, nextZones);
      setZones(nextZones);
      setZone(trimmed);
      return true;
    } catch {
      setZoneError("ສ້າງໂຊນບໍ່ສຳເລັດ, ລອງໃໝ່");
      return false;
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? "ແກ້ໄຂໂຕະ" : "ສ້າງໂຕະໃໝ່"}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-tables" routerDirection="back">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : notFound ? (
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບໂຕະນີ້</p>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            {/* Table details */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ລາຍລະອຽດໂຕະ
              </p>
              {!isEdit && (
                <p style={{ margin: "0 0 12px", fontSize: "0.76rem", color: "var(--app-text-secondary)" }}>
                  ຕອນນີ້ມີໂຕະທັງໝົດ <strong style={{ color: "var(--ion-color-primary)" }}>{totalCount}</strong> ໂຕະ
                </p>
              )}
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຊື່ໂຕະ
              </p>
              <IonInput
                placeholder="ເຊັ່ນ: 14" value={name}
                onIonInput={(e) => setName(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 12 }}
              />
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຈຳນວນບ່ອນນັ່ງ
              </p>
              <IonInput
                type="number" min="0" placeholder="ເຊັ່ນ: 4" value={seats}
                onIonInput={(e) => setSeats(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: seatsInvalid ? 4 : 12 }}
              />
              {seatsInvalid && (
                <p style={{ margin: "0 0 12px", fontSize: "0.72rem", color: "var(--app-danger)", fontWeight: 600 }}>
                  ⚠️ ຈຳນວນບ່ອນນັ່ງຕ້ອງບໍ່ຕິດລົບ
                </p>
              )}
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຈຳນວນໂຕະ
              </p>
              <IonInput
                type="number" min="1" value={physicalTables}
                onIonInput={(e) => setPhysicalTables(e.detail.value ?? "1")}
                fill="outline" style={{ "--border-radius": "10px" }}
              />
              {physicalTablesInvalid ? (
                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--app-danger)", fontWeight: 600 }}>
                  ⚠️ ຈຳນວນໂຕະຕ້ອງບໍ່ໜ້ອຍກວ່າ 1 (ຄ່າເລີ່ມຕົ້ນແມ່ນ 1)
                </p>
              ) : (
                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--app-text-muted)" }}>
                  ໃສ່ 2 ຂຶ້ນໄປ ຖ້າໂຕະນີ້ແມ່ນເອົາໂຕະຈິງຫຼາຍໂຕະມາຕໍ່ກັນ (ເຊັ່ນ: ໂຕະ 5+6 ຕໍ່ກັນສຳລັບກຸ່ມໃຫຍ່)
                </p>
              )}
            </div>

            {/* Zone */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ໂຊນ
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "0.76rem", color: "var(--app-text-secondary)" }}>
                ເລືອກຕຳແໜ່ງໂຊນທີ່ໂຕະນີ້ຈະສະແດງໃນຜັງຮ້ານ.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <IonSelect
                  value={zone}
                  onIonChange={(e) => setZone(e.detail.value)}
                  interface="popover"
                  fill="outline"
                  style={{ flex: 1, "--border-radius": "10px", border: "1px solid var(--app-border)", borderRadius: 10 }}
                >
                  <IonSelectOption value={NO_ZONE}>ບໍ່ມີໂຊນ</IonSelectOption>
                  {zones.map((z) => (
                    <IonSelectOption key={z} value={z}>{z}</IonSelectOption>
                  ))}
                </IonSelect>
                <IonButton
                  onClick={() => { setZoneError(null); setNewZoneOpen(true); }}
                  style={{ margin: 0, height: 44, flexShrink: 0, "--border-radius": "10px" }}
                >
                  <IonIcon slot="icon-only" icon={addOutline} />
                </IonButton>
              </div>
            </div>

            {/* Service charge */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ຄ່າບໍລິການ
              </p>
              <p style={{ margin: "0 0 10px", fontSize: "0.76rem", color: "var(--app-text-secondary)" }}>
                ເປີດໃຊ້ເມື່ອໂຕະນີ້ຕ້ອງຄິດຄ່າບໍລິການລູກຄ້າ.
              </p>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8, background: "var(--app-surface-alt)", marginBottom: 12,
              }}>
                <span style={{ fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>ຄ່າບໍລິການ ຂອງຮ້ານ</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: scEnabled ? "var(--ion-color-primary)" : "var(--app-text-muted)" }}>
                  {scEnabled ? `ໃຊ້ງານ / ${scPercent}%` : "ປິດໃຊ້ງານ / 0%"}
                </span>
              </div>

              <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຄ່າບໍລິການສຳລັບໂຕະນີ້
              </p>
              {[
                { v: false, label: "ປິດໃຊ້ງານ" },
                { v: true, label: "ໃຊ້ງານ" },
              ].map(({ v, label }) => (
                <div
                  key={label}
                  onClick={() => setServiceCharge(v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
                    marginBottom: 8, cursor: "pointer",
                    border: `1.5px solid ${serviceCharge === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    background: serviceCharge === v ? "var(--app-accent-surface)" : "var(--app-surface)",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${serviceCharge === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {serviceCharge === v && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ion-color-primary)" }} />}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{label}</span>
                </div>
              ))}
            </div>

          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || notFound || !name.trim() || seatsInvalid || physicalTablesInvalid}
            onClick={handleSubmit}
            style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
          >
            {saving
              ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງບັນທຶກ...</span>)
              : "ບັນທຶກ"
            }
          </IonButton>
          <IonButton
            expand="block" fill="outline" disabled={saving}
            routerLink="/tabs/manage-tables" routerDirection="back"
            style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
          >
            ຍົກເລີກ
          </IonButton>
        </div>
      </IonFooter>

      <style>{`
        .table-form-alert-error::part(message) { color: #dc2626; font-weight: 600; }
        .table-form-alert-success::part(message) { color: #16a34a; font-weight: 600; }
      `}</style>

      <IonAlert
        isOpen={newZoneOpen}
        cssClass="table-form-alert-error"
        header="ສ້າງໂຊນໃໝ່"
        message={zoneError ?? undefined}
        inputs={[{ name: "zoneName", type: "text", placeholder: "ເຊັ່ນ: ໃນຮ້ານ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewZoneOpen(false) },
          {
            text: "ສ້າງ",
            handler: async (data: { zoneName?: string }) => {
              const ok = await handleCreateZone(data.zoneName ?? "");
              if (ok) setNewZoneOpen(false);
              return ok;
            },
          },
        ]}
        onDidDismiss={() => { setNewZoneOpen(false); setZoneError(null); }}
      />

      <IonAlert
        isOpen={resultOpen}
        cssClass={resultSuccess ? "table-form-alert-success" : "table-form-alert-error"}
        header={resultSuccess ? "ສຳເລັດ" : "ມີຂໍ້ຜິດພາດ"}
        message={resultMessage}
        buttons={[
          {
            text: "ຕົກລົງ",
            handler: () => {
              setResultOpen(false);
              if (resultSuccess) history.push("/tabs/manage-tables");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default TableForm;
