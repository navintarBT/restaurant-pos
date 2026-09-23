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
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getCustomerByPhone, addCustomer, updateCustomer } from "../data/customerRepository";

const PHONE_RE = /^\d{8}$/;

// One page, two modes: /tabs/customer-form (create) and
// /tabs/customer-form/:phone (edit that customer). Phone doubles as the
// member code (see customerRepository.ts) so it's the document id — locked
// once created, editable only in create mode. Mirrors TableForm.tsx's
// unified create/edit split and per-field inline validation.
const CustomerForm: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const { phone: editPhone } = useParams<{ phone?: string }>();
  const isEdit = !!editPhone;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  // Per-field validation — shown right below the field, Save stays disabled
  // while any of them is invalid. Same pattern as TableForm.tsx.
  const phoneInvalid = phone.trim().length > 0 && !PHONE_RE.test(phone.trim());

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      setLoading(true);
      try {
        if (editPhone) {
          const existing = await getCustomerByPhone(shopId, editPhone);
          if (existing) {
            setPhone(existing.phone);
            setName(existing.name);
            setAddress(existing.address ?? "");
            setEnabled(existing.enabled);
          } else {
            setNotFound(true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, editPhone]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId) return;
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !PHONE_RE.test(trimmedPhone)) return;

    setSaving(true);
    try {
      if (isEdit) {
        await updateCustomer(shopId, trimmedPhone, {
          name: trimmedName,
          address: trimmedAddress || undefined,
          enabled,
        });
      } else {
        // Re-fetch fresh right before writing, same reasoning as
        // TableForm.tsx — phone is the member code, so it must stay unique.
        const existing = await getCustomerByPhone(shopId, trimmedPhone);
        if (existing) {
          showResult(false, `ເບີໂທ "${trimmedPhone}" ເປັນສະມາຊິກຢູ່ແລ້ວ`);
          return;
        }
        await addCustomer(shopId, {
          phone: trimmedPhone,
          name: trimmedName,
          address: trimmedAddress || undefined,
          enabled,
        });
      }
      showResult(true, isEdit ? "ບັນທຶກລູກຄ້າສຳເລັດ" : "ເພີ່ມລູກຄ້າສຳເລັດ");
    } catch {
      showResult(false, isEdit ? "ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່" : "ເພີ່ມລູກຄ້າບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? "ແກ້ໄຂລູກຄ້າ" : "ເພີ່ມລູກຄ້າໃໝ່"}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-customers" routerDirection="back">
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
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບລູກຄ້ານີ້</p>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ຂໍ້ມູນລູກຄ້າ
              </p>

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                1. ເບີໂທ (ໃຊ້ເປັນລະຫັດສະມາຊິກ, 8 ຕົວ)
              </p>
              <IonInput
                type="tel" inputmode="numeric" maxlength={8} disabled={isEdit}
                placeholder="ເຊັ່ນ: 20123456" value={phone}
                onIonInput={(e) => setPhone((e.detail.value ?? "").replace(/\D/g, "").slice(0, 8))}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: phoneInvalid ? 4 : 16 }}
              />
              {phoneInvalid && (
                <p style={{ margin: "0 0 16px", fontSize: "0.72rem", color: "var(--app-danger)", fontWeight: 600 }}>
                  ⚠️ ເບີໂທຕ້ອງເປັນຕົວເລກ 8 ຫຼັກ
                </p>
              )}

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                2. ຊື່
              </p>
              <IonInput
                placeholder="ຊື່ລູກຄ້າ" value={name}
                onIonInput={(e) => setName(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 16 }}
              />

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                3. ທີ່ຢູ່
              </p>
              <IonInput
                placeholder="ທີ່ຢູ່ (ຖ້າມີ)" value={address}
                onIonInput={(e) => setAddress(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 16 }}
              />

              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                4. ສະຖານະ
              </p>
              <div
                onClick={() => setEnabled((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "10px 12px", borderRadius: 10,
                  background: enabled ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
                  {enabled ? "ໃຊ້ງານ" : "ບໍ່ໃຊ້ງານ"}
                </span>
                <div style={{
                  width: 46, height: 26, borderRadius: 13, flexShrink: 0,
                  background: enabled ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
                  position: "relative", transition: "background 0.15s",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: enabled ? 22 : 2,
                    width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || notFound || !name.trim() || !PHONE_RE.test(phone.trim())}
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
            routerLink="/tabs/manage-customers" routerDirection="back"
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
        isOpen={resultOpen}
        cssClass={resultSuccess ? "table-form-alert-success" : "table-form-alert-error"}
        header={resultSuccess ? "ສຳເລັດ" : "ມີຂໍ້ຜິດພາດ"}
        message={resultMessage}
        buttons={[
          {
            text: "ຕົກລົງ",
            handler: () => {
              setResultOpen(false);
              if (resultSuccess) history.push("/tabs/manage-customers");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default CustomerForm;
