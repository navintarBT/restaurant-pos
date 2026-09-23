import { useCallback, useRef, useState } from "react";
import {
  IonButton, IonIcon, IonSpinner,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonRange,
} from "@ionic/react";
import { cameraOutline, trashOutline, closeOutline } from "ionicons/icons";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

function compressImage(dataUrl: string, maxWidth = 480, quality = 0.70): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Cuts the selected rectangle (in source-image pixel coordinates, as
// reported by react-easy-crop's onCropComplete) out of the full image.
async function extractCroppedArea(src: string, area: Area): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  canvas.getContext("2d")!.drawImage(
    img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height,
  );
  return canvas.toDataURL("image/jpeg", 0.92);
}

interface Props {
  currentUrl?: string;
  onImage: (dataUrl: string) => void;
  onRemove: () => void;
  uploading?: boolean;
}

const ImagePicker: React.FC<Props> = ({ currentUrl, onImage, onRemove, uploading }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Crop step — the just-picked file waits here (uncropped) until the user
  // confirms the frame; onImage()/preview only get the final cropped result.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropBusy, setCropBusy] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);

    // reset input so same file can be selected again
    e.target.value = "";
  }

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirmCrop() {
    if (!cropSrc || !croppedAreaPixels) return;
    setCropBusy(true);
    try {
      const cropped = await extractCroppedArea(cropSrc, croppedAreaPixels);
      const compressed = await compressImage(cropped);
      setPreview(compressed);
      onImage(compressed);
      setCropSrc(null);
    } finally {
      setCropBusy(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    onRemove();
  }

  const displayUrl = preview ?? currentUrl;

  return (
    <div>
      {/* Hidden file input — accept images, allow camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {displayUrl ? (
        <div style={{ position: "relative" }}>
          <img
            src={displayUrl}
            alt="product"
            style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 12 }}
          />
          {uploading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IonSpinner name="crescent" color="light" />
              <span style={{ color: "#fff", marginLeft: 8, fontSize: "0.85rem" }}>ກຳລັງອັບໂຫລດ...</span>
            </div>
          )}
          <IonButton fill="solid" color="danger" size="small" onClick={handleRemove}
            style={{ position: "absolute", top: 8, right: 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={trashOutline} />
          </IonButton>
          <IonButton fill="solid" color="light" size="small" onClick={() => inputRef.current?.click()}
            style={{ position: "absolute", top: 8, left: 8, "--border-radius": "50%", minWidth: 36, minHeight: 36 }}>
            <IonIcon slot="icon-only" icon={cameraOutline} />
          </IonButton>
        </div>
      ) : (
        <IonButton expand="block" fill="outline" onClick={() => inputRef.current?.click()}
          style={{ "--border-radius": "12px", height: 100 }}>
          <IonIcon slot="start" icon={cameraOutline} />
          ຖ່າຍ / ເລືອກຮູບ
        </IonButton>
      )}

      {/* Crop step — zoom/pan the picked photo within a fixed frame, then
          only the framed area is kept. */}
      <IonModal isOpen={!!cropSrc} onDidDismiss={() => setCropSrc(null)}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setCropSrc(null)} disabled={cropBusy}>
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle style={{ fontSize: "1rem" }}>ປັບຮູບ</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={handleConfirmCrop} disabled={cropBusy || !croppedAreaPixels} strong>
                {cropBusy ? <IonSpinner name="dots" style={{ width: 18, height: 18 }} /> : "ຕົກລົງ"}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent scrollY={false}>
          <div style={{ position: "relative", width: "100%", height: "70vh", background: "#111" }}>
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            )}
          </div>
          <div style={{ padding: "18px 24px 24px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "var(--app-text-secondary)", textAlign: "center" }}>
              ລາກຮູບເພື່ອຍ້າຍ · ເລື່ອນແຖບລຸ່ມເພື່ອຊູມ
            </p>
            <IonRange
              min={1} max={4} step={0.01} value={zoom}
              onIonInput={(e) => setZoom(Number(e.detail.value))}
            />
          </div>
        </IonContent>
      </IonModal>
    </div>
  );
};

export default ImagePicker;
