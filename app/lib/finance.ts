/**
 * ProfitWise calculation engine.
 *
 * Accounting conventions used throughout:
 * - Capital invested = purchase cost + every batch expense (cash that left the business).
 * - Inventory (landed) cost = purchase cost + shipping-in + packaging. This is the cost of
 *   goods sold (COGS) for each unit actually sold; unsold units stay as inventory (an asset),
 *   not as a loss.
 * - Advertising and other expenses are operating (period) expenses: they are recognised in
 *   full, whether 1 unit or all units sell.
 * - Platform fees are selling expenses charged on the amount the buyer actually pays (after
 *   discount), plus an optional fixed fee per order.
 * - Revenue is never profit. Net sales - COGS - fees - operating expenses = net profit.
 * - Markup = profit ÷ cost. Margin = profit ÷ net selling price.
 *
 * All maths is done at full precision; rounding happens only for display and when a price
 * is suggested (always rounded UP so a suggested price never falls below its target).
 */

export type Basis = "markup" | "margin";

export interface Inputs {
  productName: string;
  unitCost: number;
  quantity: number;
  shipping: number;
  packaging: number;
  advertising: number;
  otherExpenses: number;
  platformFeePct: number; // % of amount paid by buyer
  platformFeeFixed: number; // fixed fee per unit/order
  discountPct: number; // voucher / discount given to buyer
  expectedUnits: number;
  targetProfit: number;
}

export interface Base {
  purchaseCost: number;
  inventoriableExpenses: number;
  operatingExpenses: number;
  totalCapital: number;
  landedCostPerUnit: number;
  costPerUnit: number; // full cost: total capital ÷ quantity
  feeRate: number; // 0..1
  discountRate: number; // 0..1
  keepRate: number; // share of list price the seller keeps before fixed fees
  breakEvenPrice: number; // exact, unrounded
  unitsSold: number; // expected units, capped at stock
}

export type Status = "loss" | "breakeven" | "profit";

export interface UnitEconomics {
  listPrice: number;
  discount: number;
  netPrice: number; // what the buyer pays = revenue per unit
  fee: number;
  netProceeds: number; // cash kept per unit after fees
  profit: number; // after full cost per unit
  contribution: number; // net proceeds - landed cost (covers operating expenses)
  markup: number; // profit ÷ cost per unit
  margin: number; // profit ÷ net price
  status: Status;
}

export interface IncomeStatement {
  unitsSold: number;
  unitsUnsold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  platformFees: number;
  operatingExpenses: number;
  netProfit: number;
  endingInventory: number;
  cashCollected: number;
  capitalRecovered: number;
  capitalRecoveredPct: number;
  capitalUnrecovered: number;
  potentialLoss: number;
}

export const CENT = 0.005; // tolerance for "equal to" comparisons on money

/** Clean a user-entered number: never NaN, never negative, optionally capped. */
export function clean(value: number, max = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, max);
}

