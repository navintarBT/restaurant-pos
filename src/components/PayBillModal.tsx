import { useEffect, useState } from "react";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFooter, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonInput,
} from "@ionic/react";
import { closeOutline, backspaceOutline, printOutline, cardOutline } from "ionicons/icons";
import { closeBill } from "../data/saleRepository";
import { getExchangeRates, getVatPercent, CURRENCY_LABELS, CURRENCY_FLAGS, ALL_CURRENCIES, type CurrencyCode, type ExchangeRate } from "../data/shopRepository";
import { peekNextBillNumber } from "../data/saleRepository";
import { fmtK } from "../utils/format";
import CustomerPicker from "./CustomerPicker";
import type { BillTarget, Customer, PaymentType, SaleItem } from "../data/types";

interface Props {
  isOpen: boolean;
  shopId?: string;
  tableLabel: string;
  targets: BillTarget[]; // what closeBill() will act on
  items: SaleItem[]; // flattened line items being paid for now (whole table or just the ແຍກຈ່າຍ selection) — for the itemized receipt view
  subtotal: number;
  serviceChargePercent: number;
  onDismiss: () => void;
  onSuccess: (billNumber: string) => void;
}

type Mode = "cash" | "qr" | "split" | "credit";

function itemLabel(item: SaleItem): string {
  const v = [item.variant.size, item.variant.color].filter((s) => s && s !== "__bundle__").join("/");
  return v ? `${item.productName} (${v})` : item.productName;
}

// Exact total, then the next couple of round 50.000-kip steps above it —
// e.g. total 2.750.000 -> [2.750.000, 2.800.000, 2.850.000].
function quickAmounts(total: number): number[] {
  const step = 50000;
  const roundedUp = Math.ceil(total / step) * step;
  const b = roundedUp > total ? roundedUp : total + step;
  return [...new Set([total, b, b + step])];
}

