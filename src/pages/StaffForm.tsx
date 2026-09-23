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
import { closeOutline, mailOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import {
  createStaffUser, updateStaffUser, updateStaffEmail, updateStaffPermissions,
  getShopUsers, resetStaffPassword, getTableZones,
} from "../data/shopRepository";
import { uploadProductImage } from "../data/imageRepository";
import type { ShopUser, StaffRole } from "../data/types";
import ImagePicker from "../components/ImagePicker";
import { DEFAULT_PERMS, STAFF_ROLE_LABELS, STAFF_ROLE_PRESETS } from "../components/PermCheckboxList";

const ALL_STAFF_ROLES = Object.keys(STAFF_ROLE_LABELS) as StaffRole[];

// One page, two modes: /tabs/staff-form (create) and /tabs/staff-form/:uid
// (edit that account) — mirrors TableForm.tsx/CustomerForm.tsx's split.
// Kept off StaffSettings.tsx ("ຂໍ້ມູນຜູ້ໃຊ້") so that page is just a plain
// list, same as every other "ຈັດການ..." list in this app.
const StaffForm: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();
  const { uid: editUid } = useParams<{ uid?: string }>();
  const isEdit = !!editUid;

  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [existing, setExisting] = useState<ShopUser | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // "ບົດບາດ" + "ໂຊນ" — perms starts as whatever's already saved (or
  // DEFAULT_PERMS for a new account) and is only overwritten by picking a
  // role card below; editing name/email/photo and saving must never reset a
  // staffer's already-fine-tuned checkboxes (see UserPermissions.tsx) just
  // because this page resubmits `perms` alongside them.
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [staffRole, setStaffRole] = useState<StaffRole | undefined>(undefined);
  const [zoneRestricted, setZoneRestricted] = useState(false);
  const [allowedZones, setAllowedZones] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [newUid, setNewUid] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    getTableZones(shopId).then(setZones).catch(() => {});
  }, [shopId]);

  useEffect(() => {
    if (!shopId || !editUid) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const users = await getShopUsers(shopId);
        const found = users.find((u) => u.id === editUid) ?? null;
        if (found) {
          setExisting(found);
          setName(found.displayName ?? "");
          setEmail(found.email);
          setPhotoUrl(found.profileUrl ?? "");
          setPerms(found.permissions ?? DEFAULT_PERMS);
          setStaffRole(found.staffRole);
          setZoneRestricted(!!found.zoneRestricted);
          setAllowedZones(found.allowedZones ?? []);
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, editUid]);

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  function pickRole(r: StaffRole) {
    setStaffRole(r);
    setPerms(STAFF_ROLE_PRESETS[r]);
  }

  function toggleZone(zone: string) {
    setAllowedZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]));
  }

  async function handleResetPassword() {
    if (!existing) return;
    setResettingPassword(true);
    setResetMessage(null);
    try {
      await resetStaffPassword(existing.email);
      setResetMessage(`ສົ່ງລິ້ງ reset ລະຫັດໄປທີ່ ${existing.email} ແລ້ວ`);
    } catch (err) {
      setResetMessage(err instanceof Error ? err.message : "ສົ່ງ reset ລະຫັດບໍ່ສຳເລັດ");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSubmit() {
    if (!shopId) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setSaving(true);
    try {
      const uploaded = photo ? await uploadProductImage(photo) : undefined;

      if (!isEdit) {
        if (password.length < 6) return;
        const uid = await createStaffUser(shopId, {
          email: trimmedEmail,
          password,
          displayName: trimmedName,
          photoUrl: uploaded,
          permissions: perms,
          staffRole,
          zoneRestricted,
          allowedZones,
        });
        setNewUid(uid);
        showResult(true, "ສ້າງຜູ້ໃຊ້ສຳເລັດ");
        return;
      }

      if (!existing) return;
      const finalPhotoUrl = uploaded ?? photoUrl;
      const emailChanged = trimmedEmail !== existing.email.toLowerCase();
      if (emailChanged) {
        const migratedUid = await updateStaffEmail(shopId, existing.id, {
          newEmail: trimmedEmail,
          displayName: trimmedName,
          createdAt: existing.createdAt,
          photoUrl: finalPhotoUrl || undefined,
        });
        // Email change re-creates the auth account under a new uid — carry
        // permissions/role/zone-restriction over (unchanged unless the role
        // card above was actually tapped in this same edit).
        await updateStaffPermissions(shopId, migratedUid, { permissions: perms, staffRole, zoneRestricted, allowedZones });
        showResult(true, "ແກ້ໄຂອີເມວແລ້ວ — ສົ່ງລິ້ງ reset ລະຫັດໄປທີ່ email ໃໝ່ແລ້ວ");
      } else {
        await updateStaffUser(shopId, existing.id, { displayName: trimmedName, photoUrl: finalPhotoUrl });
        await updateStaffPermissions(shopId, existing.id, { permissions: perms, staffRole, zoneRestricted, allowedZones });
        showResult(true, "ບັນທຶກຂໍ້ມູນແລ້ວ");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (isEdit ? "ແກ້ໄຂບໍ່ສຳເລັດ" : "ສ້າງຜູ້ໃຊ້ບໍ່ສຳເລັດ");
      showResult(false, msg.includes("already") ? "ອີເມວນີ້ຖືກໃຊ້ແລ້ວ" : msg);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = isEdit
    ? !!email.trim()
    : !!email.trim() && password.length >= 6;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isEdit ? "ແກ້ໄຂຜູ້ໃຊ້" : "ສ້າງຜູ້ໃຊ້ໃໝ່"}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/staff" routerDirection="back">
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
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບຜູ້ໃຊ້ນີ້</p>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                1. ຮູບໂປຣໄຟລ໌
              </p>
              <ImagePicker
                currentUrl={photo ?? photoUrl}
                onImage={setPhoto}
                onRemove={() => { setPhoto(null); setPhotoUrl(""); }}
                uploading={saving && !!photo}
              />
            </div>

            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ຊື່ ພະນັກງານ
              </p>
              <IonInput
                placeholder="ຊື່ ພະນັກງານ" value={name}
                onIonInput={(e) => setName(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px" }}
              />
            </div>

            {/* Role — picking one pre-fills the checkbox list on the
                dedicated "ສິດການໃຊ້ງານ" page, which stays editable there;
                leaving the role untouched here never resets a staffer's
                already-fine-tuned checkboxes. */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                2. ບົດບາດ
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {ALL_STAFF_ROLES.map((r) => (
                  <div
                    key={r}
                    onClick={() => pickRole(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                      cursor: "pointer",
                      border: `1.5px solid ${staffRole === r ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                      background: staffRole === r ? "var(--app-accent-surface)" : "var(--app-surface)",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${staffRole === r ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {staffRole === r && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--ion-color-primary)" }} />}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{STAFF_ROLE_LABELS[r]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Zone restriction */}
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                3. ໂຊນ
              </p>
              <div
                onClick={() => setZoneRestricted((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                  padding: "10px 12px", borderRadius: 10,
                  background: zoneRestricted ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ion-text-color)" }}>
                  {zoneRestricted ? "ຂາຍໄດ້ສະເພາະໂຊນທີ່ເລືອກ" : "ຂາຍໄດ້ທຸກໂຊນ"}
                </span>
                <div style={{
                  width: 46, height: 26, borderRadius: 13, flexShrink: 0,
                  background: zoneRestricted ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
                  position: "relative", transition: "background 0.15s",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: zoneRestricted ? 22 : 2,
                    width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
                  }} />
                </div>
              </div>
              {zoneRestricted && (
                zones.length === 0 ? (
                  <p style={{ margin: "10px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                    ຍັງບໍ່ມີໂຊນ — ໄປສ້າງທີ່ "ຈັດການໂຊນ" ກ່ອນ
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {zones.map((z) => (
                      <label key={z} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={allowedZones.includes(z)}
                          onChange={() => toggleZone(z)}
                          style={{ width: 17, height: 17, accentColor: "var(--ion-color-primary)", cursor: "pointer", flexShrink: 0 }}
                        />
                        <span style={{ fontSize: "0.85rem" }}>{z}</span>
                      </label>
                    ))}
                  </div>
                )
              )}
            </div>

            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                4. ຂໍ້ມູນບັນຊີ
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ອີເມວ
              </p>
              <IonInput
                type="email" placeholder="ອີເມວ" value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? "")}
                fill="outline" style={{ "--border-radius": "10px", marginBottom: 16 }}
              />

              {!isEdit ? (
                <>
                  <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                    ລະຫັດຜ່ານ (ຢ່າງໜ້ອຍ 6 ຕົວ)
                  </p>
                  <IonInput
                    type="password" placeholder="ລະຫັດຜ່ານ" value={password}
                    onIonInput={(e) => setPassword(e.detail.value ?? "")}
                    fill="outline" style={{ "--border-radius": "10px" }}
                  />
                  <p style={{ margin: "10px 0 0", fontSize: "0.74rem", color: "var(--app-text-secondary)" }}>
                    ຫຼັງສ້າງແລ້ວ ຈະໄປໜ້າ "ສິດການໃຊ້ງານ" ເພື່ອປັບລະອຽດເພີ່ມເຕີມ (ຖ້າຕ້ອງການ)
                  </p>
                </>
              ) : (
                <>
                  <IonButton
                    expand="block" fill="outline" size="small"
                    disabled={resettingPassword}
                    onClick={handleResetPassword}
                    style={{ "--border-radius": "10px" }}
                  >
                    <IonIcon slot="start" icon={mailOutline} />
                    {resettingPassword ? "ກຳລັງສົ່ງ..." : "Reset ລະຫັດຜ່ານ (ສົ່ງ email)"}
                  </IonButton>
                  {resetMessage && (
                    <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>
                      {resetMessage}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || notFound || !canSubmit}
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
            routerLink="/tabs/staff" routerDirection="back"
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
              if (resultSuccess) {
                history.push(!isEdit && newUid ? `/tabs/user-permissions/${newUid}` : "/tabs/staff");
              }
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default StaffForm;
