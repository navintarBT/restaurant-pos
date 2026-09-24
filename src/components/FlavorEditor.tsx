import { useState } from "react";
import { IonButton, IonIcon, IonInput } from "@ionic/react";
import { addOutline, closeOutline } from "ionicons/icons";

interface Props {
  flavors: string[];
  onChange: (flavors: string[]) => void;
}

// Product-scoped flavor list — inline chip add/remove, no modal (unlike the
// shop-wide Units/Toppings lists, flavors belong to one product only).
const FlavorEditor: React.FC<Props> = ({ flavors, onChange }) => {
  const [draft, setDraft] = useState("");

  function addFlavor() {
    const name = draft.trim();
    if (!name) return;
    if (flavors.some((f) => f.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...flavors, name]);
    setDraft("");
  }

  function removeFlavor(name: string) {
    onChange(flavors.filter((f) => f !== name));
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: flavors.length > 0 ? 10 : 0 }}>
        {flavors.map((f) => (
          <span
            key={f}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "6px 8px 6px 12px", borderRadius: 20,
              background: "var(--app-accent-surface)", border: "1.5px solid var(--ion-color-primary)",
              fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-color-primary)",
            }}
          >
            {f}
            <button
              onClick={() => removeFlavor(f)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2, color: "var(--ion-color-primary)" }}
            >
              <IonIcon icon={closeOutline} style={{ fontSize: 16 }} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <IonInput
          fill="outline"
          placeholder="ເຊັ່ນ: ເຜັດ, ບໍ່ເຜັດ, ໜວານ"
          value={draft}
          onIonInput={(e) => setDraft(e.detail.value ?? "")}
          onKeyDown={(e) => { if (e.key === "Enter") addFlavor(); }}
          style={{ "--min-height": "42px", flex: 1 }}
        />
        <IonButton onClick={addFlavor} disabled={!draft.trim()} style={{ margin: 0, "--border-radius": "10px" }}>
          <IonIcon slot="icon-only" icon={addOutline} />
        </IonButton>
      </div>
    </div>
  );
};

export default FlavorEditor;
