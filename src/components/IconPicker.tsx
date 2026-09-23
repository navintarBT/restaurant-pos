import { useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSearchbar,
  IonInput,
} from "@ionic/react";
import { CATEGORY_ICONS } from "../data/categoryIcons";

interface Props {
  isOpen: boolean;
  value?: string;
  onSelect: (icon: string) => void;
  onDismiss: () => void;
}

// Searchable icon picker backed by @tabler/icons-react — the curated
// CATEGORY_ICONS list covers common pub/restaurant themes (tagged with
// Lao/Thai/English keywords), stored as the icon's `key` string. Staff can
// also type or paste a raw emoji for anything not in the list (rendered as
// plain text by CategoryIconGlyph, since it won't match a known key).
const IconPicker: React.FC<Props> = ({ isOpen, value, onSelect, onDismiss }) => {
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? CATEGORY_ICONS.filter((opt) => opt.keywords.some((k) => k.toLowerCase().includes(q)))
    : CATEGORY_ICONS;

  function pick(icon: string) {
    onSelect(icon);
    setSearch("");
    setCustom("");
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>ເລືອກ Icon</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ padding: "12px 16px 28px" }}>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? "")}
            placeholder="ຄົ້ນຫາ icon ເຊັ່ນ: ແກ້ວ, ເຂົ້າ, ຕຳ, beer"
            style={{ padding: 0, marginBottom: 12 }}
          />

          {filtered.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
              {filtered.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => pick(opt.key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "14px 0", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${value === opt.key ? "var(--ion-color-primary)" : "var(--app-accent-border)"}`,
                    background: value === opt.key ? "var(--app-accent-surface)" : "var(--app-surface)",
                    color: "#c2410c",
                  }}
                >
                  <opt.icon size={24} stroke={1.75} />
                </button>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--app-text-secondary)", fontSize: "0.85rem", marginBottom: 20 }}>
              ບໍ່ພົບ icon ທີ່ຄົ້ນຫາ — ລອງພິມ/ວາງ emoji ເອງດ້ານລຸ່ມ
            </p>
          )}

          <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
            ຫຼືພິມ/ວາງ Icon ເອງ
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <IonInput
              value={custom}
              onIonInput={(e) => setCustom(e.detail.value ?? "")}
              placeholder="ວາງ emoji ທີ່ນີ້"
              fill="outline" style={{ "--border-radius": "10px", flex: 1 }}
            />
            <IonButton
              disabled={!custom.trim()}
              onClick={() => pick(custom.trim())}
              style={{ margin: 0, height: 44, "--border-radius": "10px" }}
            >
              ໃຊ້
            </IonButton>
          </div>

          {value && (
            <IonButton fill="clear" color="danger" expand="block" onClick={() => pick("")} style={{ marginTop: 16 }}>
              ລຶບ Icon ອອກ
            </IonButton>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default IconPicker;
