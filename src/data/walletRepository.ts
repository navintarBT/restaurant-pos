import { getAllExpenses } from "./expenseRepository";
import { getAllIncomes } from "./incomeRepository";

export interface WalletBalances {
  cashBalance: number;
  transferBalance: number;
}

/**
 * All-time wallet balances, independent of any date filter — running total
 * of income minus expenses for each payment bucket.
 */
export async function getWalletBalances(shopId: string): Promise<WalletBalances> {
  const [allExpenses, allIncomes] = await Promise.all([
    getAllExpenses(shopId),
    getAllIncomes(shopId),
  ]);

  const sumBy = <T,>(list: T[], pick: (x: T) => number, match: (x: T) => boolean) =>
    list.filter(match).reduce((s, x) => s + pick(x), 0);

  const expCashAll = sumBy(allExpenses, (e) => e.amount, (e) => (e.paymentType ?? "cash") === "cash");
  const expTransferAll = sumBy(allExpenses, (e) => e.amount, (e) => e.paymentType === "transfer");
  const incCashAll = sumBy(allIncomes, (i) => i.amount, (i) => i.paymentType === "cash");
  const incTransferAll = sumBy(allIncomes, (i) => i.amount, (i) => i.paymentType === "transfer");

  return {
    cashBalance: incCashAll - expCashAll,
    transferBalance: incTransferAll - expTransferAll,
  };
}
