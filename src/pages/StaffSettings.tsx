import { useCallback, useEffect, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { addOutline, createOutline, keyOutline, peopleOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { deleteStaffUser, getShopUsers } from "../data/shopRepository";
import type { ShopUser } from "../data/types";
import ShopHeaderTag from "../components/ShopHeaderTag";
import EmptyState from "../components/EmptyState";
import { PERM_LABELS, STAFF_ROLE_LABELS } from "../components/PermCheckboxList";

const cardStyle: React.CSSProperties = {
  background: "var(--app-surface)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
  marginBottom: 14,
};

// Pure list page — create lives on its own page (StaffForm.tsx, reached via
// the "+" button or a row's edit icon), same split as every other
// "ຈັດການ..." list in this app. Delete applies immediately.
const StaffSettings: React.FC = () => {
  const { shopId, role } = useAuth();
  const [staff, setStaff] = useState<ShopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopUser | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "customer";

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      setStaff(await getShopUsers(shopId));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);

  async function doDelete(user: ShopUser) {
    if (!shopId) return;
    setDeleteTarget(null);
    setDeletingId(user.id); setError(null);
    try {
      await deleteStaffUser(shopId, user.id);
      setStaff(prev => prev.filter(u => u.id !== user.id));
      setMessage("ລຶບພະນັກງານແລ້ວ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລຶບບໍ່ສຳເລັດ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="has-shop-tag">
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
          </IonButtons>
          <div slot="start"><ShopHeaderTag /></div>
          <IonTitle style={{ fontWeight: 700 }}>ຂໍ້ມູນຜູ້ໃຊ້</IonTitle>
          {isOwner && (
            <IonButtons slot="end">
              <IonButton routerLink="/tabs/staff-form">
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "16px 16px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <IonSpinner name="crescent" color="primary" />
            </div>
          ) : !isOwner ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "42px 24px" }}>
              <IonIcon icon={peopleOutline} style={{ fontSize: 48, color: "#0f766e" }} />
              <h2 style={{ margin: "12px 0 6px", fontSize: "1.2rem" }}>ສຳລັບເຈົ້າຂອງຮ້ານ</h2>
              <IonText color="medium">
                <p style={{ margin: 0 }}>staff ບໍ່ສາມາດສ້າງພະນັກງານໃໝ່ໄດ້</p>
              </IonText>
            </div>
          ) : (
            <>
              {(message || error) && (
                <div style={{
                  ...cardStyle,
                  borderLeft: `4px solid ${error ? "var(--app-danger)" : "var(--app-success)"}`,
                  color: error ? "var(--app-danger)" : "var(--app-success)",
                  fontWeight: 700,
                }}>
                  {error ?? message}
                </div>
              )}

              <section style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <IonIcon icon={peopleOutline} style={{ fontSize: 22, color: "#0f766e" }} />
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>ຜູ້ໃຊ້ໃນຮ້ານ</h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--app-text-secondary)", fontSize: "0.78rem", fontWeight: 700 }}>{staff.length} ຄົນ</span>
                    <IonButton routerLink="/tabs/staff-form" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                      <IonIcon slot="start" icon={addOutline} />
                      ເພີ່ມ
                    </IonButton>
                  </div>
                </div>

                <IonList style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--app-accent-border)" }}>
                  {staff.length === 0 ? (
                    <IonItem lines="none" style={{ "--background": "var(--ion-item-background, #ffffff)", "--padding-start": "0", "--inner-padding-end": "0" }}>
                      <div style={{ width: "100%" }}>
                        <EmptyState icon="👥" title="ຍັງບໍ່ມີພະນັກງານ" />
                      </div>
                    </IonItem>
                  ) : staff.map((user) => (
                    <IonItem key={user.id} lines="none" style={{ "--background": "var(--ion-item-background, #ffffff)", "--padding-bottom": "6px", "--padding-top": "6px" }}>
                      <div slot="start" style={{
                        width: 38, height: 38, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                        background: user.role === "customer" ? "var(--app-accent-surface)" : "#ccfbf1",
                        color: user.role === "customer" ? "#c2410c" : "#0f766e",
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
                      }}>
                        {user.profileUrl ? (
                          <img src={user.profileUrl} alt={user.displayName || user.email} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          (user.displayName || user.email).slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <IonLabel>
                        <h3 style={{ fontWeight: 800 }}>{user.displayName || user.email}</h3>
                        <p style={{ fontSize: "0.78rem" }}>{user.email}</p>
                        {/* Role + permission badges */}
                        {user.role === "staff" && user.staffRole && (
                          <span style={{
                            display: "inline-block", fontSize: "0.65rem", fontWeight: 700,
                            background: "var(--app-accent-surface)", color: "var(--ion-color-primary)",
                            padding: "2px 8px", borderRadius: 20, marginTop: 4, marginRight: 4,
                          }}>
                            {STAFF_ROLE_LABELS[user.staffRole]}
                          </span>
                        )}
                        {user.role === "staff" && user.zoneRestricted && user.allowedZones?.length ? (
                          <span style={{ fontSize: "0.65rem", color: "var(--app-text-muted)" }}>
                            ({user.allowedZones.join(", ")})
                          </span>
                        ) : null}
                        {user.role === "staff" && user.permissions && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                            {PERM_LABELS.filter(p => user.permissions![p.key]).map(p => (
                              <span key={p.key} style={{
                                fontSize: "0.6rem", fontWeight: 700,
                                background: "#ccfbf1", color: "#0f766e",
                                padding: "2px 6px", borderRadius: 6,
                              }}>
                                {p.icon}
                              </span>
                            ))}
                            {PERM_LABELS.every(p => !user.permissions![p.key]) && (
                              <span style={{ fontSize: "0.65rem", color: "var(--app-text-muted)" }}>ບໍ່ມີສິດທິພິເສດ</span>
                            )}
                          </div>
                        )}
                      </IonLabel>
                      {/* Permissions/Edit/Delete — only for staff, not the owner */}
                      {user.role === "staff" && (
                        <div slot="end" style={{ display: "flex", gap: 4 }}>
                          <IonButton
                            fill="clear" size="small"
                            routerLink={`/tabs/user-permissions/${user.id}`}
                            style={{ "--color": "#0f766e" }}
                          >
                            <IonIcon icon={keyOutline} />
                          </IonButton>
                          <IonButton
                            fill="clear" size="small"
                            routerLink={`/tabs/staff-form/${user.id}`}
                            style={{ "--color": "#0f766e" }}
                          >
                            <IonIcon icon={createOutline} />
                          </IonButton>
                          <IonButton
                            fill="clear" size="small"
                            disabled={deletingId === user.id}
                            onClick={() => setDeleteTarget(user)}
                            style={{ "--color": "var(--app-danger)" }}
                          >
                            {deletingId === user.id
                              ? <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />
                              : <IonIcon icon={trashOutline} />}
                          </IonButton>
                        </div>
                      )}
                      {user.role === "customer" && (
                        <span slot="end" style={{ fontSize: "0.72rem", fontWeight: 800, color: "#c2410c" }}>
                          owner
                        </span>
                      )}
                    </IonItem>
                  ))}
                </IonList>
              </section>
            </>
          )}
        </div>
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບພະນັກງານ"
        message={`ຕ້ອງການລຶບ "${deleteTarget?.displayName || deleteTarget?.email}" ອອກຈາກຮ້ານ?`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: "ລຶບ", role: "destructive", handler: () => { if (deleteTarget) doDelete(deleteTarget); } },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />
    </IonPage>
  );
};

export default StaffSettings;