const PayBillModal: React.FC<Props> = ({
  isOpen, shopId, tableLabel, targets, items, subtotal, serviceChargePercent, onDismiss, onSuccess,
}) => {
  const [mode, setMode] = useState<Mode>("cash");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("LAK");
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [previewBillNumber, setPreviewBillNumber] = useState("...");
  // VAT is a shop-wide setting (no per-table opt-out like service charge),
  // so this modal fetches it itself rather than the caller computing it.
  const [vatPercent, setVatPercent] = useState(0);

  // ສ່ວນຫຼຸດທ້າຍບິນ — discount comes off the subtotal FIRST, then the service
  // charge is computed on what's left, so a discounted bill's service charge
  // is correctly smaller too.
  const [discountMode, setDiscountMode] = useState<"amount" | "percent" | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const discountAmount = (() => {
    if (!discountMode) return 0;
    const n = parseFloat(discountInput || "0");
    if (!Number.isFinite(n) || n <= 0) return 0;
    const raw = discountMode === "percent" ? Math.round((subtotal * n) / 100) : Math.round(n);
    return Math.min(raw, subtotal);
  })();
  const discountedSubtotal = subtotal - discountAmount;
  const serviceChargeAmount = serviceChargePercent > 0 ? Math.round(discountedSubtotal * serviceChargePercent / 100) : 0;
  const vatAmount = vatPercent > 0 ? Math.round((discountedSubtotal + serviceChargeAmount) * vatPercent / 100) : 0;
  const total = discountedSubtotal + serviceChargeAmount + vatAmount;

  // Keypad buffers — plain digit strings, parsed to numbers on read.
  const [cashBuf, setCashBuf] = useState("");
  const [splitCashBuf, setSplitCashBuf] = useState("");
  const [splitTransferBuf, setSplitTransferBuf] = useState("");
  const [creditPaidBuf, setCreditPaidBuf] = useState("");
  // Which field the on-screen keypad is currently typing into — only cash
  // mode's tendered amount gets currency conversion (matches the reference
  // screenshot, which only shows one keypad, under the cash flow); split's
  // transfer amount and credit's "paid now" amount are assumed to already be
  // in LAK, same as everywhere else in the app.
  const [activeField, setActiveField] = useState<"cash" | "splitCash" | "splitTransfer" | "creditPaid">("cash");

  // Keep the keypad routed to a sensible field the instant the mode changes
  // — otherwise switching straight to ສົດ+ໂອນ without first tapping either
  // amount box would leave `activeField` on a field that mode doesn't even
  // show, and keypad taps would silently go nowhere visible.
  useEffect(() => {
    if (mode === "split") setActiveField("splitCash");
    else if (mode === "credit") setActiveField("creditPaid");
    else if (mode === "cash") setActiveField("cash");
  }, [mode]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBillNumber, setResultBillNumber] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode("cash");
      setCustomer(null);
      setCurrency("LAK");
      setCashBuf(""); setSplitCashBuf(""); setSplitTransferBuf(""); setCreditPaidBuf("");
      setActiveField("cash");
      setDiscountMode(null);
      setDiscountInput("");
      setError(null);
      setResultBillNumber(null);
      if (shopId) {
        getExchangeRates(shopId).then((r) => setRates(r.filter((x) => x.enabled))).catch(() => {});
        peekNextBillNumber(shopId).then(setPreviewBillNumber).catch(() => {});
        getVatPercent(shopId).then(setVatPercent).catch(() => {});
      }
    }
  }, [isOpen, shopId]);

  const rate = rates.find((r) => r.currency === currency)?.rate ?? 1;
  const cashEntered = parseInt(cashBuf || "0", 10);
  const cashInLak = currency === "LAK" ? cashEntered : Math.round(cashEntered * rate);
  const splitCash = parseInt(splitCashBuf || "0", 10);
  const splitTransfer = parseInt(splitTransferBuf || "0", 10);
  const creditPaidNow = Math.min(parseInt(creditPaidBuf || "0", 10), total);
  const creditPortion = total - creditPaidNow;
  const change = mode === "cash" ? Math.max(0, cashInLak - total) : 0;

  const canConfirm = (() => {
    if (mode === "cash") return cashInLak >= total;
    if (mode === "qr") return true;
    if (mode === "split") return splitCash + splitTransfer === total && total > 0;
    return !!customer; // credit
  })();

  // Every digit/backspace/clear op takes an explicit `field` argument rather
  // than reading `activeField` state — that state is set by a separate,
  // earlier click (focusing a field in ສົດ+ໂອນ mode) and is only ever used
  // for routing+highlighting there; a handler must never set activeField and
  // read it back in the same call, since the state update wouldn't have
  // committed yet (this bit us during initial dev — keeping the note).
  type Field = "cash" | "splitCash" | "splitTransfer" | "creditPaid";
  function bufFor(field: Field): string {
    if (field === "cash") return cashBuf;
    if (field === "splitCash") return splitCashBuf;
    if (field === "splitTransfer") return splitTransferBuf;
    return creditPaidBuf;
  }
  function setBufFor(field: Field, next: string) {
    if (field === "cash") setCashBuf(next);
    else if (field === "splitCash") setSplitCashBuf(next);
    else if (field === "splitTransfer") setSplitTransferBuf(next);
    else setCreditPaidBuf(next);
  }
  function tapDigit(field: Field, d: string) {
    const cur = bufFor(field);
    if (cur.length >= 12) return; // sane ceiling, not a real limit anyone will hit
    setBufFor(field, cur === "0" ? d : cur + d);
  }
  function tapBackspace(field: Field) {
    setBufFor(field, bufFor(field).slice(0, -1));
  }
  function tapClear(field: Field) {
    setBufFor(field, "");
  }

  async function handleConfirm() {
    if (!shopId || busy || !canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      let payment: { cash?: number; transfer?: number; credit?: number };
      let paymentType: PaymentType;
      if (mode === "cash") {
        payment = { cash: total };
        paymentType = "cash";
      } else if (mode === "qr") {
        payment = { transfer: total };
        paymentType = "qr";
      } else if (mode === "split") {
        payment = { cash: splitCash, transfer: splitTransfer };
        paymentType = "split";
      } else {
        payment = { ...(creditPaidNow > 0 ? { cash: creditPaidNow } : {}), credit: creditPortion };
        paymentType = "credit";
      }

      const { billNumber } = await closeBill(
        shopId,
        targets,
        paymentType,
        payment,
        customer ? { id: customer.id, name: customer.name } : undefined,
        serviceChargePercent > 0 ? serviceChargePercent : undefined,
        discountAmount > 0 ? discountAmount : undefined,
        vatPercent > 0 ? vatPercent : undefined
      );
      setResultBillNumber(billNumber);
    } catch {
      setError("ຊຳລະບິນບໍ່ສຳເລັດ, ລອງໃໝ່");
    } finally {
      setBusy(false);
    }
  }

  const modeTabs: { v: Mode; label: string }[] = [
    { v: "cash", label: "ເງິນສົດ" },
    { v: "qr", label: "ໂອນ" },
    { v: "split", label: "ສົດ+ໂອນ" },
    { v: "credit", label: "ຕິດໜີ້" },
  ];

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} canDismiss={async () => !busy}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        }
      `}</style>
      <IonHeader className="ion-no-print">
        <IonToolbar>
          <IonButtons slot="start">
            <IonIcon icon={cardOutline} style={{ marginLeft: 12, fontSize: 20 }} />
          </IonButtons>
          <IonTitle style={{ fontSize: "1rem" }}>
            ຊຳລະບິນ
            <div style={{ fontSize: "0.7rem", fontWeight: 400, color: "var(--app-text-secondary)" }}>
              ໂຕະ: {tableLabel} - ເລກບິນ: {resultBillNumber ?? previewBillNumber}
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss} disabled={busy}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {resultBillNumber ? (
        <>
          <IonContent className="ion-padding">
            <div id="receipt-print-area">
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem" }}>ໃບຮັບເງິນ</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>
                  ໂຕະ {tableLabel} · ເລກບິນ {resultBillNumber}
                </p>
              </div>
              <div style={{ borderTop: "1px dashed var(--app-border)", borderBottom: "1px dashed var(--app-border)", padding: "10px 0" }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", padding: "4px 0" }}>
                    <span>{itemLabel(item)} ×{item.quantity}</span>
                    <span style={{ fontWeight: 600 }}>{fmtK(item.unitPrice * item.quantity)} ກີບ</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>ສ່ວນຫຼຸດ</span>
                    <span>−{fmtK(discountAmount)} ກີບ</span>
                  </div>
                )}
                {serviceChargeAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>ຄ່າບໍລິການ ({serviceChargePercent}%)</span>
                    <span>{fmtK(serviceChargeAmount)} ກີບ</span>
                  </div>
                )}
                {vatAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>VAT ({vatPercent}%)</span>
                    <span>{fmtK(vatAmount)} ກີບ</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.05rem", marginTop: 6 }}>
                  <span>ລວມ</span>
                  <span style={{ color: "var(--ion-color-primary)" }}>{fmtK(total)} ກີບ</span>
                </div>
              </div>
            </div>
          </IonContent>
          <IonFooter className="ion-no-print">
            <div style={{ padding: "12px 16px 28px", display: "flex", gap: 8 }}>
              <IonButton fill="outline" onClick={() => window.print()} style={{ flexShrink: 0, minHeight: 52, "--border-radius": "14px", margin: 0 }}>
                <IonIcon slot="icon-only" icon={printOutline} />
              </IonButton>
              <IonButton expand="block" onClick={() => onSuccess(resultBillNumber)} style={{ flex: 1, minHeight: 52, "--border-radius": "14px", margin: 0 }}>
                ຕົກລົງ
              </IonButton>
            </div>
          </IonFooter>
        </>
      ) : (
        <>
          <IonContent className="ion-padding">
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {modeTabs.map(({ v, label }) => {
                const active = mode === v;
                return (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: 10, fontWeight: 700, fontSize: "0.78rem",
                      cursor: "pointer", border: `1.5px solid ${active ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                      background: active ? "var(--ion-color-primary)" : "var(--app-surface)",
                      color: active ? "#fff" : "var(--app-text-secondary)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 14 }}>
              <CustomerPicker shopId={shopId} value={customer} onChange={setCustomer} required={mode === "credit"} />
            </div>

            <div style={{ marginBottom: 14 }}>
              {!discountMode ? (
                <button
                  onClick={() => setDiscountMode("amount")}
                  style={{ background: "none", border: "none", color: "var(--ion-color-primary)", fontWeight: 700, fontSize: "0.85rem", padding: 0, cursor: "pointer" }}
                >
                  + ເພີ່ມສ່ວນຫຼຸດ
                </button>
              ) : (
                <div style={{ border: "1.5px solid var(--app-border)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>ສ່ວນຫຼຸດ</span>
                    <button
                      onClick={() => { setDiscountMode(null); setDiscountInput(""); }}
                      style={{ background: "none", border: "none", color: "var(--app-danger)", fontSize: "0.78rem", cursor: "pointer" }}
                    >
                      ລຶບ
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(["amount", "percent"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDiscountMode(m)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 8, fontWeight: 700, fontSize: "0.75rem", cursor: "pointer",
                          border: `1.5px solid ${discountMode === m ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                          background: discountMode === m ? "var(--ion-color-primary)" : "var(--app-surface)",
                          color: discountMode === m ? "#fff" : "var(--app-text-secondary)",
                        }}
                      >
                        {m === "amount" ? "ຈຳນວນເງິນ" : "%"}
                      </button>
                    ))}
                  </div>
                  <IonInput
                    type="number" inputmode="decimal" value={discountInput}
                    onIonInput={(e) => setDiscountInput(String(e.detail.value ?? ""))}
                    placeholder="0" fill="outline"
                    style={{ "--padding-start": "12px", "--padding-top": "8px", "--padding-bottom": "8px" }}
                  />
                  {discountAmount > 0 && (
                    <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--app-text-secondary)" }}>
                      ຫຼຸດ {fmtK(discountAmount)} ₭
                    </p>
                  )}
                </div>
              )}
            </div>

            {mode === "cash" && (
              <>
                {rates.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <IonSelect
                      interface="popover"
                      value={currency}
                      onIonChange={(e) => setCurrency(e.detail.value)}
                      style={{ border: "1.5px solid var(--app-border)", borderRadius: 8, "--padding-start": "10px" }}
                    >
                      <IonSelectOption value="LAK">{CURRENCY_FLAGS.LAK} {CURRENCY_LABELS.LAK}</IonSelectOption>
                      {rates.map((r) => (
                        <IonSelectOption key={r.currency} value={r.currency}>
                          {CURRENCY_FLAGS[r.currency]} {CURRENCY_LABELS[r.currency]}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </div>
                )}
                <div style={{ border: "1.5px solid var(--app-border)", borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--app-text-secondary)" }}>ຮັບເງິນ ({currency})</span>
                    <button onClick={() => tapBackspace("cash")} style={{ background: "none", border: "none", color: "var(--app-text-muted)" }}>
                      <IonIcon icon={backspaceOutline} style={{ fontSize: 20 }} />
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800, textAlign: "right" }}>
                    {cashBuf ? fmtK(cashEntered) : "0"}
                  </p>
                  {currency !== "LAK" && (
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--app-text-secondary)", textAlign: "right" }}>
                      ທຽບເປັນ LAK: {fmtK(cashInLak)} ₭
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {quickAmounts(total).map((a) => (
                    <button
                      key={a}
                      onClick={() => setCashBuf(String(currency === "LAK" ? a : Math.round(a / rate)))}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--app-border)", background: "var(--app-surface)", fontWeight: 700, fontSize: "0.78rem" }}
                    >
                      {fmtK(a)} ₭
                    </button>
                  ))}
                </div>
                <Keypad onDigit={(d) => tapDigit("cash", d)} onClear={() => tapClear("cash")} />
              </>
            )}

            {mode === "qr" && (
              <div style={{ border: "1.5px solid var(--app-border)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--app-text-secondary)" }}>ຍອດທີ່ຕ້ອງໂອນ</p>
                <p style={{ margin: "6px 0 0", fontSize: "1.6rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>{fmtK(total)} ₭</p>
              </div>
            )}

            {mode === "split" && (
              <>
                <p style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 700 }}>ເງິນສົດ</p>
                <div
                  onClick={() => setActiveField("splitCash")}
                  style={{
                    border: `1.5px solid ${activeField === "splitCash" ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    borderRadius: 10, padding: "8px 12px", marginBottom: 10, textAlign: "right", fontWeight: 700, fontSize: "1.1rem",
                  }}
                >
                  {splitCashBuf ? fmtK(splitCash) : "0"}
                </div>
                <p style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 700 }}>ໂອນ</p>
                <div
                  onClick={() => setActiveField("splitTransfer")}
                  style={{
                    border: `1.5px solid ${activeField === "splitTransfer" ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    borderRadius: 10, padding: "8px 12px", marginBottom: 10, textAlign: "right", fontWeight: 700, fontSize: "1.1rem",
                  }}
                >
                  {splitTransferBuf ? fmtK(splitTransfer) : "0"}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "0.78rem", fontWeight: 600, color: splitCash + splitTransfer === total ? "var(--app-success)" : "var(--app-danger)" }}>
                  {fmtK(splitCash + splitTransfer)} / {fmtK(total)} ₭ {splitCash + splitTransfer === total ? "✓" : ""}
                </p>
                <Keypad onDigit={(d) => tapDigit(activeField, d)} onClear={() => tapClear(activeField)} />
              </>
            )}

            {mode === "credit" && (
              <>
                <p style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 700 }}>ຈ່າຍຕອນນີ້ (ບໍ່ບັງຄັບ)</p>
                <div
                  onClick={() => setActiveField("creditPaid")}
                  style={{
                    border: `1.5px solid ${activeField === "creditPaid" ? "var(--ion-color-primary)" : "var(--app-border)"}`,
                    borderRadius: 10, padding: "8px 12px", marginBottom: 10, textAlign: "right", fontWeight: 700, fontSize: "1.1rem",
                  }}
                >
                  {creditPaidBuf ? fmtK(creditPaidNow) : "0"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 10 }}>
                  <span style={{ color: "var(--app-text-secondary)" }}>ຕິດໜີ້ໄວ້</span>
                  <span style={{ fontWeight: 800, color: "var(--app-warning)" }}>{fmtK(creditPortion)} ₭</span>
                </div>
                <Keypad onDigit={(d) => tapDigit("creditPaid", d)} onClear={() => tapClear("creditPaid")} />
              </>
            )}

            <div style={{ marginTop: 16, borderTop: "1px solid var(--app-border)", paddingTop: 10 }}>
              {(discountAmount > 0 || serviceChargeAmount > 0 || vatAmount > 0) && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--app-text-secondary)" }}>ຍອດລວມຍ່ອຍ</span>
                    <span>{fmtK(subtotal)} ₭</span>
                  </div>
                  {discountAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--app-text-secondary)" }}>ສ່ວນຫຼຸດ</span>
                      <span style={{ color: "var(--app-danger)" }}>−{fmtK(discountAmount)} ₭</span>
                    </div>
                  )}
                  {serviceChargeAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--app-text-secondary)" }}>ຄ່າບໍລິການ ({serviceChargePercent}%)</span>
                      <span>{fmtK(serviceChargeAmount)} ₭</span>
                    </div>
                  )}
                  {vatAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--app-text-secondary)" }}>VAT ({vatPercent}%)</span>
                      <span>{fmtK(vatAmount)} ₭</span>
                    </div>
                  )}
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.95rem", marginTop: 4 }}>
                <span>ຍອດຕ້ອງຊຳລະ</span>
                <span style={{ color: "var(--ion-color-primary)" }}>{fmtK(total)} ₭</span>
              </div>
              {mode === "cash" && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 4 }}>
                  <span style={{ color: "var(--app-text-secondary)" }}>ເງິນທອນ</span>
                  <span style={{ fontWeight: 700, color: "var(--app-success)" }}>{fmtK(change)} ₭</span>
                </div>
              )}
            </div>

            {error && <p style={{ color: "var(--app-danger)", fontSize: "0.85rem", marginTop: 10 }}>{error}</p>}
          </IonContent>

          <IonFooter className="ion-no-print">
            <div style={{ padding: "12px 16px 28px", display: "flex", gap: 8 }}>
              <IonButton fill="outline" disabled={busy} onClick={onDismiss} style={{ flex: 1, minHeight: 52, "--border-radius": "14px", margin: 0 }}>
                ຍົກເລີກ
              </IonButton>
              <IonButton expand="block" disabled={!canConfirm || busy} onClick={handleConfirm} style={{ flex: 1, minHeight: 52, "--border-radius": "14px", margin: 0 }}>
                {busy ? <IonSpinner name="dots" style={{ width: 20, height: 20 }} /> : "ຢືນຢັນ"}
              </IonButton>
            </div>
          </IonFooter>
        </>
      )}
    </IonModal>
  );
};

const Keypad: React.FC<{ onDigit: (d: string) => void; onClear: () => void }> = ({ onDigit, onClear }) => {
  const keyStyle: React.CSSProperties = {
    height: 52, borderRadius: 10, border: "1px solid var(--app-border)",
    background: "var(--app-surface)", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer",
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((d) => (
        <button key={d} style={keyStyle} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <button style={{ ...keyStyle, color: "var(--app-danger)" }} onClick={onClear}>C</button>
      <button style={keyStyle} onClick={() => onDigit("0")}>0</button>
      <button style={keyStyle} onClick={() => onDigit("00")}>00</button>
    </div>
  );
};

export default PayBillModal;
