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
  // LEGACY — freeform "option" text (spice level / no-ice / etc.) from
  // before the dedicated flavor/topping systems existed. No longer written
  // by ProductForm (always ""); flavor does NOT split price/stock per
  // flavor — one shared price/stock per size, see Product.hasFlavors.
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
  // Absent/"regular" = a normal menu item; "promotion" = tagged as a promo;
  // "bundle" = tagged as a set/combo item — a plain classification tag, not
  // a link to the separate Bundle/BundleItem system (BundleManager.tsx),
  // which still exists independently for multi-item combos.
  productType?: "regular" | "bundle" | "promotion";
  // From the shop's reusable Units list (getUnits/setUnits).
  unit?: string;
  // Low-stock threshold, one value for the whole product (replaces the old
  // per-variant minStock — see ProductVariant.minStock). Default 5 if unset.
  reorderPoint?: number;
  // Absent/true = this product participates in Stock.tsx's low/out-of-stock
  // alerts; explicitly false = excluded regardless of actual stock levels.
  alertEnabled?: boolean;
  // Product-scoped flavor system (distinct from the shop-wide Toppings
  // list) — a capped multi-select the customer picks from `flavors` at
  // order time; one shared price/stock per size regardless of which (or how
  // many) flavors are picked — flavor never splits the variant grid.
  // maxFlavors undefined/0 defaults to 1 (pick exactly one) when read.
  // Selecting flavors at order time is not wired up yet — this only stores
  // the product's configuration (mirrors hasToppings/toppingNames below).
  hasFlavors?: boolean;
  flavors?: string[];
  maxFlavors?: number;
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
  // Picked in VariantPicker.tsx when Product.hasFlavors/hasToppings is on —
  // applies uniformly to this whole line (flavor/topping never split
  // price/stock, see Product.hasFlavors); topping price add-ons are already
  // folded into `unitPrice`. Two lines of the same variant with different
  // picks stay separate cart lines (see each page's itemKey).
  selectedFlavors?: string[];
  selectedToppings?: string[];
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

// ຕິດໜີ້ (credit/tab) balance for one customer — positive = they owe the
// shop this much. One doc per customer; balance is only ever changed via
// chargeCredit/recordCreditPayment (creditRepository.ts), never written
// directly, so it always matches the sum of that customer's CreditTransactions.
export interface CustomerCredit {
  id: string; // == customerId
  customerId: string;
  customerName: string;
  balance: number;
  updatedAt: Date;
}

// One ledger entry for a CustomerCredit — "charge" adds to the balance (a
// credit sale), "payment" reduces it (the customer paying down their tab).
export interface CreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "charge" | "payment";
  amount: number;
  saleId?: string; // set when type === "charge"
  billNumber?: string;
  note?: string;
  createdAt: Date;
  createdByUid?: string;
  createdByName?: string;
}

// ຝາກ (bottle-keeping): how much of one product a customer currently has in
// storage at the shop. One doc per (customerId, productId) pair; quantity is
// only ever changed via depositProduct/withdrawProduct (depositRepository.ts),
// so it always matches the sum of that pair's DepositTransactions.
export interface ProductDeposit {
  id: string; // `${customerId}_${productId}`
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  updatedAt: Date;
}

// One ledger entry for a ProductDeposit — "deposit" adds to the quantity,
// "withdraw" reduces it (the customer taking some of it back).
export interface DepositTransaction {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  type: "deposit" | "withdraw";
  quantity: number;
  note?: string;
  createdAt: Date;
  createdByUid?: string;
  createdByName?: string;
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

// "qr" is the internal value for transfer payments (labeled ໂອນ everywhere)
// — kept as-is rather than renamed, to avoid touching every existing
// paymentType === "qr" comparison across reports/history for no real gain.
// "split" = part cash + part transfer (Sale.paymentCash/.paymentTransfer);
// "credit" = charged (in full or in part) to the customer's tab
// (Sale.paymentCredit + customerId — see CustomerCredit/CreditTransaction).
export type PaymentType = "cash" | "qr" | "split" | "credit";

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
  // Every payment is describable as a breakdown that sums to `total`,
  // regardless of paymentType — keeps reporting uniform across all 4 modes
  // (e.g. cashTotal = Σ paymentCash) instead of branching on paymentType.
  paymentCash?: number;
  paymentTransfer?: number;
  paymentCredit?: number; // portion charged to customerId's tab
  customerId?: string;    // set when paymentCredit > 0
  customerName?: string;
  billNumber?: string;    // "DDMMYY-NNNN", assigned atomically in closeBill
  // Set only on a doc born by splitting off part of an existing order's
  // items during item-level bill-splitting (ແຍກຈ່າຍ) — see closeBill.
  splitFromSaleId?: string;
}

// Addressing for closeBill: which doc(s)/items a single payment event
// covers. Omitting itemIndexes means "the whole doc" (today's original
// behavior); a subset means "shrink the original doc to its remainder and
// spin off a new paid doc for just these items" — see closeBill.
export interface BillTarget {
  saleId: string;
  itemIndexes?: number[];
}