/** Round up to the given step (0.01 = centavo). Guards against float noise like 110.0000001. */
export function roundUp(value: number, step: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.ceil(value / step - 1e-9) * step;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitize(i: Inputs): Inputs {
  const quantity = Math.max(1, Math.floor(clean(i.quantity)));
  return {
    productName: i.productName,
    unitCost: clean(i.unitCost),
    quantity,
    shipping: clean(i.shipping),
    packaging: clean(i.packaging),
    advertising: clean(i.advertising),
    otherExpenses: clean(i.otherExpenses),
    platformFeePct: clean(i.platformFeePct, 95),
    platformFeeFixed: clean(i.platformFeeFixed),
    discountPct: clean(i.discountPct, 95),
    expectedUnits: Math.min(Math.floor(clean(i.expectedUnits)), quantity),
    targetProfit: clean(i.targetProfit),
  };
}

export function computeBase(raw: Inputs): Base {
  const i = sanitize(raw);
  const purchaseCost = i.unitCost * i.quantity;
  const inventoriableExpenses = i.shipping + i.packaging;
  const operatingExpenses = i.advertising + i.otherExpenses;
  const totalCapital = purchaseCost + inventoriableExpenses + operatingExpenses;
  const feeRate = i.platformFeePct / 100;
  const discountRate = i.discountPct / 100;
  const keepRate = (1 - discountRate) * (1 - feeRate);
  const costPerUnit = totalCapital / i.quantity;
  return {
    purchaseCost,
    inventoriableExpenses,
    operatingExpenses,
    totalCapital,
    landedCostPerUnit: (purchaseCost + inventoriableExpenses) / i.quantity,
    costPerUnit,
    feeRate,
    discountRate,
    keepRate,
    breakEvenPrice: (costPerUnit + i.platformFeeFixed) / keepRate,
    unitsSold: i.expectedUnits,
  };
}

/** Largest margin % that is mathematically reachable once percentage fees are taken. */
export function maxMarginPct(base: Base): number {
  return Math.max(0, (1 - base.feeRate) * 100 - 1);
}

/**
 * List price needed to earn `pct` profit, on a markup or margin basis, after the
 * discount and platform fees are taken out. Exact (unrounded). NaN if unreachable.
 */
export function priceFor(pct: number, basis: Basis, base: Base, i: Inputs): number {
  const p = clean(pct) / 100;
  const fixed = clean(i.platformFeeFixed);
  if (basis === "markup") {
    return (base.costPerUnit * (1 + p) + fixed) / base.keepRate;
  }
  const denom = 1 - base.feeRate - p;
  if (denom <= 0) return Number.NaN;
  return (base.costPerUnit + fixed) / denom / (1 - base.discountRate);
}

export function statusOf(listPrice: number, base: Base): Status {
  // Compare against the break-even price rounded up to the centavo: that is the
  // lowest price a seller can actually charge without losing money.
  const be = roundUp(base.breakEvenPrice, 0.01);
  if (listPrice < be - CENT) return "loss";
  if (listPrice <= be + CENT) return "breakeven";
  return "profit";
}

export function unitEconomics(listPrice: number, base: Base, i: Inputs): UnitEconomics {
  const price = clean(listPrice);
  const discount = price * base.discountRate;
  const netPrice = price - discount;
  const fee = netPrice * base.feeRate + clean(i.platformFeeFixed);
  const netProceeds = netPrice - fee;
  const profit = netProceeds - base.costPerUnit;
  return {
    listPrice: price,
    discount,
    netPrice,
    fee,
    netProceeds,
    profit,
    contribution: netProceeds - base.landedCostPerUnit,
    markup: base.costPerUnit > 0 ? profit / base.costPerUnit : 0,
    margin: netPrice > 0 ? profit / netPrice : 0,
    status: statusOf(price, base),
  };
}

export function incomeStatement(
  u: UnitEconomics,
  base: Base,
  i: Inputs,
  unitsSold = base.unitsSold,
): IncomeStatement {
  const qty = Math.max(1, Math.floor(clean(i.quantity)));
  const sold = Math.min(Math.floor(clean(unitsSold)), qty);
  const grossSales = u.listPrice * sold;
  const discounts = u.discount * sold;
  const netSales = grossSales - discounts;
  const cogs = base.landedCostPerUnit * sold;
  const grossProfit = netSales - cogs;
  const platformFees = u.fee * sold;
  const netProfit = grossProfit - platformFees - base.operatingExpenses;
  const cashCollected = u.netProceeds * sold;
  const capitalRecovered = Math.min(Math.max(cashCollected, 0), base.totalCapital);
  return {
    unitsSold: sold,
    unitsUnsold: qty - sold,
    grossSales,
    discounts,
    netSales,
    cogs,
    grossProfit,
    platformFees,
    operatingExpenses: base.operatingExpenses,
    netProfit,
    endingInventory: base.landedCostPerUnit * (qty - sold),
    cashCollected,
    capitalRecovered,
    capitalRecoveredPct: base.totalCapital > 0 ? cashCollected / base.totalCapital : 0,
    capitalUnrecovered: Math.max(0, base.totalCapital - cashCollected),
    potentialLoss: Math.max(0, -netProfit),
  };
}

/** Units that must sell before net profit reaches `targetProfit` (0 = true break-even). */
export function unitsForProfit(u: UnitEconomics, base: Base, targetProfit: number): number {
  if (u.contribution <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil((clean(targetProfit) + base.operatingExpenses) / u.contribution - 1e-9));
}

/** Units that must sell before the cash collected pays back every peso invested. */
export function unitsForCapitalPayback(u: UnitEconomics, base: Base): number {
  if (u.netProceeds <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(base.totalCapital / u.netProceeds - 1e-9);
}

export interface SalesTarget {
  units: number;
  reachable: boolean;
  grossSales: number;
  netSales: number;
  cashCollected: number;
  capitalRecovered: number;
  restockUnits: number;
  withinStock: boolean;
}

export function salesTarget(u: UnitEconomics, base: Base, i: Inputs): SalesTarget {
  const units = unitsForProfit(u, base, i.targetProfit);
  const reachable = Number.isFinite(units);
  const n = reachable ? units : 0;
  const qty = Math.max(1, Math.floor(clean(i.quantity)));
  return {
    units,
    reachable,
    grossSales: u.listPrice * n,
    netSales: u.netPrice * n,
    cashCollected: u.netProceeds * n,
    capitalRecovered: Math.min(u.netProceeds * Math.min(n, qty), base.totalCapital),
    restockUnits: Math.max(0, n - qty),
    withinStock: n <= qty,
  };
}
