import type { StaffPermissions, StaffRole } from "../data/types";

// Shared between StaffSettings.tsx (read-only badge preview in the user
// list) and UserPermissions.tsx (the dedicated editor page) so the two never
// drift out of sync.
export const PERM_LABELS: { key: keyof StaffPermissions; label: string; icon: string }[] = [
  { key: "canManageProducts", label: "ຈັດການເມນູ (ເພີ່ມ / ແກ້ໄຂ) — ລຶບເມນູ/ຊຸດ ເຈົ້າຂອງຮ້ານເທົ່ານັ້ນ", icon: "📦" },
  { key: "canEditCartPrice", label: "ແກ້ໄຂລາຄາໃນກະຕ່າ", icon: "✏️" },
  { key: "canDeleteSales", label: "ລຶບປະຫວັດການຂາຍ", icon: "🗑️" },
  { key: "canAddExpenses", label: "ຈັດການລາຍຈ່າຍ & ລາຍຮັບ (ເພີ່ມ / ແກ້ໄຂ / ລຶບ)", icon: "💸" },
  { key: "canViewFinance", label: "ເບິ່ງຂໍ້ມູນການເງິນ (ຕົ້ນທຶນ, ກຳໄລ, ກະເປົາເງິນ)", icon: "💰" },
  { key: "canTakeOrders", label: "ຮັບອໍເດີ້ ແລະ ປິດບິນ (ພະນັກງານເສີບ)", icon: "🧾" },
  { key: "canCook", label: "ຫ້ອງຄົວ — ເບິ່ງ/ເຮັດອໍເດີ້", icon: "👨‍🍳" },
  { key: "canExpedite", label: "ຈັດອໍເດີ້ໃຫ້ພະນັກງານເສີບ", icon: "🍽️" },
];

export const DEFAULT_PERMS: StaffPermissions = {
  canManageProducts: false,
  canEditCartPrice: false,
  canDeleteSales: false,
  canAddExpenses: false,
  canViewFinance: false,
  canTakeOrders: false,
  canCook: false,
  canExpedite: false,
};

// Owner/Admin ("ແອດມິນ(ເຈົ້າຂອງ)") isn't in here — that's ShopUser.role ===
// "customer", the shop's actual owner account, not something assigned from
// this list.
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  shopAdmin: "ແອດມິນຮ້ານ",
  sales: "ພະນັກງານຂາຍ",
  server: "ພະນັກງານເສີບ",
  warehouse: "ພະນັກງານສາງ",
  accounting: "ພະນັກງານບັນຊີ",
};

// Best-guess starting point per role, based on each permission's own label
// above — picking a role pre-fills these into the checkboxes below, which
// stay fully editable afterward, so a wrong guess here is a one-tap fix,
// not a hard rule.
export const STAFF_ROLE_PRESETS: Record<StaffRole, StaffPermissions> = {
  shopAdmin: {
    canManageProducts: true, canEditCartPrice: true, canDeleteSales: true, canAddExpenses: true,
    canViewFinance: true, canTakeOrders: true, canCook: true, canExpedite: true,
  },
  sales: {
    canManageProducts: false, canEditCartPrice: false, canDeleteSales: false, canAddExpenses: false,
    canViewFinance: false, canTakeOrders: true, canCook: false, canExpedite: false,
  },
  server: {
    canManageProducts: false, canEditCartPrice: false, canDeleteSales: false, canAddExpenses: false,
    canViewFinance: false, canTakeOrders: true, canCook: false, canExpedite: true,
  },
  warehouse: {
    canManageProducts: true, canEditCartPrice: false, canDeleteSales: false, canAddExpenses: false,
    canViewFinance: false, canTakeOrders: false, canCook: false, canExpedite: false,
  },
  accounting: {
    canManageProducts: false, canEditCartPrice: false, canDeleteSales: true, canAddExpenses: true,
    canViewFinance: true, canTakeOrders: false, canCook: false, canExpedite: false,
  },
};

export default function PermCheckboxList({
  perms,
  onChange,
}: {
  perms: StaffPermissions;
  onChange: (perms: StaffPermissions) => void;
}) {
  return (
    <div>
      {PERM_LABELS.map(({ key, label, icon }) => (
        <label
          key={key}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={perms[key]}
            onChange={(e) => onChange({ ...perms, [key]: e.target.checked })}
            style={{ width: 17, height: 17, accentColor: "#0f766e", cursor: "pointer", flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
            {icon} {label}
          </span>
        </label>
      ))}
    </div>
  );
}
