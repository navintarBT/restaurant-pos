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
  IonCheckbox,
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getPrinters, addPrinter, updatePrinter } from "../data/printerRepository";
import type { Printer, PrinterConnectionType, PrinterRole } from "../data/types";
import { ROLE_LABELS } from "./ManagePrinters";

const CONNECTION_OPTIONS: { v: PrinterConnectionType; label: string }[] = [
  { v: "wifi", label: "WiFi" },
  { v: "bluetooth", label: "Bluetooth" },
  { v: "usb", label: "USB" },
];
const PAPER_PRESETS = ["58mm", "80mm"];
const ALL_ROLES: PrinterRole[] = ["billInvoice", "receipt", "qrDelivery", "kitchen1", "kitchen2", "bar1", "bar2", "reportsCancel"];

function radioRow(active: boolean, label: string, onClick: () => void, key?: string) {
  return (
    <div
      key={key ?? label}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
        marginBottom: 8, cursor: "pointer",
        border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
        background: active ? "var(--app-accent-surface)" : "var(--app-surface)",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ion-color-primary)" }} />}
      </div>
      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ion-text-color)" }}>{label}</span>
    </div>
  );
}

// One page, two modes: /tabs/printer-form (create) and
// /tabs/printer-form/:id (edit) — mirrors TableForm.tsx/StaffForm.tsx's
// unified create/edit split. This only saves a connection PROFILE (name,
// address, behavior) — there is no live Bluetooth/USB pairing or actual
// ESC/POS printing wired up here yet.
const PrinterForm: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = !!editId;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>("wifi");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [bluetoothAddress, setBluetoothAddress] = useState("");
  const [paperSize, setPaperSize] = useState("80mm");
  const [paperSizeCustom, setPaperSizeCustom] = useState("");
  const [kitchenTicketMode, setKitchenTicketMode] = useState<"perItem" | "combined">("combined");
  const [shared, setShared] = useState(false);
  const [cashDrawerOnCheckout, setCashDrawerOnCheckout] = useState(false);
  const [feedBeforeCut, setFeedBeforeCut] = useState("0");
  const [roles, setRoles] = useState<PrinterRole[]>([]);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const isCustomPaper = !PAPER_PRESETS.includes(paperSize);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      setLoading(true);
      try {
        if (editId) {
          const all = await getPrinters(shopId);
          const existing = all.find((p) => p.id === editId);
          if (!existing) {
            setNotFound(true);
          } else {
            setName(existing.name);
            setConnectionType(existing.connectionType);
            setIp(existing.ip ?? "");
            setPort(existing.port ?? "");
            setBluetoothAddress(existing.bluetoothAddress ?? "");
            if (PAPER_PRESETS.includes(existing.paperSize)) {
              setPaperSize(existing.paperSize);
            } else {
              setPaperSize("__custom__");
              setPaperSizeCustom(existing.paperSize);
            }
            setKitchenTicketMode(existing.kitchenTicketMode);
            setShared(existing.shared);
            setCashDrawerOnCheckout(existing.cashDrawerOnCheckout);
            setFeedBeforeCut(String(existing.feedBeforeCut ?? 0));
            setRoles(existing.roles ?? []);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, editId]);

  function toggleRole(r: PrinterRole) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }
  const allSelected = ALL_ROLES.every((r) => roles.includes(r));
  function toggleSelectAll() {
    setRoles(allSelected ? [] : [...ALL_ROLES]);
  }

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId || !name.trim()) return;
    setSaving(true);
    try {
      const resolvedPaperSize = paperSize === "__custom__" ? (paperSizeCustom.trim() || "80mm") : paperSize;
      const data: Omit<Printer, "id"> = {
        name: name.trim(),
        connectionType,
        paperSize: resolvedPaperSize,
        kitchenTicketMode,
        shared,
        cashDrawerOnCheckout,
        feedBeforeCut: Math.max(0, parseInt(feedBeforeCut, 10) || 0),
        roles,
      };
      if (connectionType === "wifi") {
        if (ip.trim()) data.ip = ip.trim();
        if (port.trim()) data.port = port.trim();
      }
      if (connectionType === "bluetooth" && bluetoothAddress.trim()) {
        data.bluetoothAddress = bluetoothAddress.trim();
      }

      if (isEdit && editId) {
        await updatePrinter(shopId, editId, data);
        showResult(true, "ບັນທຶກເຄື່ອງພິມສຳເລັດ");
      } else {
        await addPrinter(shopId, data);
        showResult(true, "ເພີ່ມເຄື່ອງພິມສຳເລັດ");
      }
    } catch {
      showResult(false, isEdit ? "ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່" : "ເພີ່ມເຄື່ອງພິມບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? "ແກ້ໄຂເຄື່ອງພິມ" : "ເພີ່ມເຄື່ອງພິມ"}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-printers" routerDirection="back">
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
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບເຄື່ອງພິມນີ້</p>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>

            {/* 1. Name + 2-4. Connection */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ລາຍລະອຽດເຄື່ອງພິມ
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຊື່ສະແດງ *
              </p>
              <IonInput
                placeholder="ເຊັ່ນ: ເຄື່ອງພິມຫ້ອງຄົວ" value={name}
                onIonInput={(e) => setName(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 14 }}
              />

              <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ປະເພດການເຊື່ອມຕໍ່
              </p>
              {CONNECTION_OPTIONS.map((opt) => radioRow(connectionType === opt.v, opt.label, () => setConnectionType(opt.v), opt.v))}

              {connectionType === "wifi" && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 2 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.76rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>IP</p>
                    <IonInput placeholder="192.168.1.50" value={ip} onIonInput={(e) => setIp(e.detail.value ?? "")} fill="outline" style={{ "--border-radius": "10px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.76rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>Port</p>
                    <IonInput type="number" placeholder="9100" value={port} onIonInput={(e) => setPort(e.detail.value ?? "")} fill="outline" style={{ "--border-radius": "10px" }} />
                  </div>
                </div>
              )}
              {connectionType === "bluetooth" && (
                <div style={{ marginTop: 6 }}>
                  <p style={{ margin: "0 0 6px", fontSize: "0.76rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>Bluetooth address</p>
                  <IonInput placeholder="00:11:22:33:44:55" value={bluetoothAddress} onIonInput={(e) => setBluetoothAddress(e.detail.value ?? "")} fill="outline" style={{ "--border-radius": "10px" }} />
                </div>
              )}
            </div>

            {/* 5. Paper size */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ຂະໜາດເຈ້ຍ
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: isCustomPaper ? 10 : 0 }}>
                {[...PAPER_PRESETS, "__custom__"].map((v) => {
                  const active = paperSize === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setPaperSize(v)}
                      style={{
                        padding: "8px 18px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                        border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                        background: active ? "var(--ion-color-primary)" : "transparent",
                        color: active ? "#fff" : "var(--app-text-secondary)",
                      }}
                    >
                      {v === "__custom__" ? "ກຳນົດເອງ" : v}
                    </button>
                  );
                })}
              </div>
              {isCustomPaper && (
                <IonInput
                  placeholder="ເຊັ່ນ: 76mm" value={paperSizeCustom}
                  onIonInput={(e) => setPaperSizeCustom(e.detail.value ?? "")}
                  fill="outline" style={{ "--border-radius": "10px" }}
                />
              )}
            </div>

            {/* 6. Kitchen ticket mode */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ຮູບແບບບິນຄົວ
              </p>
              <p style={{ margin: "0 0 10px", fontSize: "0.76rem", color: "var(--app-text-secondary)" }}>
                ເລືອກວິທີພິມເມື່ອອໍເດີ້ໜຶ່ງມີຫຼາຍລາຍການ
              </p>
              {radioRow(kitchenTicketMode === "perItem", "1 ລາຍການ / 1 ການຕັດ", () => setKitchenTicketMode("perItem"))}
              {radioRow(kitchenTicketMode === "combined", "1 ໃບລວມຫຼາຍລາຍການ", () => setKitchenTicketMode("combined"))}
            </div>

            {/* 7. Shared printer */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ແຊເຄື່ອງພິມ
              </p>
              {radioRow(shared, "ແຊເຄື່ອງພິມ", () => setShared(true), "shared-yes")}
              {radioRow(!shared, "ບໍ່ແຊເຄື່ອງພິມ", () => setShared(false), "shared-no")}
            </div>

            {/* 8. Cash drawer */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ລິ້ນຊັກເກັບເງິນ
              </p>
              {radioRow(cashDrawerOnCheckout, "ເປີດເມື່ອເຊັກບິນ", () => setCashDrawerOnCheckout(true), "drawer-yes")}
              {radioRow(!cashDrawerOnCheckout, "ບໍ່ເປີດ", () => setCashDrawerOnCheckout(false), "drawer-no")}
            </div>

            {/* 9. Feed before cut */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ໄລຍະຫ່າງຂອງເຈ້ຍກ່ອນຕັດ
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IonInput
                  type="number" min="0" value={feedBeforeCut}
                  onIonInput={(e) => setFeedBeforeCut(e.detail.value ?? "0")}
                  fill="outline" style={{ "--border-radius": "10px", flex: 1 }}
                />
                <span style={{ fontSize: "0.85rem", color: "var(--app-text-secondary)", fontWeight: 600 }}>ມມ</span>
              </div>
            </div>

            {/* 10. Roles */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                  ບົດບາດ
                </p>
                <button
                  onClick={toggleSelectAll}
                  style={{
                    padding: "5px 12px", borderRadius: 16, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer",
                    border: `1.5px solid ${allSelected ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    background: allSelected ? "var(--ion-color-primary)" : "transparent",
                    color: allSelected ? "#fff" : "var(--app-text-secondary)",
                  }}
                >
                  ເລືອກທັງໝົດ
                </button>
              </div>
              {ALL_ROLES.map((r) => (
                <div
                  key={r}
                  onClick={() => toggleRole(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                    marginBottom: 6, cursor: "pointer",
                    border: `1.5px solid ${roles.includes(r) ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    background: roles.includes(r) ? "var(--app-accent-surface)" : "var(--app-surface)",
                  }}
                >
                  <IonCheckbox checked={roles.includes(r)} onIonChange={() => toggleRole(r)} onClick={(e) => e.stopPropagation()} />
                  <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ion-text-color)" }}>{ROLE_LABELS[r]}</span>
                </div>
              ))}
            </div>

          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || notFound || !name.trim()}
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
            routerLink="/tabs/manage-printers" routerDirection="back"
            style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
          >
            ຍົກເລີກ
          </IonButton>
        </div>
      </IonFooter>

      <style>{`
        .printer-form-alert-error::part(message) { color: #dc2626; font-weight: 600; }
        .printer-form-alert-success::part(message) { color: #16a34a; font-weight: 600; }
      `}</style>
      <IonAlert
        isOpen={resultOpen}
        cssClass={resultSuccess ? "printer-form-alert-success" : "printer-form-alert-error"}
        header={resultSuccess ? "ສຳເລັດ" : "ມີຂໍ້ຜິດພາດ"}
        message={resultMessage}
        buttons={[
          {
            text: "ຕົກລົງ",
            handler: () => {
              setResultOpen(false);
              if (resultSuccess) history.push("/tabs/manage-printers");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default PrinterForm;
