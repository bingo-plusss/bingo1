import {
  computeBase,
  incomeStatement,
  priceFor,
  roundUp,
  sanitize,
  unitEconomics,
  type Base,
  type Basis,
  type IncomeStatement,
  type Inputs,
  type UnitEconomics,
} from "../lib/finance";

export interface Model {
  i: Inputs;
  base: Base;
  basis: Basis;
  pct: number;
  step: number;
  proposed: number;
  u: UnitEconomics;
  is: IncomeStatement;
  /** Suggested list price for a profit %, rounded UP to the price step. NaN if unreachable. */
  suggest: (pct: number, basis?: Basis) => number;
  econ: (price: number) => UnitEconomics;
}

export function buildModel(
  raw: Inputs,
  basis: Basis,
  pct: number,
  step: number,
  manualPrice: number | null,
): Model {
  const i = sanitize(raw);
  const base = computeBase(i);
  const suggest = (p: number, b: Basis = basis) => {
    const exact = priceFor(p, b, base, i);
    return Number.isFinite(exact) ? roundUp(exact, step) : Number.NaN;
  };
  const econ = (price: number) => unitEconomics(price, base, i);
  const fromPct = suggest(pct);
  const proposed = manualPrice ?? (Number.isFinite(fromPct) ? fromPct : 0);
  const u = econ(proposed);
  return { i, base, basis, pct, step, proposed, u, is: incomeStatement(u, base, i), suggest, econ };
}

export const SAMPLE: Inputs = {
  productName: "Korean-Style Canvas Tote Bag",
  unitCost: 180,
  quantity: 50,
  shipping: 600,
  packaging: 250,
  advertising: 500,
  otherExpenses: 150,
  platformFeePct: 10,
  platformFeeFixed: 0,
  discountPct: 0,
  expectedUnits: 40,
  targetProfit: 5000,
};

export const LEVELS = [5, 10, 15, 20, 25, 30, 40, 50];
