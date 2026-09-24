import { useState } from "react";
import { IonSegment, IonSegmentButton, IonLabel, IonRange } from "@ionic/react";
import { HexColorPicker, HexColorInput } from "react-colorful";

// A broad general-purpose palette — not exhaustive, just a fast-tap starting
// point; the other two modes (spectrum/sliders) cover anything not here.
const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c",
  "#a8a29e", "#57534e", "#1f2937", "#000000", "#ffffff", "#fde68a",
];

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = HEX_RE.test(hex) ? hex.replace("#", "") : "000000";
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

type RgbChannel = "r" | "g" | "b";
const CHANNELS: { key: RgbChannel; label: string; color: string }[] = [
  { key: "r", label: "ແດງ (R)", color: "#dc2626" },
  { key: "g", label: "ຂຽວ (G)", color: "#16a34a" },
  { key: "b", label: "ຟ້າ (B)", color: "#2563eb" },
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
  // The shop's saved custom palette (ManageColors.tsx / getColors), shown as
  // an extra quick-pick row above the built-in presets when provided.
  savedColors?: string[];
}

// Three ways to pick the same hex color, per the user's own spec:
// 1. ຕາຕະລາງສີ — tap a preset swatch
// 2. ສະເປັກຕຣັມ — react-colorful's saturation/hue picker
// 3. ແຖບເລື່ອນ — plain R/G/B sliders
// All three (plus the text input) drive the same `value`/`onChange` — none
// of them "own" the color, so switching modes mid-pick never loses it.
const ColorPicker: React.FC<Props> = ({ value, onChange, savedColors }) => {
  const [mode, setMode] = useState<"grid" | "spectrum" | "sliders">("grid");
  const safeValue = HEX_RE.test(value) ? value : "#000000";
  const rgb = hexToRgb(safeValue);

  function setChannel(channel: RgbChannel, n: number) {
    onChange(rgbToHex(
      channel === "r" ? n : rgb.r,
      channel === "g" ? n : rgb.g,
      channel === "b" ? n : rgb.b,
    ));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: safeValue, border: "1.5px solid var(--app-border)",
        }} />
        <HexColorInput
          prefixed
          color={safeValue}
          onChange={onChange}
          placeholder="#000000"
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--app-border)",
            fontSize: "0.9rem", fontFamily: "monospace", textTransform: "uppercase",
            background: "var(--app-surface)", color: "var(--ion-text-color)",
          }}
        />
      </div>

      <IonSegment
        value={mode}
        onIonChange={(e) => setMode(e.detail.value as "grid" | "spectrum" | "sliders")}
        style={{ marginBottom: 14 }}
      >
        <IonSegmentButton value="grid"><IonLabel style={{ fontSize: "0.78rem" }}>ຕາຕະລາງສີ</IonLabel></IonSegmentButton>
        <IonSegmentButton value="spectrum"><IonLabel style={{ fontSize: "0.78rem" }}>ສະເປັກຕຣັມ</IonLabel></IonSegmentButton>
        <IonSegmentButton value="sliders"><IonLabel style={{ fontSize: "0.78rem" }}>ແຖບເລື່ອນ</IonLabel></IonSegmentButton>
      </IonSegment>

      {mode === "grid" && (
        <div>
          {savedColors && savedColors.length > 0 && (
            <>
              <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ສີທີ່ບັນທຶກໄວ້
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
                {savedColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange(c)}
                    style={{
                      aspectRatio: "1", borderRadius: 10, cursor: "pointer", background: c,
                      border: safeValue.toLowerCase() === c.toLowerCase() ? "3px solid var(--ion-color-primary)" : "1.5px solid var(--app-border)",
                    }}
                  />
                ))}
              </div>
              <p style={{ margin: "0 0 8px", fontSize: "0.72rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                ສີພື້ນຖານ
              </p>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                style={{
                  aspectRatio: "1", borderRadius: 10, cursor: "pointer", background: c,
                  border: safeValue.toLowerCase() === c.toLowerCase() ? "3px solid var(--ion-color-primary)" : "1.5px solid var(--app-border)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {mode === "spectrum" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <HexColorPicker color={safeValue} onChange={onChange} style={{ width: "100%", maxWidth: 280 }} />
        </div>
      )}

      {mode === "sliders" && (
        <div>
          {CHANNELS.map(({ key, label, color }) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                <span>{label}</span>
                <span>{rgb[key]}</span>
              </div>
              <IonRange
                min={0} max={255} value={rgb[key]}
                onIonInput={(e) => setChannel(key, Number(e.detail.value))}
                style={{ "--bar-background-active": color, "--knob-background": color, "--bar-height": "6px" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
