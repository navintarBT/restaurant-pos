import { useState, useEffect, useRef } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonIcon,
  IonList, IonListHeader, IonText, IonSpinner, IonAlert, IonSegment, IonSegmentButton,
} from "@ionic/react";
import { addOutline, trashOutline, chevronDownOutline, checkmarkOutline, closeOutline, createOutline } from "ionicons/icons";
import type { Product, ProductVariant, Category } from "../data/types";
import { uploadProductImage } from "../data/imageRepository";
import { addCategory, updateCategory, deleteCategory, isCategoryInUse, renameCategoryInProducts } from "../data/categoryRepository";
import { getUnits, getToppings, getColors, getSizes, getFlavors, type ToppingEntry } from "../data/shopRepository";
import { getProducts } from "../data/productRepository";
import ImagePicker from "./ImagePicker";
import ColorPicker from "./ColorPicker";
import NumInput from "./NumInput";
import ProductVariantRow from "./ProductVariantRow";
import UnitPickerSheet from "./UnitPickerSheet";
import ToppingPickerSheet from "./ToppingPickerSheet";
import SizePickerSheet from "./SizePickerSheet";
import FlavorPickerSheet from "./FlavorPickerSheet";

interface Props {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  shopId?: string;
  isOwner?: boolean;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onDismiss: () => void;
  onCategoryChanged?: (cats: Category[]) => void;
  onCategoryRenamed?: (oldName: string, newName: string) => void;
}

interface FormErrors {
  name?: string;
  flavorsMsg?: string;
  badVariants?: Set<number>;
  variantsMsg?: string;
  save?: string;
}

const emptyVariant = (): ProductVariant => ({ size: "", color: "", stock: 0, price: 0, costPrice: 0, status: "active" });

function variantErrorMsg(v: ProductVariant): string {
  const missing: string[] = [];
  if (!v.size.trim()) missing.push("ຂະໜາດ");
  if ((v.price ?? 0) <= 0) missing.push("ລາຄາຂາຍ");
  if ((v.costPrice ?? 0) <= 0) missing.push("ລາຄາຕົ້ນທຶນ");
  return missing.length ? `ຕ້ອງໃສ່ ${missing.join(", ")}` : "";
}

