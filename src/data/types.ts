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
  paymentType?: "cash" | "transfer" | "cod";
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

export interface ShopUser {
  id: string;
  email: string;
  role: "customer" | "staff";
  displayName?: string;
  profileUrl?: string;
  createdAt?: Date;
  permissions?: StaffPermissions;
}

export type PaymentType = "cash" | "qr" | "cod";

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
  paymentType: "cash" | "transfer" | "cod";
  createdAt: Date;
}

// "pending"/"cooking"/"ready"/"served" are dine-in orders working their way
// through the kitchen before payment; "paid" is the terminal state for both
// dine-in (closed bill) and the instant-checkout flow (set at creation).
export type OrderStatus = "pending" | "cooking" | "ready" | "served" | "paid";

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
}
