export interface ShopFeatures {
  returnEnabled: boolean;
  returnSummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
  ledgerEnabled: boolean;
}

export interface ReturnRecord {
  id: string;
  productId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  paymentType?: "cash" | "transfer";
  createdAt: Date;
}

export interface ProductVariant {
  size: string;
  color: string;
  stock: number;
  minStock?: number;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  price: number;
  costPrice?: number;
  photoUrl?: string;
  variants: ProductVariant[];
  canBeGift?: boolean;
  // Absent/true = goes through the kitchen (Kitchen.tsx); explicitly false =
  // skips straight to "ready" (Expedite.tsx) — e.g. drinks that need no cooking.
  needsKitchen?: boolean;
}

export interface BundleItem {
  productId: string;
  productName: string;
  quantity: number;
  costPrice?: number;
  variantSize?: string;
  variantColor?: string;
}

export interface Bundle {
  id: string;
  name: string;
  price: number;
  items: BundleItem[];
  photoUrl?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  variant: ProductVariant;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  costPrice?: number;
  isBundle?: boolean;
  bundleItems?: BundleItem[];
  isGift?: boolean;
  giftForKey?: string;
  splitId?: string;
  // Denormalized from Product.needsKitchen at cart-add time (same pattern as
  // costPrice) so createOrder can split a cart into kitchen/direct tickets
  // without an extra product lookup.
  needsKitchen?: boolean;
}

export interface TableSession {
  id: string;
  code: string;
  tableLabel: string;
  status: "open" | "closed";
  createdAt: Date;
  closedAt?: Date;
}

export interface Category {
  id: string;
  name: string;
  // Which food group (shop-level foodGroups list, e.g. "ກຸ່ມເຄື່ອງດື່ມ") this
  // category belongs to, if any — one level above category.
  foodGroup?: string;
  // A single emoji shown next to the category name (see IconPicker.tsx) —
  // freely chosen, not restricted to any fixed set.
  icon?: string;
}

export interface Customer {
  // Same as `phone` — the customer's 8-digit phone number IS their member
  // code, so it's used as the Firestore document id too (guarantees it can
  // never collide with another customer's).
  id: string;
  phone: string;
  name: string;
  address?: string;
  enabled: boolean;
}

export interface ShopProfile {
  id: string;
  name: string;
  profileUrl?: string;
}

export interface StaffPermissions {
  canManageProducts: boolean;
  canEditCartPrice: boolean;
  canDeleteSales: boolean;
  canAddExpenses: boolean;
  canViewFinance: boolean;
  canTakeOrders: boolean;
  canCook: boolean;
  canExpedite: boolean;
}

// Named job role a staff account can be assigned (see PermCheckboxList.tsx's
// STAFF_ROLE_LABELS/STAFF_ROLE_PRESETS) — a convenience preset for the
// granular StaffPermissions checkboxes, not a replacement for them; picking
// one pre-fills the checkboxes, which stay individually editable after.
export type StaffRole = "shopAdmin" | "sales" | "server" | "warehouse" | "accounting";

export interface ShopUser {
  id: string;
  email: string;
  role: "customer" | "staff";
  displayName?: string;
  profileUrl?: string;
  createdAt?: Date;
  permissions?: StaffPermissions;
  staffRole?: StaffRole;
  // If true, this staff member may only take orders in `allowedZones`
  // (matches TableRosterEntry.zone / getTableZones) instead of every zone.
  zoneRestricted?: boolean;
  allowedZones?: string[];
}

export type PaymentType = "cash" | "qr";

// Was a fixed 3-value union; widened to allow custom categories (see
// src/data/expenseCategoryRepository.ts). "shop"/"capital"/"general" are
// still the three built-in defaults and remain valid values.
export type ExpenseCategory = string;

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  paymentType?: "cash" | "transfer";
  createdAt: Date;
  createdByUid?: string;
  createdByName?: string;
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  paymentType: "cash" | "transfer";
  createdAt: Date;
}

// "pending"/"cooking"/"ready"/"served" are dine-in orders working their way
// through the kitchen before payment; "paid" is the terminal state for both
// dine-in (closed bill) and the instant-checkout flow (set at creation).
// "cancelled" is a terminal state reached from ANY of the above (an unpaid
// ticket voided before payment, or an already-paid bill voided after) — see
// cancelSale() in saleRepository.ts. Unlike the old deleteSale() hard-delete,
// a cancelled sale keeps its doc (with cancelReason/cancelledAt/By) so it
// shows up in ปะหวัดการยกเลิกบิล instead of vanishing without a trace.
export type OrderStatus = "pending" | "cooking" | "ready" | "served" | "paid" | "cancelled";

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentType: PaymentType | null;
  status: OrderStatus;
  tableLabel?: string;
  tableSessionId?: string;
  createdAt: Date;
  servedAt?: Date;
  paidAt?: Date;
  sellerUid?: string;
  sellerName?: string;
  cancelReason?: string;
  cancelledAt?: Date;
  cancelledByUid?: string;
  cancelledByName?: string;
}
