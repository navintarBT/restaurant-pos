import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
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
import { closeOutline, addOutline, trashOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getToppings, setToppings, type ToppingEntry } from "../data/shopRepository";

let nextRowId = 1;

// Dedicated "create topping(s)" screen — kept separate from
// ManageToppings.tsx (which only lists/deletes what's already saved),
// mirroring CreateZone.tsx's split. One save here can add several toppings
// at once: each row is its own name + price, "+" adds another blank row.
const CreateTopping: React.FC = () => {
  const { shopId } = useAuth();
  const history = useHistory();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: number; name: string; price: string }[]>([
    { id: nextRowId++, name: "", price: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const [resultOpen, setResultOpen] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    getToppings(shopId).finally(() => setLoading(false));
  }, [shopId]);

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId++, name: "", price: "" }]);
  }

  function updateRowName(id: number, name: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }

  function updateRowPrice(id: number, price: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, price } : r)));
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function showResult(success: boolean, message: string) {
    setResultSuccess(success);
    setResultMessage(message);
    setResultOpen(true);
  }

  async function handleSubmit() {
    if (!shopId) return;
    const entries: ToppingEntry[] = rows
      .map((r) => {
        const name = r.name.trim();
        if (!name) return null;
        const priceNum = r.price.trim() ? Math.max(0, parseInt(r.price, 10) || 0) : undefined;
        const entry: ToppingEntry = { name };
        if (priceNum) entry.price = priceNum;
        return entry;
      })
      .filter((e): e is ToppingEntry => e !== null);
    if (entries.length === 0) return;

    // Duplicates among the rows just entered.
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.name)) {
        showResult(false, `ຊື່ທັອບປິ້ງ "${e.name}" ຊໍ້າກັນໃນລາຍການທີ່ພິມ`);
        return;
      }
      seen.add(e.name);
    }

    setSaving(true);
    try {
      // Re-fetch fresh right before writing, same reasoning as TableForm.tsx.
      const current = await getToppings(shopId);
      const collision = entries.find((e) => current.some((c) => c.name === e.name));
      if (collision) {
        showResult(false, `ທັອບປິ້ງ "${collision.name}" ມີຢູ່ແລ້ວ`);
        return;
      }
      await setToppings(shopId, [...current, ...entries]);
      showResult(true, entries.length > 1 ? `ສ້າງ ${entries.length} ທັອບປິ້ງສຳເລັດ` : "ສ້າງທັອບປິ້ງສຳເລັດ");
    } catch {
      showResult(false, "ສ້າງທັອບປິ້ງບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setSaving(false);
    }
  }

  const hasAnyName = rows.some((r) => r.name.trim());

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>ສ້າງທັອບປິ້ງໃໝ່</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/manage-toppings" routerDirection="back">
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
        ) : (
          <div style={{ padding: "16px 16px 32px" }}>
            <div style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 800, color: "var(--ion-text-color)" }}>
                ທັອບປິ້ງ
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "0.76rem", color: "var(--app-text-secondary)" }}>
                ເພີ່ມໄດ້ຫຼາຍທັອບປິ້ງພ້ອມກັນ ກົດ "+" ເພື່ອເພີ່ມແຖວ. ປ່ອຍລາຄາວ່າງໄວ້ຖ້າບໍ່ມີຄ່າໃຊ້ຈ່າຍ
              </p>
              {rows.map((row) => (
                <div key={row.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <IonInput
                    placeholder="ຊື່ທັອບປິ້ງ" value={row.name}
                    onIonInput={(e) => updateRowName(row.id, e.detail.value ?? "")}
                    fill="outline" style={{ "--border-radius": "10px", flex: 2 }}
                  />
                  <IonInput
                    type="number" min="0" placeholder="ລາຄາ" value={row.price}
                    onIonInput={(e) => updateRowPrice(row.id, e.detail.value ?? "")}
                    fill="outline" style={{ "--border-radius": "10px", flex: 1 }}
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    style={{
                      background: "none", border: "none", cursor: rows.length > 1 ? "pointer" : "not-allowed",
                      color: rows.length > 1 ? "var(--app-danger)" : "var(--app-text-muted)",
                      minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>
              ))}
              <IonButton
                fill="outline" expand="block" onClick={addRow}
                style={{ "--border-radius": "10px", marginTop: 4 }}
              >
                <IonIcon slot="start" icon={addOutline} />
                ເພີ່ມແຖວ
              </IonButton>
            </div>
          </div>
        )}
      </IonContent>
      <IonFooter>
        <div style={{ padding: "12px 16px 28px", background: "var(--ion-item-background, #fff)", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <IonButton
            expand="block" disabled={saving || loading || !hasAnyName}
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
            routerLink="/tabs/manage-toppings" routerDirection="back"
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
              if (resultSuccess) history.push("/tabs/manage-toppings");
            },
          },
        ]}
        onDidDismiss={() => setResultOpen(false)}
      />
    </IonPage>
  );
};

export default CreateTopping;
