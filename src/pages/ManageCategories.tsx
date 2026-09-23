import { useCallback, useEffect, useState } from "react";
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
  IonMenuButton,
  IonAlert,
  IonActionSheet,
  IonSearchbar,
  IonModal,
  IonInput,
  useIonViewWillEnter,
} from "@ionic/react";
import { trashOutline, addOutline, createOutline, chevronBackOutline, filterOutline, pricetagOutline } from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { getCategories, updateCategory, deleteCategory, isCategoryInUse, renameCategoryInProducts, setCategoryFoodGroup, setCategoryIcon } from "../data/categoryRepository";
import { getFoodGroups } from "../data/shopRepository";
import type { Category } from "../data/types";
import EmptyState from "../components/EmptyState";
import IconPicker from "../components/IconPicker";
import CategoryIconGlyph from "../components/CategoryIconGlyph";

// Category CREATION lives on its own page (CreateCategory.tsx, reached via
// the "+" button below) and supports adding several categories in one save
// — this page is just the list. Categories already existed as a feature
// (picked/created inline from ProductForm.tsx's "ໝວດໝູ່" picker) — this page
// is a dedicated home for the same underlying `shops/{shopId}/categories`
// data, with rename + delete (delete is blocked while any product still
// uses that category, same rule ProductForm.tsx already enforces).
const ManageCategories: React.FC = () => {
  const { shopId, role } = useAuth();
  // Deleting a category is owner-only (see firestore.rules) — same
  // restriction ProductForm.tsx's inline picker already enforces.
  const isOwner = role === "customer";
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [foodGroups, setFoodGroupsState] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [groupTarget, setGroupTarget] = useState<Category | null>(null);
  const [iconTarget, setIconTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"az" | "za">("az");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [cats, groups] = await Promise.all([getCategories(shopId), getFoodGroups(shopId)]);
      setCategories(cats);
      setFoodGroupsState(groups);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useIonViewWillEnter(() => { load(); }, [load]);
  useEffect(() => { load(); }, [load]);

  // getCategories() already returns them ordered by name (A→Z) — "za" is
  // just that reversed, no separate creation-order data to sort by.
  const processed: Category[] = (() => {
    let list = categories;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (sortOrder === "za") list = [...list].reverse();
    if (pageSize !== "all") list = list.slice(0, pageSize);
    return list;
  })();

  async function confirmDelete() {
    if (!shopId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const inUse = await isCategoryInUse(shopId, deleteTarget.name);
      if (inUse) {
        setError(`ບໍ່ສາມາດລຶບ "${deleteTarget.name}" ເພາະມີເມນູທີ່ໃຊ້ໝວດນີ້ຢູ່`);
        setDeleteTarget(null);
        return;
      }
      await deleteCategory(shopId, deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("ລຶບບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRename(newName: string) {
    if (!shopId || !editTarget) return false;
    const trimmed = newName.trim();
    if (!trimmed) return false;
    if (trimmed === editTarget.name) return true;
    if (categories.some((c) => c.id !== editTarget.id && c.name === trimmed)) {
      setEditError(`ໝວດໝູ່ "${trimmed}" ມີຢູ່ແລ້ວ`);
      return false;
    }
    setSaving(true);
    try {
      await updateCategory(shopId, editTarget.id, trimmed);
      await renameCategoryInProducts(shopId, editTarget.name, trimmed);
      setCategories((prev) => prev.map((c) => (c.id === editTarget.id ? { ...c, name: trimmed } : c)));
      return true;
    } catch {
      setEditError("ແກ້ໄຂບໍ່ສຳເລັດ, ລອງໃໝ່");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function assignFoodGroup(foodGroup: string | undefined) {
    if (!shopId || !groupTarget) return;
    const target = groupTarget;
    setGroupTarget(null);
    try {
      await setCategoryFoodGroup(shopId, target.id, foodGroup);
      setCategories((prev) => prev.map((c) => (c.id === target.id ? { ...c, foodGroup } : c)));
    } catch {
      setError("ບໍ່ສາມາດກຳນົດກຸ່ມອາຫານໄດ້, ລອງໃໝ່");
    }
  }

  async function assignIcon(icon: string) {
    if (!shopId || !iconTarget) return;
    const target = iconTarget;
    const nextIcon = icon || undefined;
    setIconTarget(null);
    try {
      await setCategoryIcon(shopId, target.id, nextIcon);
      setCategories((prev) => prev.map((c) => (c.id === target.id ? { ...c, icon: nextIcon } : c)));
    } catch {
      setError("ບໍ່ສາມາດກຳນົດ icon ໄດ້, ລອງໃໝ່");
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} />
            <IonButton routerLink="/tabs/products" routerDirection="back">
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>ຈັດການໝວດໝູ່</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/tabs/create-category">
              <IonIcon slot="icon-only" icon={addOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        )}
        {!loading && (
          <div style={{ padding: "12px 16px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--app-text-secondary)" }}>
                ສະແດງ {processed.length} ຈາກ {categories.length} ໝວດໝູ່
              </p>
              <IonButton routerLink="/tabs/create-category" size="small" style={{ "--border-radius": "10px", margin: 0 }}>
                <IonIcon slot="start" icon={addOutline} />
                ສ້າງໝວດໝູ່
              </IonButton>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <IonSearchbar
                value={search}
                onIonInput={(e) => setSearch(e.detail.value ?? "")}
                placeholder="ຄົ້ນຫາໝວດໝູ່"
                style={{ padding: 0, flex: 1 }}
              />
              <IonButton
                fill={pageSize !== "all" || sortOrder !== "az" ? "solid" : "outline"}
                onClick={() => setFilterOpen(true)}
                style={{ margin: 0, height: 44, flexShrink: 0, "--border-radius": "10px" }}
              >
                <IonIcon slot="icon-only" icon={filterOutline} />
              </IonButton>
            </div>

            <IonModal
              isOpen={filterOpen}
              onDidDismiss={() => setFilterOpen(false)}
              initialBreakpoint={0.85}
              breakpoints={[0, 0.5, 0.85]}
            >
              <IonHeader>
                <IonToolbar>
                  <IonTitle style={{ fontSize: "1rem" }}>ຕົວກອງ</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setFilterOpen(false)}>ປິດ</IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent>
                <div style={{ padding: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                    1. ຈຳນວນລາຍການທີ່ຢາກໃຫ້ສະແດງ
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {([10, 20, 50, "all"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setPageSize(v)}
                        style={{
                          padding: "7px 14px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${pageSize === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          background: pageSize === v ? "var(--ion-color-primary)" : "transparent",
                          color: pageSize === v ? "#fff" : "var(--app-text-secondary)",
                        }}
                      >
                        {v === "all" ? "ທັງໝົດ" : `${v}`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)", flexShrink: 0 }}>ຫຼືກຳນົດເອງ:</span>
                    <IonInput
                      type="number" min="1" placeholder="ເຊັ່ນ: 15"
                      value={pageSize === "all" ? "" : pageSize}
                      onIonInput={(e) => {
                        const v = e.detail.value ?? "";
                        if (!v.trim()) return;
                        setPageSize(Math.max(1, parseInt(v, 10) || 1));
                      }}
                      fill="outline" style={{ "--border-radius": "8px", flex: 1 }}
                    />
                  </div>

                  <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "var(--app-text-secondary)" }}>
                    2. ຈັດລຽງ
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(
                      [
                        { v: "az" as const, label: "ກ-ຮ" },
                        { v: "za" as const, label: "ຮ-ກ" },
                      ]
                    ).map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => setSortOrder(v)}
                        style={{
                          flex: 1, padding: "12px 0", borderRadius: 10, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                          border: `1.5px solid ${sortOrder === v ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          background: sortOrder === v ? "var(--app-accent-surface)" : "transparent",
                          color: sortOrder === v ? "var(--ion-color-primary)" : "var(--app-text-secondary)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </IonContent>
            </IonModal>

            {categories.length === 0 && <EmptyState icon="🍽️" title="ຍັງບໍ່ມີໝວດໝູ່" subtitle="ກົດ 'ສ້າງໝວດໝູ່' ເພື່ອເລີ່ມ" />}
            {categories.length > 0 && processed.length === 0 && <EmptyState icon="🔍" title="ບໍ່ພົບໝວດໝູ່ທີ່ຄົ້ນຫາ" />}
            {processed.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--app-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <button
                    onClick={() => setIconTarget(c)}
                    style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 10, cursor: "pointer",
                      border: "1.5px solid var(--app-accent-border)",
                      background: "var(--app-accent-surface)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#c2410c",
                      fontSize: 14,
                    }}
                  >
                    {c.icon ? <CategoryIconGlyph icon={c.icon} size={20} /> : "＋"}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>{c.name}</p>
                    <button
                      onClick={() => setGroupTarget(c)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
                        padding: "2px 9px", borderRadius: 20, border: "none", cursor: "pointer",
                        background: c.foodGroup ? "var(--app-accent-surface)" : "var(--app-surface-alt)",
                        color: c.foodGroup ? "var(--ion-color-primary)" : "var(--app-text-muted)",
                        fontSize: "0.7rem", fontWeight: 700,
                      }}
                    >
                      <IonIcon icon={pricetagOutline} style={{ fontSize: 11 }} />
                      {c.foodGroup ?? "ບໍ່ມີກຸ່ມ"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => { setEditError(null); setEditTarget(c); }}
                    style={{ background: "none", border: "none", color: "var(--ion-color-primary)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <IonIcon icon={createOutline} />
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => setDeleteTarget(c)}
                      style={{ background: "none", border: "none", color: "var(--app-danger)", cursor: "pointer", minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <IonIcon icon={trashOutline} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.82rem", marginTop: 12 }}>{error}</p>}
          </div>
        )}
      </IonContent>

      <IonAlert
        isOpen={!!deleteTarget}
        header="ລຶບໝວດໝູ່"
        message={`ລຶບ "${deleteTarget?.name}" ແມ່ນບໍ່? ເມນູໃນໝວດນີ້ຈະບໍ່ມີໝວດ`}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setDeleteTarget(null) },
          { text: deleting ? "ກຳລັງລຶບ..." : "ລຶບ", role: "destructive", handler: confirmDelete },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <style>{`.manage-cat-alert-error::part(message) { color: #dc2626; font-weight: 600; }`}</style>
      <IonAlert
        isOpen={!!editTarget}
        cssClass={editError ? "manage-cat-alert-error" : undefined}
        header="ແກ້ໄຂໝວດໝູ່"
        message={editError ?? undefined}
        inputs={[{ name: "name", type: "text", value: editTarget?.name, placeholder: "ຊື່ໝວດ" }]}
        buttons={[
          { text: "ຍົກເລີກ", role: "cancel", handler: () => setEditTarget(null) },
          {
            text: saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ",
            handler: async (data: { name?: string }) => {
              const ok = await handleRename(data.name ?? "");
              if (ok) setEditTarget(null);
              return ok;
            },
          },
        ]}
        onDidDismiss={() => { setEditTarget(null); setEditError(null); }}
      />

      <IonActionSheet
        isOpen={!!groupTarget}
        header={`ກຸ່ມອາຫານສຳລັບ "${groupTarget?.name}"`}
        buttons={[
          ...foodGroups.map((g) => ({
            text: g,
            handler: () => { assignFoodGroup(g); },
          })),
          { text: "ບໍ່ມີກຸ່ມ", role: "destructive" as const, handler: () => { assignFoodGroup(undefined); } },
          { text: "ຍົກເລີກ", role: "cancel" as const },
        ]}
        onDidDismiss={() => setGroupTarget(null)}
      />

      <IconPicker
        isOpen={!!iconTarget}
        value={iconTarget?.icon}
        onSelect={assignIcon}
        onDismiss={() => setIconTarget(null)}
      />
    </IonPage>
  );
};

export default ManageCategories;
