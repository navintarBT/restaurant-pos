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
  // Flavor name (from Product.flavors) when Product.hasFlavors is true;
  // otherwise "" — was previously a freeform "option" text field (spice
  // level / no-ice / etc.), see the flavor-auto-migration note on Product.
  color: string;
  stock: number;
  // LEGACY — superseded by Product.reorderPoint (one value per product
  // instead of per variant). No longer written by ProductForm; kept only so
  // old docs still typecheck. Every consumer falls back to
  // `product.reorderPoint ?? variant.minStock ?? 5`.
  minStock?: number;
  // Per-variant sell/cost price. Optional so legacy docs (written before
  // this field existed) still typecheck — every read site falls back to the
  // old product-level Product.price/.costPrice.
  price?: number;
  costPrice?: number;
  // Absent/"active" = sellable; "inactive" = hidden from VariantPicker and
  // excluded from stock alerts.
  status?: "active" | "inactive";
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  // LEGACY — no longer written by ProductForm; kept as the fallback base for
  // ProductVariant.price/.costPrice on old docs (see ProductVariant above).
  price: number;
  costPrice?: number;
  photoUrl?: string;
  // Alternative to photoUrl when no product photo is set — mutually
  // exclusive with it as the "active" visual representation (a hex color).
  color?: string;
  variants: ProductVariant[];
  canBeGift?: boolean;
  // Absent/true = goes through the kitchen (Kitchen.tsx); explicitly false =
  // skips straight to "ready" (Expedite.tsx) — e.g. drinks that need no cooking.
  needsKitchen?: boolean;
  // Product code / SKU, freeform.
  code?: string;
  // Absent/"regular" = a normal menu item; "promotion" = tagged as a promo.
  // "bundle"/set items are never represented here — picking that option in
  // ProductForm redirects into the separate Bundle system (BundleManager.tsx)
  // instead of persisting onto a Product doc.
  productType?: "regular" | "promotion";
  // From the shop's reusable Units list (getUnits/setUnits).
  unit?: string;
  // Low-stock threshold, one value for the whole product (replaces the old
  // per-variant minStock — see ProductVariant.minStock). Default 5 if unset.
  reorderPoint?: number;
  // Absent/true = this product participates in Stock.tsx's low/out-of-stock
  // alerts; explicitly false = excluded regardless of actual stock levels.
  alertEnabled?: boolean;
  // Product-scoped flavor system (distinct from the shop-wide Toppings
  // list). When true, each variant's `color` is picked from `flavors`
  // instead of typed freeform.
  hasFlavors?: boolean;
  flavors?: string[];
  // Absent/true = normal stock deduction on sale (today's behavior).
  // Explicitly false = this product's stock is never validated or deducted
  // at sale time, regardless of the quantity sold or each variant's `stock`
  // number — see saleRepository.ts's stock-transaction functions.
  trackStock?: boolean;
  // Which of the shop's reusable Toppings (getToppings/setToppings, matched
  // by ToppingEntry.name) are offered for this product, and how many of them
  // a customer may pick. maxToppings undefined/0 = unlimited. Selecting
  // toppings at order time is not wired up yet — this only stores the
  // product's configuration.
  hasToppings?: boolean;
  toppingNames?: string[];
  maxToppings?: number;
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

export type PrinterConnectionType = "wifi" | "bluetooth" | "usb";

// What a ticket printed on this printer is used for — a printer can serve
// several roles at once (e.g. one kitchen printer doubling as the report
// printer). "ເລືອກທັງໝົດ" (select all) in PrinterForm.tsx is just a UI
// convenience that toggles every value here on/off — it is not itself
// stored as a role.
export type PrinterRole =
  | "billInvoice"    // ໃບຮຽກເກັບເງິນ
  | "receipt"        // ໃບຮັບເງິນ
  | "qrDelivery"     // QR ສົ່ງອາຫານ
  | "kitchen1"       // ຫ້ອງຄົວ1
  | "kitchen2"       // ຫ້ອງຄົວ2
  | "bar1"           // ບານໍ້າ1
  | "bar2"           // ບານໍ້າ2
  | "reportsCancel"; // ພິມລາຍງານ/ຍົກເລີກອໍເດີ

// A saved connection profile for a receipt/kitchen printer — configuration
// only (name, address, behavior). Does not itself talk to a printer; there
// is no native Bluetooth/USB pairing or ESC/POS printing wired up yet.
export interface Printer {
  id: string;
  name: string;
  connectionType: PrinterConnectionType;
  // Only meaningful for connectionType "wifi".
  ip?: string;
  port?: string;
  // Only meaningful for connectionType "bluetooth" — a MAC address or
  // device name entered by staff, not paired live.
  bluetoothAddress?: string;
  paperSize: string; // e.g. "58mm" / "80mm" / a custom value
  // 1 receipt per cut ("perItem") vs one combined ticket for every item on
  // the order ("combined").
  kitchenTicketMode: "perItem" | "combined";
  shared: boolean;
  cashDrawerOnCheckout: boolean;
  // Blank paper feed (mm) before auto-cut.
  feedBeforeCut: number;
  roles: PrinterRole[];
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
