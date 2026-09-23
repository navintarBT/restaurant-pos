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
  IonText,
  IonMenuButton,
  IonFooter,
  IonAlert,
} from "@ionic/react";
import { chevronBackOutline, peopleOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getShopUsers, updateStaffPermissions } from "../data/shopRepository";
import type { ShopUser } from "../data/types";
import PermCheckboxList, { DEFAULT_PERMS } from "../components/PermCheckboxList";

const cardStyle: React.CSSProperties = {
  background: "var(--app-surface)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
};

// Dedicated "ສິດການໃຊ້ງານ" screen for one staff account — the granular
// checkbox editor only. "ບົດບາດ"/"ໂຊນ" now live on StaffForm.tsx
// (create/edit) instead — this page just carries whatever's already saved
// for them through untouched so saving checkboxes here never resets them.
const UserPermissions: React.FC = () => {
  const { shopId, role } = useAuth();
  const history = useHistory();
  const { uid } = useParams<{ uid: string }>();
  const isOwner = role === "customer";

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<ShopUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!shopId || !isOwner) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const users = await getShopUsers(shopId);
        const found = users.find((u) => u.id === uid) ?? null;
        if (found) {
          setTarget(found);
          setPerms(found.permissions ?? DEFAULT_PERMS);
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [shopId, uid, isOwner]);

  async function handleSave() {
    if (!shopId) return;
    setSaving(true);
    try {
      await updateStaffPermissions(shopId, uid, {
        permissions: perms,
        staffRole: target?.staffRole,
        zoneRestricted: target?.zoneRestricted,
        allowedZones: target?.allowedZones,
      });
      setResultSuccess(true);
      setResultMessage("ບັນທຶກສິດການໃຊ້ງານສຳເລັດ");
      setResultOpen(true);
    } catch {
      setResultSuccess(false);
      setResultMessage("ບັນທຶກບໍ່ສຳເລັດ, ລອງໃໝ່");
      setResultOpen(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
            <IonButton routerLink="/tabs/staff" routerDirection="back">
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>ສິດການໃຊ້ງານ</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : !isOwner ? (
          <div style={{ padding: "16px 16px 28px" }}>
            <div style={{ ...cardStyle, textAlign: "center", padding: "42px 24px" }}>
              <IonIcon icon={peopleOutline} style={{ fontSize: 48, color: "#0f766e" }} />
              <h2 style={{ margin: "12px 0 6px", fontSize: "1.2rem" }}>ສຳລັບເຈົ້າຂອງຮ້ານ</h2>
              <IonText color="medium">
                <p style={{ margin: 0 }}>staff ບໍ່ສາມາດແກ້ໄຂສິດການໃຊ້ງານໄດ້</p>
              </IonText>
            </div>
          </div>
        ) : notFound ? (
          <p style={{ padding: 24, textAlign: "center", color: "var(--app-text-secondary)" }}>ບໍ່ພົບຜູ້ໃຊ້ນີ້</p>
        ) : target?.role === "customer" ? (
          <div style={{ padding: "16px 16px 28px" }}>
            <div style={{ ...cardStyle, textAlign: "center", padding: "42px 24px" }}>
              <IonText color="medium">
                <p style={{ margin: 0 }}>ເຈົ້າຂອງຮ້ານມີສິດເຂົ້າເຖິງທຸກຢ່າງຢູ່ແລ້ວ, ບໍ່ຈຳເປັນຕ້ອງຕັ້ງຄ່າ</p>
              </IonText>
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ ...cardStyle, marginBottom: 14 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "1rem" }}>{target?.displayName || target?.email}</p>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>{target?.email}</p>
            </div>

            <div style={cardStyle}>
              <PermCheckboxList perms={perms} onChange={setPerms} />
            </div>
          </div>
        )}
      </IonContent>
      {isOwner && !notFound && target?.role === "staff" && (
        <IonFooter>
          <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)" }}>
            <IonButton
              expand="block" disabled={saving}
              onClick={handleSave}
              style={{ minHeight: 50, "--border-radius": "14px", margin: 0 }}
            >
              {saving
                ? (<span style={{ display: "flex", alignItems: "center", gap: 8 }}><IonSpinner name="dots" style={{ width: 20, height: 20 }} /> ກຳລັງບັນທຶກ...</span>)
                : "ບັນທຶກ"
              }
            </IonButton>
          </div>
        </IonFooter>
      )}

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
              if (resultSuccess) history.push("/tabs/staff");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default UserPermissions;