// Next sequential "P0001", "P0002", ... code — based on the highest existing
// code matching that pattern, not the product count, so a deleted product
// never frees up its old number for reuse.
function nextProductCode(existing: Product[]): string {
  let max = 0;
  for (const p of existing) {
    const m = /^P(\d+)$/.exec(p.code ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `P${String(max + 1).padStart(4, "0")}`;
}

const ProductForm: React.FC<Props> = ({
  isOpen, product, categories, shopId, isOwner = false, onSave, onDismiss,
  onCategoryChanged, onCategoryRenamed,
}) => {
  // ── Section 1: ກຳນົດຮູບສິນຄ້າ ──
  const [imageMode, setImageMode] = useState<"photo" | "color">("photo");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [color, setColor] = useState("#e07b39");
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // ── Section 2: ກຳນົດຮູບແບບການຂາຍ ──
  const [productType, setProductType] = useState<"regular" | "bundle" | "promotion">("regular");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [shopUnits, setShopUnits] = useState<string[]>([]);
  const [reorderPoint, setReorderPoint] = useState(5);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [canBeGift, setCanBeGift] = useState(false);
  const [needsKitchen, setNeedsKitchen] = useState(true);

  // ── Section 3: ລົດຊາດ ──
  const [hasFlavors, setHasFlavors] = useState(false);
  // Subset of the shop-wide flavor list (shopFlavors) offered for THIS
  // product — same reuse-a-shared-list pattern as toppings.
  const [flavors, setFlavors] = useState<string[]>([]);
  const [maxFlavors, setMaxFlavors] = useState(1);
  const [shopFlavors, setShopFlavors] = useState<string[]>([]);
  const [flavorPickerOpen, setFlavorPickerOpen] = useState(false);

  // ── Section 4: ລາຍລະອຽດ ແລະ ລາຄາ ──
  const [variants, setVariants] = useState<ProductVariant[]>([emptyVariant()]);
  const [shopSizes, setShopSizes] = useState<string[]>([]);
  // Which variant row is currently picking a size (index into `variants`),
  // or null when the sheet is closed.
  const [sizePickerRowIndex, setSizePickerRowIndex] = useState<number | null>(null);

  // ── Section 5: ກຳນົດການຕັດສະຕັອກ ──
  const [trackStock, setTrackStock] = useState(true);

  // ── Section 6: ທັອບປິ້ງ ──
  const [hasToppings, setHasToppings] = useState(false);
  const [toppingNames, setToppingNames] = useState<string[]>([]);
  const [maxToppings, setMaxToppings] = useState<number | undefined>(undefined);
  const [shopToppings, setShopToppings] = useState<ToppingEntry[]>([]);
  const [toppingPickerOpen, setToppingPickerOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [newCatAlertOpen, setNewCatAlertOpen] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [manageCatMode, setManageCatMode] = useState(false);
  const [editCatTarget, setEditCatTarget] = useState<Category | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const [deleteVariantIdx, setDeleteVariantIdx] = useState<number | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalCats(categories);
      setName(product?.name ?? "");
      setCategory(product?.category ?? "");
      setPhotoUrl(product?.photoUrl);
      setColor(product?.color || "#e07b39");
      setImageMode(product?.color && !product?.photoUrl ? "color" : "photo");
      setPendingDataUrl(null);
      setCanBeGift(product?.canBeGift ?? false);
      setNeedsKitchen(product?.needsKitchen ?? true);

      setProductType(product?.productType ?? "regular");
      setCode(product?.code ?? "");
      setUnit(product?.unit ?? "");
      // Legacy per-variant minStock is folded into one product-level number —
      // take the highest existing threshold so no variant's old alert point
      // becomes unreachable after the merge.
      setReorderPoint(
        product?.reorderPoint ?? (product?.variants.length ? Math.max(...product.variants.map((v) => v.minStock ?? 5)) : 5)
      );
      setAlertEnabled(product?.alertEnabled ?? true);

      // Auto-migrate legacy freeform variant "option" text into the flavor
      // system on first open, instead of defaulting hasFlavors to false and
      // silently discarding it (color was a freeform spice-level/no-ice
      // field before flavors existed — see ProductVariant.color). Flavor no
      // longer lives on the variant at all, so this only seeds the
      // product's selected-flavor subset — the migrated variants' own
      // `color` gets blanked below (vArr) since it no longer carries any
      // meaning. Migrated names that aren't yet in the shop-wide flavor list
      // (loaded separately below) simply won't show as checkable rows in
      // FlavorPickerSheet until re-picked — a rare legacy-data edge case.
      if (product && product.hasFlavors === undefined && product.variants.some((v) => v.color?.trim())) {
        setHasFlavors(true);
        setFlavors([...new Set(product.variants.map((v) => v.color).filter((c) => c && c.trim()))]);
      } else {
        setHasFlavors(product?.hasFlavors ?? false);
        setFlavors(product?.flavors ?? []);
      }
      setMaxFlavors(product?.maxFlavors || 1);

      setTrackStock(product?.trackStock ?? true);

      setHasToppings(product?.hasToppings ?? false);
      setToppingNames(product?.toppingNames ?? []);
      setMaxToppings(product?.maxToppings);

      const vArr = product?.variants.length
        ? product.variants.map((v) => ({
            ...v,
            // Flavor never lives on the variant (see note above) — blank any
            // legacy/stale value so it can't masquerade as a real dimension.
            color: "",
            price: v.price ?? product.price ?? 0,
            costPrice: v.costPrice ?? product.costPrice ?? 0,
            status: v.status ?? "active",
          }))
        : [emptyVariant()];
      setVariants(vArr);
      setErrors({});
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (isOpen && shopId) {
      getUnits(shopId).then(setShopUnits).catch(() => {});
      getToppings(shopId).then(setShopToppings).catch(() => {});
      getColors(shopId).then(setSavedColors).catch(() => {});
      getSizes(shopId).then(setShopSizes).catch(() => {});
      getFlavors(shopId).then(setShopFlavors).catch(() => {});
      // New product only — an edited product keeps its existing code
      // (already set from `product.code` in the effect above).
      if (!product) {
        getProducts(shopId).then((all) => setCode(nextProductCode(all))).catch(() => {});
      }
    }
  }, [isOpen, shopId, product]);

  function updateVariant(index: number, field: keyof ProductVariant, value: string | number) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  // Shared by ProductVariantRow's onChange and SizePickerSheet's onPick, so
  // picking a size clears the row's invalid state exactly like typing would.
  function handleVariantFieldChange(index: number, field: keyof ProductVariant, value: string | number) {
    updateVariant(index, field, value);
    if (errors.badVariants?.has(index)) clearFieldError("variantsMsg");
  }

  function addVariant() {
    setVariants((p) => [...p, emptyVariant()]);
  }

  function removeVariant(idx: number) {
    setVariants((p) => p.filter((_, j) => j !== idx));
    setErrors((prev) => {
      if (!prev.badVariants) return prev;
      const next = new Set(prev.badVariants);
      next.delete(idx);
      return { ...prev, badVariants: next.size > 0 ? next : undefined, variantsMsg: next.size > 0 ? prev.variantsMsg : undefined };
    });
  }

  function toggleTopping(name: string) {
    setToppingNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function toggleFlavor(name: string) {
    setFlavors((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function clearFieldError(field: keyof FormErrors) {
    if ((errors as Record<string, unknown>)[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleCreateCategory(catName: string) {
    if (!shopId || !catName.trim()) return;
    const trimmed = catName.trim();
    const match = localCats.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setCatError(`ໝວດໝູ່ "${match.name}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      return;
    }
    try {
      const id = await addCategory(shopId, trimmed);
      const newCat: Category = { id, name: trimmed };
      const next = [...localCats, newCat];
      setLocalCats(next);
      setCategory(trimmed);
      onCategoryChanged?.(next);
    } catch {
      setCatError("ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ — ກວດສິດທິຂອງ staff ຫຼືລອງໃໝ່");
    }
  }

  async function handleEditCategory(data: Record<string, string>) {
    const catName = (data[0] ?? "").trim();
    if (!catName || !editCatTarget || !shopId) return;
    const oldName = editCatTarget.name;
    const duplicate = localCats.find((c) => c.id !== editCatTarget.id && c.name.toLowerCase() === catName.toLowerCase());
    if (duplicate) {
      setCatError(`ໝວດໝູ່ "${duplicate.name}" ມີຢູ່ແລ້ວ — ກະລຸນາໃຊ້ຊື່ອື່ນ`);
      setEditCatTarget(null);
      return;
    }
    try {
      await updateCategory(shopId, editCatTarget.id, catName);
      await renameCategoryInProducts(shopId, oldName, catName);
      const next = localCats.map((c) => (c.id === editCatTarget.id ? { ...c, name: catName } : c));
      setLocalCats(next);
      if (category === oldName) setCategory(catName);
      setEditCatTarget(null);
      onCategoryChanged?.(next);
      onCategoryRenamed?.(oldName, catName);
    } catch {
      setCatError("ແກ້ໄຂໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
      setEditCatTarget(null);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCatTarget || !shopId) return;
    try {
      const inUse = await isCategoryInUse(shopId, deleteCatTarget.name);
      if (inUse) {
        setCatError(`ບໍ່ສາມາດລຶບ "${deleteCatTarget.name}" ເພາະມີເມນູທີ່ໃຊ້ໝວດນີ້ຢູ່`);
        setDeleteCatTarget(null);
        return;
      }
      await deleteCategory(shopId, deleteCatTarget.id);
      const next = localCats.filter((c) => c.id !== deleteCatTarget.id);
      setLocalCats(next);
      if (category === deleteCatTarget.name) setCategory("");
      setDeleteCatTarget(null);
      onCategoryChanged?.(next);
    } catch {
      setCatError("ລຶບໝວດໝູ່ບໍ່ສຳເລັດ — ລອງໃໝ່");
      setDeleteCatTarget(null);
    }
  }

  async function handleSave() {
    const newErrors: FormErrors = {};

    if (!name.trim()) newErrors.name = "ກະລຸນາໃສ່ຊື່ເມນູ";
    if (name.trim().length > 0 && name.trim().length < 2) newErrors.name = "ຊື່ເມນູຕ້ອງຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ";

    if (hasFlavors && flavors.length === 0) {
      newErrors.flavorsMsg = "ຕ້ອງມີຢ່າງໜ້ອຍ 1 ລົດຊາດ, ຫຼືປິດການໃຊ້ງານລົດຊາດ";
    }

    // Validate each variant row: size + price + cost (flavor never lives on
    // the variant — see Product.hasFlavors/maxFlavors)
    const badIdxs = new Set<number>();
    variants.forEach((v, i) => {
      const sizeOk = !!v.size.trim();
      const priceOk = (v.price ?? 0) > 0;
      const costOk = (v.costPrice ?? 0) > 0;
      if (!sizeOk || !priceOk || !costOk) badIdxs.add(i);
    });
    const validVariants = variants.filter((_, i) => !badIdxs.has(i));

    if (validVariants.length === 0) {
      newErrors.badVariants = badIdxs;
      newErrors.variantsMsg = "ຕ້ອງມີຢ່າງໜ້ອຍ 1 variant ທີ່ຂຽນຄົບ (ຂະໜາດ/ລາຄາ)";
    } else if (badIdxs.size > 0) {
      newErrors.badVariants = badIdxs;
      newErrors.variantsMsg = `${badIdxs.size} variant ຂຽນບໍ່ຄົບ — ກວດແຖວທີ່ຂອບສີແດງ`;
    } else {
      const seen = new Set<string>();
      for (const v of validVariants) {
        const key = v.size.trim().toLowerCase();
        if (seen.has(key)) {
          newErrors.variantsMsg = `ມີ variant ຊ້ຳ: "${v.size}" — ກະລຸນາປ່ຽນ`;
          break;
        }
        seen.add(key);
      }
    }

    if (hasToppings && maxToppings != null && maxToppings < 1) {
      // Clamp rather than block — an accidental 0 shouldn't stop the save.
      setMaxToppings(undefined);
    }

    setErrors(newErrors);

    const hasBlocker = newErrors.name || newErrors.flavorsMsg || newErrors.variantsMsg;
    if (hasBlocker) {
      // The blocking field(s) can be scrolled out of view, which otherwise
      // makes clicking ບັນທຶກ look like it silently did nothing.
      contentRef.current?.scrollToTop(300);
      return;
    }

    setBusy(true);
    try {
      let finalPhotoUrl = photoUrl;
      if (imageMode === "photo" && pendingDataUrl) {
        setUploading(true);
        finalPhotoUrl = await uploadProductImage(pendingDataUrl);
        setUploading(false);
      }

      const finalVariants = validVariants.map((v) => ({
        size: v.size.trim(),
        color: "",
        stock: Number(v.stock) || 0,
        price: Number(v.price) || 0,
        costPrice: Number(v.costPrice) || 0,
        status: v.status ?? "active",
      }));

      const payload: Omit<Product, "id"> = {
        name: name.trim(),
        // Legacy top-level fallback (kept for any code not yet migrated to
        // per-variant price/cost) — mirrors the first/cheapest variant.
        price: finalVariants[0]?.price ?? 0,
        // Mutually exclusive with color — always write both explicitly (as
        // "" when inactive) so switching modes on an edit actually clears
        // the stale one instead of leaving it to linger in Firestore.
        photoUrl: imageMode === "photo" ? (finalPhotoUrl ?? "") : "",
        color: imageMode === "color" ? color : "",
        variants: finalVariants,
        canBeGift,
        needsKitchen,
        productType,
        reorderPoint: Math.max(0, Math.round(reorderPoint) || 0),
        alertEnabled,
        hasFlavors,
        trackStock,
        hasToppings,
      };
      if (category.trim()) payload.category = category.trim();
      if (finalVariants[0]?.costPrice) payload.costPrice = finalVariants[0].costPrice;
      if (code.trim()) payload.code = code.trim();
      if (unit.trim()) payload.unit = unit.trim();
      if (hasFlavors && flavors.length > 0) payload.flavors = flavors;
      if (hasFlavors && maxFlavors > 1) payload.maxFlavors = maxFlavors;
      if (hasToppings && toppingNames.length > 0) payload.toppingNames = toppingNames;
      if (hasToppings && maxToppings) payload.maxToppings = maxToppings;

      await onSave(payload);
      onDismiss();
    } catch (err) {
      setErrors((prev) => ({ ...prev, save: err instanceof Error ? err.message : "ບັນທຶກບໍ່ສຳເລັດ ລອງໃໝ່ອີກຄັ້ງ" }));
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  const sectionHeader = (label: string): React.CSSProperties => ({
    margin: "20px 0 8px", fontSize: "0.8rem", fontWeight: 800, color: "var(--ion-color-primary)",
    textTransform: "uppercase", letterSpacing: "0.02em",
  });
  const inputBase: React.CSSProperties = {
    width: "100%", border: "none", outline: "none", background: "transparent",
    fontSize: "1rem", padding: "8px 0", color: "var(--ion-text-color)",
  };
  const errText: React.CSSProperties = {
    margin: "3px 0 4px", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-danger)",
  };

  function toggleCard(active: boolean, title: string, subtitle: string, onClick: () => void) {
    return (
      <div
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          margin: "8px 0", padding: "12px 14px", borderRadius: 10,
          background: active ? "var(--app-accent-surface)" : "var(--ion-color-step-50, #f5f5f4)",
          border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--ion-color-step-150, var(--app-border))"}`,
          cursor: "pointer",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--ion-text-color)" }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--app-text-secondary)" }}>{subtitle}</p>
        </div>
        <div style={{
          width: 46, height: 26, borderRadius: 13, flexShrink: 0, marginLeft: 12,
          background: active ? "var(--ion-color-primary)" : "var(--ion-color-step-200, #d4d4d0)",
          position: "relative", transition: "background 0.15s",
        }}>
          <div style={{
            position: "absolute", top: 2, left: active ? 22 : 2,
            width: 22, height: 22, borderRadius: "50%", background: "var(--app-surface)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s",
          }} />
        </div>
      </div>
    );
  }

  return (
    <>
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{product ? "ແກ້ໄຂເມນູ" : "ເພີ່ມເມນູ"}</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss} disabled={busy || uploading}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSave} disabled={busy || uploading}>
              {busy
                ? <><IonSpinner name="dots" style={{ width: 16, height: 16, marginRight: 6 }} />ກຳລັງບັນທຶກ...</>
                : "ບັນທຶກ"
              }
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" ref={contentRef}>

        {/* ── Section 1: ກຳນົດຮູບສິນຄ້າ ── */}
        <p style={{ ...sectionHeader(""), marginTop: 0 }}>ກຳນົດຮູບສິນຄ້າ</p>
        <IonSegment value={imageMode} onIonChange={(e) => setImageMode(e.detail.value as "photo" | "color")} style={{ marginBottom: 12 }}>
          <IonSegmentButton value="photo"><IonLabel style={{ fontSize: "0.82rem" }}>ຮູບພາບ</IonLabel></IonSegmentButton>
          <IonSegmentButton value="color"><IonLabel style={{ fontSize: "0.82rem" }}>ສີ</IonLabel></IonSegmentButton>
        </IonSegment>
        {imageMode === "photo" ? (
          <ImagePicker
            currentUrl={photoUrl}
            uploading={uploading}
            onImage={(dataUrl) => setPendingDataUrl(dataUrl)}
            onRemove={() => { setPhotoUrl(undefined); setPendingDataUrl(null); }}
          />
        ) : (
          <div
            onClick={() => setColorPickerOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderRadius: 10, cursor: "pointer",
              border: "1.5px solid var(--app-border)", background: "var(--app-surface)",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: color, border: "1.5px solid var(--app-border)",
            }} />
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.92rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ion-text-color)" }}>
              {color}
            </span>
            <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 18 }} />
          </div>
        )}

        {/* ── Section 2: ກຳນົດຮູບແບບການຂາຍ ── */}
        <p style={sectionHeader("")}>ກຳນົດຮູບແບບການຂາຍ</p>
        <IonSegment
          value={productType}
          onIonChange={(e) => setProductType(e.detail.value as "regular" | "bundle" | "promotion")}
          style={{ marginBottom: 8 }}
        >
          <IonSegmentButton value="regular"><IonLabel style={{ fontSize: "0.76rem" }}>ສິນຄ້າທົ່ວໄປ</IonLabel></IonSegmentButton>
          <IonSegmentButton value="bundle"><IonLabel style={{ fontSize: "0.76rem" }}>ຊຸດອາຫານ</IonLabel></IonSegmentButton>
          <IonSegmentButton value="promotion"><IonLabel style={{ fontSize: "0.76rem" }}>ໂປຣໂມຊັນ</IonLabel></IonSegmentButton>
        </IonSegment>

        <IonList lines="full">
          <IonItem>
            <IonLabel position="stacked">ລະຫັດສິນຄ້າ</IonLabel>
            <IonInput value={code} onIonInput={(e) => setCode(e.detail.value ?? "")} placeholder="ບໍ່ບັງຄັບ" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked" color={errors.name ? "danger" : undefined}>ຊື່ເມນູ *</IonLabel>
            <IonInput
              value={name}
              onIonInput={(e) => { setName(e.detail.value ?? ""); clearFieldError("name"); }}
              placeholder="ເຊັ່ນ: ເຝີງົວ, ກາເຟນົມເຢັນ"
              style={{ borderBottom: `2px solid ${errors.name ? "var(--app-danger)" : "transparent"}` }}
            />
          </IonItem>
          {errors.name && <p style={{ ...errText, paddingLeft: 16 }}>{errors.name}</p>}
          <IonItem button detail={false} onClick={() => setCatPickerOpen(true)}>
            <IonLabel position="stacked">ໝວດໝູ່</IonLabel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0 8px" }}>
              <span style={{ color: category ? "var(--ion-text-color)" : "var(--app-text-muted)", fontSize: "1rem" }}>
                {category || "ເລືອກໝວດໝູ່"}
              </span>
              <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 18 }} />
            </div>
          </IonItem>
          <IonItem button detail={false} onClick={() => setUnitPickerOpen(true)}>
            <IonLabel position="stacked">ຫົວໜ່ວຍ</IonLabel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0 8px" }}>
              <span style={{ color: unit ? "var(--ion-text-color)" : "var(--app-text-muted)", fontSize: "1rem" }}>
                {unit || "ເລືອກຫົວໜ່ວຍ"}
              </span>
              <IonIcon icon={chevronDownOutline} style={{ color: "var(--app-text-muted)", fontSize: 18 }} />
            </div>
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">ຈຸດສັ່ງຊື້ (ເຕືອນເມື່ອສະຕັອກ ≤)</IonLabel>
            <NumInput value={reorderPoint} onChange={setReorderPoint} placeholder="5" style={inputBase} />
          </IonItem>
        </IonList>

        {toggleCard(alertEnabled, "🔔 ການແຈ້ງເຕືອນສະຕັອກ", "ຖ້າເປີດ ເມນູນີ້ຈະປະກົດໃນໜ້າສະຕັອກເມື່ອໃກ້/ໝົດ", () => setAlertEnabled((v) => !v))}
        {toggleCard(canBeGift, "🎁 ໃຫ້ເປັນຂອງແຖມໄດ້", "ຖ້າເປີດ ຈະເລືອກເມນູນີ້ເປັນຂອງແຖມໄດ້ຈາກໜ້າກະຕ່າ", () => setCanBeGift((v) => !v))}
        {toggleCard(needsKitchen, "👨‍🍳 ຕ້ອງຜ່ານຄົວ", "ຖ້າປິດ ອໍເດີ້ຈະຂ້າມຫ້ອງຄົວ ໄປພ້ອມເສີບທັນທີ (ເຊັ່ນ: ເຄື່ອງດື່ມ)", () => setNeedsKitchen((v) => !v))}

        {/* ── Section 3: ລົດຊາດ ── */}
        <p style={sectionHeader("")}>ລົດຊາດ</p>
        {toggleCard(hasFlavors, "ມີລົດຊາດໃຫ້ເລືອກ", "ເຊັ່ນ: ເຜັດ/ບໍ່ເຜັດ, ຫວານ/ບໍ່ຫວານ — ລູກຄ້າເລືອກຕອນສັ່ງ, ລາຄາ/ສະຕັອກໃຊ້ຮ່ວມກັນ ບໍ່ແຍກຕາມລົດຊາດ", () => setHasFlavors((v) => !v))}
        {hasFlavors && (
          <div style={{ marginTop: 8 }}>
            <IonItem button detail={false} onClick={() => setFlavorPickerOpen(true)} lines="full">
              <IonLabel position="stacked">ລົດຊາດທີ່ມີໃຫ້ (ເລືອກໄດ້ຫຼາຍລາຍການ)</IonLabel>
              <div style={{ padding: "8px 0", color: flavors.length ? "var(--ion-text-color)" : "var(--app-text-muted)", fontSize: "0.92rem" }}>
                {flavors.length > 0 ? flavors.join(", ") : "ກົດເພື່ອເລືອກ/ຈັດການລົດຊາດ"}
              </div>
            </IonItem>
            {errors.flavorsMsg && <p style={errText}>{errors.flavorsMsg}</p>}
            <IonItem lines="none" style={{ marginTop: 8, "--padding-start": "0" }}>
              <IonLabel position="stacked">ເລືອກໄດ້ຈຳນວນລົດຊາດ (ຕໍ່ 1 ລາຍການ)</IonLabel>
              <NumInput value={maxFlavors} onChange={(n) => setMaxFlavors(Math.max(1, n))} placeholder="1" style={inputBase} />
            </IonItem>
          </div>
        )}

        {/* ── Section 4: ລາຍລະອຽດ ແລະ ລາຄາ ── */}
        <IonListHeader style={{ paddingTop: 16, paddingLeft: 0 }}>
          <IonLabel style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--ion-color-primary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
            ລາຍລະອຽດ ແລະ ລາຄາ
          </IonLabel>
        </IonListHeader>

        {variants.map((v, i) => (
          <ProductVariantRow
            key={i}
            variant={v}
            index={i}
            trackStock={trackStock}
            invalid={{
              size: errors.badVariants?.has(i) && !v.size.trim(),
            }}
            errorMsg={errors.badVariants?.has(i) ? variantErrorMsg(v) : undefined}
            canDelete={variants.length > 1}
            onChange={(field, value) => handleVariantFieldChange(i, field, value)}
            onDelete={() => setDeleteVariantIdx(i)}
            onOpenSizePicker={() => setSizePickerRowIndex(i)}
          />
        ))}

        <IonButton fill="outline" expand="block" onClick={addVariant} style={{ marginTop: 8 }}>
          <IonIcon slot="start" icon={addOutline} />
          ເພີ່ມ variant
        </IonButton>

        {errors.variantsMsg && (
          <IonText color="danger">
            <p style={{ paddingTop: 6, fontSize: "0.82rem" }}>⚠ {errors.variantsMsg}</p>
          </IonText>
        )}

        {/* ── Section 5: ກຳນົດການຕັດສະຕັອກ ── */}
        <p style={sectionHeader("")}>ກຳນົດການຕັດສະຕັອກ</p>
        {toggleCard(trackStock, "📦 ຈັດການສະຕັອກ", trackStock ? "ຂາຍແລ້ວຈະຕັດສະຕັອກອັດຕະໂນມັດ" : "ຂາຍໄດ້ບໍ່ຈຳກັດ, ບໍ່ຕັດສະຕັອກ ບໍ່ວ່າຈະໃສ່ຈຳນວນເທົ່າໃດ", () => setTrackStock((v) => !v))}

        {/* ── Section 6: ທັອບປິ້ງ ── */}
        <p style={sectionHeader("")}>ທັອບປິ້ງ</p>
        {toggleCard(hasToppings, "ມີທັອບປິ້ງ", "ລູກຄ້າ/ພະນັກງານຈະເລືອກທັອບປິ້ງໄດ້ເມື່ອສັ່ງເມນູນີ້", () => setHasToppings((v) => !v))}
        {hasToppings && (
          <div style={{ marginTop: 8 }}>
            <IonItem button detail={false} onClick={() => setToppingPickerOpen(true)} lines="full">
              <IonLabel position="stacked">ທັອບປິ້ງທີ່ມີໃຫ້ (ເລືອກໄດ້ຫຼາຍລາຍການ)</IonLabel>
              <div style={{ padding: "8px 0", color: toppingNames.length ? "var(--ion-text-color)" : "var(--app-text-muted)", fontSize: "0.92rem" }}>
                {toppingNames.length > 0 ? toppingNames.join(", ") : "ກົດເພື່ອເລືອກ/ຈັດການທັອບປິ້ງ"}
              </div>
            </IonItem>
            <IonItem lines="none" style={{ marginTop: 4 }}>
              <IonLabel position="stacked">ຈຳກັດຈຳນວນທັອບປິ້ງ (ບໍ່ໃສ່ = ບໍ່ຈຳກັດ)</IonLabel>
              <NumInput value={maxToppings ?? 0} onChange={(n) => setMaxToppings(n > 0 ? n : undefined)} placeholder="ບໍ່ຈຳກັດ" style={inputBase} />
            </IonItem>
          </div>
        )}

        {errors.save && (
          <IonText color="danger">
            <p style={{ paddingTop: 12, fontSize: "0.82rem" }}>{errors.save}</p>
          </IonText>
        )}
        <div style={{ height: 24 }} />
      </IonContent>
    </IonModal>

    <IonAlert isOpen={!!catError} header="ຂໍ້ຜິດພາດ" message={catError ?? ""} buttons={["ຕົກລົງ"]} onDidDismiss={() => setCatError(null)} />

    <IonAlert
      isOpen={newCatAlertOpen}
      header="ສ້າງໝວດໝູ່ໃໝ່"
      inputs={[{ name: "name", type: "text", placeholder: "ເຊັ່ນ: ອາຫານ, ເຄື່ອງດື່ມ, ຂອງຫວານ..." }]}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setNewCatAlertOpen(false) },
        { text: "ສ້າງ", handler: (data) => { if (data.name?.trim()) handleCreateCategory(data.name); setNewCatAlertOpen(false); } },
      ]}
      onDidDismiss={() => setNewCatAlertOpen(false)}
    />

    <IonAlert
      isOpen={!!editCatTarget}
      header="ແກ້ໄຂໝວດໝູ່"
      inputs={[{ type: "text", value: editCatTarget?.name, placeholder: "ຊື່ໝວດ" }]}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditCatTarget(null) },
        { text: "ບັນທຶກ", handler: (data) => handleEditCategory(data) },
      ]}
      onDidDismiss={() => setEditCatTarget(null)}
    />

    <IonAlert
      isOpen={!!deleteCatTarget}
      header="ລຶບໝວດໝູ່"
      message={`ລຶບ "${deleteCatTarget?.name}" ແມ່ນບໍ? ເມນູໃນໝວດນີ້ຈະບໍ່ມີໝວດ`}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteCatTarget(null) },
        { text: "ລຶບ", role: "destructive", handler: handleDeleteCategory },
      ]}
      onDidDismiss={() => setDeleteCatTarget(null)}
    />

    <IonAlert
      isOpen={deleteVariantIdx !== null}
      header="ລຶບ Variant"
      message={(() => {
        const v = variants[deleteVariantIdx ?? -1];
        const label = v && v.size.trim() ? v.size : `ລາຍການທີ ${(deleteVariantIdx ?? 0) + 1}`;
        return `ຕ້ອງການລຶບ "${label}" ແມ່ນບໍ່?`;
      })()}
      buttons={[
        { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteVariantIdx(null) },
        {
          text: "ລຶບ",
          role: "destructive",
          handler: () => {
            if (deleteVariantIdx !== null) removeVariant(deleteVariantIdx);
            setDeleteVariantIdx(null);
          },
        },
      ]}
      onDidDismiss={() => setDeleteVariantIdx(null)}
    />

    {/* Category picker sheet */}
    <IonModal
      isOpen={catPickerOpen}
      onDidDismiss={() => { setCatPickerOpen(false); setManageCatMode(false); }}
      initialBreakpoint={0.6}
      breakpoints={[0, 0.6, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>ເລືອກໝວດໝູ່</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setCatPickerOpen(false)}>ປິດ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {shopId && (
          <IonItem detail={false} style={{ "--background": "#fff8f5", "--inner-padding-end": "8px" }}>
            <IonButton fill="clear" size="small"
              onClick={() => { setCatPickerOpen(false); setNewCatAlertOpen(true); }}
              style={{ fontWeight: 700, fontSize: "0.88rem", "--padding-start": "4px", "--padding-end": "8px" }}
            >
              <IonIcon slot="start" icon={addOutline} />
              ສ້າງໝວດໝູ່ໃໝ່
            </IonButton>
            {localCats.length > 0 && (
              <IonButton
                fill={manageCatMode ? "solid" : "clear"}
                size="small"
                color={manageCatMode ? "warning" : "medium"}
                slot="end"
                onClick={() => setManageCatMode((m) => !m)}
                style={{ fontWeight: 600, fontSize: "0.82rem", "--padding-start": "8px", "--padding-end": "8px" }}
              >
                <IonIcon slot="start" icon={createOutline} />
                {manageCatMode ? "ບັນທຶກ" : "ຈັດການ"}
              </IonButton>
            )}
          </IonItem>
        )}
        {!manageCatMode && (
          <IonItem button detail={false} onClick={() => { setCategory(""); setCatPickerOpen(false); }}>
            <IonLabel style={{ color: "var(--app-text-secondary)" }}>— ບໍ່ລະບຸ —</IonLabel>
            {category === "" && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
          </IonItem>
        )}
        {localCats.map((cat) => (
          <IonItem
            key={cat.id}
            button={!manageCatMode}
            detail={false}
            onClick={() => { if (!manageCatMode) { setCategory(cat.name); setCatPickerOpen(false); } }}
            style={{ "--background": "var(--app-surface)" }}
          >
            <IonLabel style={{ fontWeight: category === cat.name ? 700 : 400 }}>{cat.name}</IonLabel>
            {!manageCatMode && category === cat.name && <IonIcon slot="end" icon={checkmarkOutline} color="primary" />}
            {manageCatMode && (
              <>
                <IonButton fill="clear" size="small" slot="end"
                  onClick={(e) => { e.stopPropagation(); setEditCatTarget(cat); }}
                  style={{ minHeight: 40, minWidth: 40 }}>
                  <IonIcon slot="icon-only" icon={createOutline} style={{ fontSize: 17 }} />
                </IonButton>
                {isOwner && (
                  <IonButton fill="clear" size="small" color="danger" slot="end"
                    onClick={(e) => { e.stopPropagation(); setDeleteCatTarget(cat); }}
                    style={{ minHeight: 40, minWidth: 40 }}>
                    <IonIcon slot="icon-only" icon={trashOutline} style={{ fontSize: 17 }} />
                  </IonButton>
                )}
              </>
            )}
          </IonItem>
        ))}
      </IonContent>
    </IonModal>

    <UnitPickerSheet
      isOpen={unitPickerOpen}
      shopId={shopId}
      units={shopUnits}
      value={unit}
      onPick={setUnit}
      onUnitsChanged={setShopUnits}
      onDismiss={() => setUnitPickerOpen(false)}
    />

    <ToppingPickerSheet
      isOpen={toppingPickerOpen}
      shopId={shopId}
      toppings={shopToppings}
      selectedNames={toppingNames}
      onToggleSelect={toggleTopping}
      onToppingsChanged={setShopToppings}
      onDismiss={() => setToppingPickerOpen(false)}
    />

    <SizePickerSheet
      isOpen={sizePickerRowIndex !== null}
      shopId={shopId}
      sizes={shopSizes}
      value={sizePickerRowIndex !== null ? variants[sizePickerRowIndex]?.size ?? "" : ""}
      onPick={(size) => { if (sizePickerRowIndex !== null) handleVariantFieldChange(sizePickerRowIndex, "size", size); }}
      onSizesChanged={setShopSizes}
      onDismiss={() => setSizePickerRowIndex(null)}
    />

    <FlavorPickerSheet
      isOpen={flavorPickerOpen}
      shopId={shopId}
      flavors={shopFlavors}
      selectedNames={flavors}
      onToggleSelect={toggleFlavor}
      onFlavorsChanged={setShopFlavors}
      onDismiss={() => setFlavorPickerOpen(false)}
    />

    <IonModal isOpen={colorPickerOpen} onDidDismiss={() => setColorPickerOpen(false)} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle style={{ fontSize: "1rem" }}>ເລືອກສີ</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setColorPickerOpen(false)}>ຕົກລົງ</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <ColorPicker value={color} onChange={setColor} savedColors={savedColors} />
      </IonContent>
    </IonModal>
    </>
  );
};

export default ProductForm;
