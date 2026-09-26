"use client";

import { useState, type ReactNode } from "react";
import {
  computeBase,
  incomeStatement,
  maxMarginPct,
  roundUp,
  salesTarget,
  sanitize,
  statusOf,
  unitEconomics,
  unitsForCapitalPayback,
  unitsForProfit,
  type Basis,
  type Inputs,
  type Status,
} from "../lib/finance";
import { HBarChart, PriceLadderChart, PriceRuler, ProfitCurveChart } from "./charts";
import { LEVELS, type Model } from "./model";
import {
  Card,
  InfoTip,
  Money,
  NumberField,
  Segmented,
  Stat,
  StatusBadge,
  Toggle,
  toneClass,
  toneOf,
  useFmt,
  type Tone,
} from "./ui";

type SetInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => void;

const basisWord = (b: Basis) => (b === "markup" ? "Markup" : "Margin");

/* ================================================================== */
/* Product input                                                       */
/* ================================================================== */

export function ProductInput({ raw, set }: { raw: Inputs; set: SetInput }) {
  const f = useFmt();
  const qty = sanitize(raw).quantity;
  return (
    <Card id="inputs" step="Step 1" title="Your product" subtitle="Enter what you paid and what it cost to get the stock ready to sell.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="pname" className="mb-1 block text-sm font-medium text-ink-2">Product name</label>
          <input
            id="pname"
            value={raw.productName}
            maxLength={80}
            onChange={(e) => set("productName", e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand/40"
            placeholder="e.g. Canvas tote bag"
          />
        </div>
        <NumberField
          label="Product cost per piece"
          prefix={f.symbol}
          value={raw.unitCost}
          onChange={(n) => set("unitCost", n)}
          error={raw.unitCost <= 0 ? "Enter how much you paid for one piece." : null}
          hint="Supplier price for one unit"
        />
        <NumberField
          label="Quantity purchased"
          suffix="pcs"
          integer
          min={1}
          value={raw.quantity}
          onChange={(n) => set("quantity", Math.max(1, n))}
          hint="Total pieces in this batch"
        />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">Batch expenses <span className="font-normal text-muted">(total for all {f.num(qty)} pcs)</span></h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Shipping (to receive stock)" prefix={f.symbol} value={raw.shipping} onChange={(n) => set("shipping", n)} />
        <NumberField label="Packaging" prefix={f.symbol} value={raw.packaging} onChange={(n) => set("packaging", n)} />
        <NumberField label="Advertising / boosting" prefix={f.symbol} value={raw.advertising} onChange={(n) => set("advertising", n)} />
        <NumberField label="Other expenses" prefix={f.symbol} value={raw.otherExpenses} onChange={(n) => set("otherExpenses", n)} hint="e.g. tags, pamasahe, photos" />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">Selling fees &amp; discounts <span className="font-normal text-muted">(charged each time you sell)</span></h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label="Platform fee"
          suffix="%"
          max={95}
          value={raw.platformFeePct}
          onChange={(n) => set("platformFeePct", n)}
          hint="% of what the buyer pays"
        />
        <NumberField
          label="Fixed fee per order"
          prefix={f.symbol}
          value={raw.platformFeeFixed}
          onChange={(n) => set("platformFeeFixed", n)}
          hint="e.g. transaction fee"
        />
        <NumberField
          label="Discount / voucher"
          suffix="%"
          max={95}
          value={raw.discountPct}
          onChange={(n) => set("discountPct", n)}
          hint="Off your posted price"
        />
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">Sales plan</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Expected units to sell"
          suffix="pcs"
          integer
          max={qty}
          value={Math.min(raw.expectedUnits, qty)}
          onChange={(n) => set("expectedUnits", n)}
          hint={`Up to ${f.num(qty)} pcs (what you have in stock)`}
        />
        <NumberField
          label="Target profit (optional)"
          prefix={f.symbol}
          value={raw.targetProfit}
          onChange={(n) => set("targetProfit", n)}
          hint="Used by “How many do I need to sell?”"
        />
      </div>
    </Card>
  );
}

/* ================================================================== */
/* Cost & expense breakdown                                            */
/* ================================================================== */

export function CostBreakdown({ m }: { m: Model }) {
  const f = useFmt();
  const { i, base } = m;
  const rows: { label: string; value: number; kind: string; color: string }[] = [
    { label: `Product cost (${f.money(i.unitCost)} × ${f.num(i.quantity)})`, value: base.purchaseCost, kind: "Inventory", color: "var(--info-mark)" },
    { label: "Shipping", value: i.shipping, kind: "Inventory", color: "#5598e7" },
    { label: "Packaging", value: i.packaging, kind: "Inventory", color: "#86b6ef" },
    { label: "Advertising", value: i.advertising, kind: "Operating", color: "#eb6834" },
    { label: "Other expenses", value: i.otherExpenses, kind: "Operating", color: "#e87ba4" },
  ];
  const total = base.totalCapital || 1;
  return (
    <Card id="breakdown" step="Step 2" title="Cost & expense breakdown" subtitle="Where your capital went.">
      <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Share of total capital by cost type">
        {rows.filter((r) => r.value > 0).map((r, k) => (
          <span key={r.label} title={`${r.label}: ${f.money(r.value)}`} style={{ width: `${(r.value / total) * 100}%`, background: r.color, marginLeft: k ? 2 : 0 }} />
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                  {r.label}
                </span>
              </td>
              <td className="py-2 text-right text-xs text-muted">{((r.value / total) * 100).toFixed(1)}%</td>
              <td className="tnum py-2 pl-3 text-right font-medium text-ink">{f.money(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold text-ink" colSpan={2}>Total capital invested</td>
            <td className="tnum pt-3 text-right text-lg font-bold text-info">{f.money(base.totalCapital)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Cost per unit (all-in)" value={f.money(base.costPerUnit)} sub={`${f.money(base.totalCapital)} ÷ ${f.num(i.quantity)} pcs`} tone="info" />
        <Stat label="Inventory cost per unit" value={f.money(base.landedCostPerUnit)} sub="Product + shipping + packaging" tone="info" />
      </div>
      <InfoTip>
        <p><b>Cost per unit (all-in)</b> spreads <i>every</i> peso you spent over all pieces. This is the number your price must beat so the whole batch pays for itself.</p>
        <p className="mt-2"><b>Inventory cost</b> is only what it took to get the item in your hands (product, shipping, packaging). Advertising and other expenses are <b>operating expenses</b> — you spend them whether you sell 1 piece or all of them, so they are subtracted in full from your profit.</p>
        <p className="mt-2">Platform fees and discounts are not part of capital: they are taken out each time you sell, as a percentage of the price.</p>
      </InfoTip>
    </Card>
  );
}

/* ================================================================== */
/* Price setter: profit % slider + manual price                        */
/* ================================================================== */

export function PriceSetter({
  m,
  setBasis,
  setPct,
  manualPrice,
  setManualPrice,
}: {
  m: Model;
  setBasis: (b: Basis) => void;
  setPct: (n: number) => void;
  manualPrice: number | null;
  setManualPrice: (n: number | null) => void;
}) {
  const f = useFmt();
  const maxPct = m.basis === "markup" ? 200 : Math.floor(maxMarginPct(m.base));
  const exactPrice = m.suggest(m.pct);
  return (
    <Card
      id="price"
      step="Step 3"
      title="Choose your profit percentage"
      subtitle="Move the slider — every number on this page updates instantly."
      action={
        <Segmented
          label="Percentage basis"
          value={m.basis}
          onChange={setBasis}
          options={[
            { value: "markup", label: "Markup (on cost)" },
            { value: "margin", label: "Margin (on price)" },
          ]}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="pct" className="text-sm font-medium text-ink-2">{basisWord(m.basis)} %</label>
            <span className="tnum text-2xl font-bold text-ink">{m.pct}%</span>
          </div>
          <input
            id="pct"
            type="range"
            min={0}
            max={maxPct}
            step={1}
            value={Math.min(m.pct, maxPct)}
            onChange={(e) => {
              setPct(Number(e.target.value));
              setManualPrice(null);
            }}
            className="w-full"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {LEVELS.filter((l) => l <= maxPct).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setPct(l);
                  setManualPrice(null);
                }}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  manualPrice === null && m.pct === l
                    ? "border-brand bg-brand text-brand-ink"
                    : "border-line text-ink-2 hover:border-brand hover:text-ink"
                }`}
              >
                {l}%
              </button>
            ))}
            <span className="flex items-center gap-1 text-sm text-ink-2">
              Custom
              <input
                type="number"
                min={0}
                max={maxPct}
                value={m.pct}
                aria-label="Custom percentage"
                onChange={(e) => {
                  const n = Math.min(maxPct, Math.max(0, Number(e.target.value) || 0));
                  setPct(n);
                  setManualPrice(null);
                }}
                className="tnum w-20 rounded-lg border border-line bg-surface px-2 py-1 text-ink"
              />
              %
            </span>
          </div>
          {m.basis === "margin" && (
            <p className="mt-2 text-xs text-muted">
              Margin can’t reach {f.pct(1 - m.base.feeRate, 0)} or more because the {f.pct(m.base.feeRate, 0)} platform fee also comes out of the price.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface-2 p-4 lg:w-72">
          <label htmlFor="manual" className="text-sm font-medium text-ink-2">Your selling price (posted)</label>
          <div className="mt-1 flex items-center rounded-lg border border-line bg-surface px-3 focus-within:ring-2 focus-within:ring-brand/40">
            <span className="mr-1 text-lg text-muted">{f.symbol}</span>
            <input
              id="manual"
              type="number"
              min={0}
              step="any"
              value={roundMoney2(m.proposed)}
              onChange={(e) => {
                const n = Number(e.target.value);
                setManualPrice(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              className="tnum w-full bg-transparent py-2 text-2xl font-bold text-ink outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {manualPrice === null ? (
              Number.isFinite(exactPrice) ? (
              <>Suggested from {m.pct}% {m.basis} after fees &amp; discount, rounded up. Type to set your own price.</>
            ) : (
              <span className="text-loss">That margin is not reachable after fees. Lower the percentage.</span>
            )
            ) : (
              <>
                You typed your own price.{" "}
                <button type="button" onClick={() => setManualPrice(null)} className="font-medium text-info hover:underline">
                  Use the slider again
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

const roundMoney2 = (n: number) => Math.round(n * 100) / 100;

/* ================================================================== */
/* Loss warning                                                        */
/* ================================================================== */

export function LossWarning({ m }: { m: Model }) {
  const f = useFmt();
  const s = m.u.status;
  const t = toneOf(s);
  const copy: Record<Status, { title: string; body: string }> = {
    loss: { title: "Potential Loss", body: "Your selling price is below your estimated cost." },
    breakeven: { title: "Break-Even", body: "You may recover your estimated cost but have no profit." },
    profit: { title: "Estimated Profit", body: "Your current price is above your estimated cost." },
  };
  const icon = s === "loss" ? "⚠" : s === "breakeven" ? "●" : "✓";
  const diff = m.proposed - m.base.breakEvenPrice;
  return (
    <div role="alert" aria-live="polite" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${toneClass.bg[t]}`}>
      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${toneClass.bar[t]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${toneClass.text[t]}`}>{copy[s].title}: <span className="font-normal text-ink">{copy[s].body}</span></p>
        <p className="tnum mt-0.5 text-sm text-ink-2">
          Price {f.money(m.proposed)} vs. break-even {f.money(roundUp(m.base.breakEvenPrice, 0.01))} —{" "}
          {Math.abs(diff) < 0.01 ? "exactly at break-even" : `${f.money(Math.abs(diff))} ${diff > 0 ? "above" : "below"}`}
          {" · "}profit per unit {f.money(m.u.profit)}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Capital protection dashboard                                        */
/* ================================================================== */

export function Dashboard({ m }: { m: Model }) {
  const f = useFmt();
  const { base, u, is, i } = m;
  const beRounded = roundUp(base.breakEvenPrice, 0.01);
  const profitTone: Tone = is.netProfit > 0.005 ? (u.margin < 0.05 ? "warn" : "profit") : is.netProfit < -0.005 ? "loss" : "warn";
  const beUnits = unitsForProfit(u, base, 0);
  const payback = unitsForCapitalPayback(u, base);
  return (
    <Card id="dashboard" title="Capital protection dashboard" subtitle={`Estimates if you sell ${f.num(is.unitsSold)} of ${f.num(i.quantity)} pcs at ${f.money(m.proposed)}.`} action={<StatusBadge status={u.status} />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total capital" value={f.money(base.totalCapital)} tone="info" sub="Everything you spent" />
        <Stat label="Cost per unit" value={f.money(base.costPerUnit)} tone="info" sub="All-in, before fees" />
        <Stat label="Break-even price" value={f.money(beRounded)} tone="warn" sub="Minimum posted price" />
        <Stat label="Your selling price" value={f.money(m.proposed)} tone={toneOf(u.status)} sub={`${f.pct(u.markup)} markup · ${f.pct(u.margin)} margin`} />
        <Stat label="Expected revenue" value={f.money(is.netSales)} tone="info" sub="Money from buyers — not profit" />
        <Stat label="Expected net profit" value={f.money(is.netProfit)} tone={profitTone} sub={`${f.pct(is.netSales ? is.netProfit / is.netSales : 0)} of revenue`} />
        <Stat label="Potential loss" value={f.money(is.potentialLoss)} tone={is.potentialLoss > 0.005 ? "loss" : "neutral"} sub={is.potentialLoss > 0.005 ? "At this price & volume" : "None at this plan"} />
        <Stat label="Units" value={`${f.num(is.unitsSold)} / ${f.num(i.quantity)}`} sub="Expected sold / in stock" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Break-even vs. your price</h3>
          <PriceRuler costPerUnit={base.costPerUnit} breakEven={beRounded} proposed={m.proposed} />
          <p className="-mt-6 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            <b>Selling below {f.money(beRounded)} may result in a loss.</b>
            {(base.feeRate > 0 || base.discountRate > 0 || i.platformFeeFixed > 0) && (
              <span className="text-ink-2"> This already includes your {base.feeRate > 0 ? `${f.pct(base.feeRate, 1)} platform fee` : ""}{base.feeRate > 0 && (base.discountRate > 0 || i.platformFeeFixed > 0) ? ", " : ""}{i.platformFeeFixed > 0 ? `${f.money(i.platformFeeFixed)} fixed fee` : ""}{i.platformFeeFixed > 0 && base.discountRate > 0 ? ", " : ""}{base.discountRate > 0 ? `${f.pct(base.discountRate, 1)} discount` : ""}.</span>
            )}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat
              label="Sell this many to stop losing"
              value={Number.isFinite(beUnits) ? `${f.num(beUnits)} pcs` : "Never"}
              sub={Number.isFinite(beUnits) ? (beUnits > i.quantity ? "More than your stock!" : "Profit break-even") : "Price too low"}
              tone={Number.isFinite(beUnits) && beUnits <= i.quantity ? "neutral" : "loss"}
            />
            <Stat
              label="Sell this many to get capital back"
              value={Number.isFinite(payback) ? `${f.num(payback)} pcs` : "Never"}
              sub={Number.isFinite(payback) ? (payback > i.quantity ? "More than your stock!" : "Cash payback") : "Price too low"}
              tone={Number.isFinite(payback) && payback <= i.quantity ? "info" : "loss"}
            />
          </div>
        </div>
        <IncomeStatementTable m={m} />
      </div>
    </Card>
  );
}

function Row({ label, value, strong, minus, tone, note }: { label: ReactNode; value: number; strong?: boolean; minus?: boolean; tone?: Tone; note?: string }) {
  const f = useFmt();
  return (
    <tr className={strong ? "border-t border-line" : ""}>
      <td className={`py-1.5 pr-2 ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
        {minus && <span className="text-muted">less </span>}
        {label}
        {note && <span className="block text-xs text-muted">{note}</span>}
      </td>
      <td className={`tnum py-1.5 text-right ${strong ? "font-semibold" : ""} ${tone ? toneClass.text[tone] : "text-ink"}`}>
        {minus && value > 0 ? `(${f.money(value)})` : f.money(value)}
      </td>
    </tr>
  );
}

function IncomeStatementTable({ m }: { m: Model }) {
  const f = useFmt();
  const { is, base } = m;
  const pctRecovered = Math.min(1, Math.max(0, is.capitalRecoveredPct));
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Estimated profit &amp; loss</h3>
      <p className="mb-2 text-xs text-muted">How revenue becomes profit — revenue is <b>not</b> profit.</p>
      <table className="w-full text-sm">
        <tbody>
          <Row label={`Sales at posted price (${f.num(is.unitsSold)} pcs)`} value={is.grossSales} />
          {is.discounts > 0 && <Row label="Discounts / vouchers" value={is.discounts} minus />}
          <Row label="Revenue (net sales)" value={is.netSales} strong tone="info" />
          <Row label="Cost of units sold" value={is.cogs} minus note={`${f.num(is.unitsSold)} × ${f.money(base.landedCostPerUnit)} inventory cost`} />
          <Row label="Gross profit" value={is.grossProfit} strong tone={is.grossProfit < 0 ? "loss" : undefined} />
          <Row label="Platform fees" value={is.platformFees} minus />
          <Row label="Advertising & other expenses" value={is.operatingExpenses} minus note="Counted in full, even if not everything sells" />
          <Row label="Estimated net profit" value={is.netProfit} strong tone={is.netProfit > 0.005 ? "profit" : is.netProfit < -0.005 ? "loss" : "warn"} />
        </tbody>
      </table>

      {is.unitsUnsold > 0 && (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <b>{f.num(is.unitsUnsold)} unsold pcs</b> remain as inventory worth {f.money(is.endingInventory)} at cost. That is still your money — but it is not cash until sold.
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-ink-2">Capital recovered (cash back after fees)</span>
          <span className="tnum font-semibold text-info">{f.pct(is.capitalRecoveredPct)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${is.capitalRecoveredPct >= 1 ? "bg-profit-mark" : "bg-info-mark"}`} style={{ width: `${pctRecovered * 100}%` }} />
        </div>
        <p className="tnum mt-1 text-xs text-muted">
          {f.money(is.cashCollected)} collected of {f.money(base.totalCapital)} invested
          {is.capitalUnrecovered > 0.005 ? ` · ${f.money(is.capitalUnrecovered)} still to recover` : " · fully recovered"}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Selling price simulator                                             */
/* ================================================================== */

export function Simulator({ m, onPick }: { m: Model; onPick: (pct: number) => void }) {
  const f = useFmt();
  const custom = LEVELS.includes(m.pct) ? [] : [m.pct];
  const levels = [...LEVELS, ...custom].sort((a, b) => a - b);
  const beRounded = roundUp(m.base.breakEvenPrice, 0.01);
  const rows = levels.map((pct) => {
    const price = m.suggest(pct);
    const u = Number.isFinite(price) ? m.econ(price) : null;
    const is = u ? incomeStatement(u, m.base, m.i) : null;
    return { pct, price, u, is };
  });

  return (
    <Card id="simulator" title="Selling price simulator" subtitle={`What each ${m.basis} level means for ${m.i.productName || "your product"}. Tap a row to use it.`}>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium sm:pl-0">{basisWord(m.basis)}</th>
              <th className="px-2 py-2 text-right font-medium">Selling price</th>
              <th className="px-2 py-2 text-right font-medium">Profit / unit</th>
              <th className="px-2 py-2 text-right font-medium">Revenue ({f.num(m.is.unitsSold)} pcs)</th>
              <th className="px-2 py-2 text-right font-medium">Net profit</th>
              <th className="px-2 py-2 text-right font-medium">Break-even</th>
              <th className="px-2 py-2 text-right font-medium">Capital recovered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pct, price, u, is }) => {
              const sel = pct === m.pct && m.proposed === price;
              return (
                <tr
                  key={pct}
                  onClick={() => onPick(pct)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface-2 ${sel ? "bg-info-soft" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-ink sm:pl-0">
                    {pct}% {sel && <span className="ml-1 text-xs font-normal text-info">current</span>}
                  </td>
                  {u && is ? (
                    <>
                      <td className="tnum px-2 py-2.5 text-right font-semibold text-ink">{f.money(price)}</td>
                      <td className="px-2 py-2.5 text-right"><Money n={u.profit} tone={u.profit > 0.005 ? "profit" : u.profit < -0.005 ? "loss" : "warn"} /></td>
                      <td className="tnum px-2 py-2.5 text-right text-info">{f.money(is.netSales)}</td>
                      <td className="px-2 py-2.5 text-right"><Money n={is.netProfit} tone={is.netProfit > 0.005 ? "profit" : is.netProfit < -0.005 ? "loss" : "warn"} /></td>
                      <td className="tnum px-2 py-2.5 text-right text-warn">{f.money(beRounded)}</td>
                      <td className="tnum px-2 py-2.5 text-right text-ink-2">
                        {f.money(is.capitalRecovered)} <span className="text-xs text-muted">({f.pct(is.capitalRecoveredPct, 0)})</span>
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-2 py-2.5 text-right text-loss">Not reachable — fees take too much of the price.</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink">Profit percentage vs. selling price</h3>
        <Legend items={[{ label: "Cost + fees to cover", color: "var(--info-mark)", faded: true }, { label: "Profit per unit", color: "var(--profit-mark)" }]} />
        <PriceLadderChart
          basisLabel={basisWord(m.basis)}
          selectedPct={m.pct}
          rows={rows.map(({ pct, price, u }) => ({
            pct,
            price,
            profit: u ? u.profit : 0,
            costPart: u ? price - u.profit : 0,
          }))}
        />
      </div>
    </Card>
  );
}

function Legend({ items }: { items: { label: string; color: string; faded?: boolean }[] }) {
  return (
    <div className="my-2 flex flex-wrap gap-4 text-xs text-ink-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color, opacity: it.faded ? 0.35 : 1 }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Markup vs margin explainer                                          */
/* ================================================================== */

export function MarkupVsMargin({ m }: { m: Model }) {
  const f = useFmt();
  const { u, base } = m;
  return (
    <Card title="Markup vs. margin — they are not the same" subtitle="Many sellers mix these up. Both use the same profit, but divide by different numbers.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Markup</p>
          <p className="tnum mt-1 text-3xl font-bold text-ink">{f.pct(u.markup)}</p>
          <p className="mt-2 text-sm text-ink-2">Profit ÷ <b>cost</b></p>
          <p className="tnum mt-1 text-sm text-muted">{f.money(u.profit)} ÷ {f.money(base.costPerUnit)}</p>
          <p className="mt-2 text-sm text-ink-2">“How much did I add on top of what it cost me?”</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Profit margin</p>
          <p className="tnum mt-1 text-3xl font-bold text-ink">{f.pct(u.margin)}</p>
          <p className="mt-2 text-sm text-ink-2">Profit ÷ <b>selling price</b> (what the buyer paid)</p>
          <p className="tnum mt-1 text-sm text-muted">{f.money(u.profit)} ÷ {f.money(u.netPrice)}</p>
          <p className="mt-2 text-sm text-ink-2">“Out of every peso a buyer pays, how much do I keep as profit?”</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Example: a 25% markup on a ₱100 cost gives a ₱125 price, but that is only a <b>20% margin</b> (₱25 ÷ ₱125). Margin is always smaller than markup when you make a profit.
      </p>
    </Card>
  );
}

/* ================================================================== */
/* Recommendation options                                              */
/* ================================================================== */

export function Recommendations({ m, onUse }: { m: Model; onUse: (price: number) => void }) {
  const f = useFmt();
  const options = [
    { name: "Low margin", pct: 10, blurb: "Competitive price, thinner cushion for returns and surprises." },
    { name: "Balanced margin", pct: 20, blurb: "Middle ground between price appeal and profit." },
    { name: "Higher margin", pct: 30, blurb: "More profit per sale; needs stronger branding or less competition." },
  ];
  return (
    <Card id="options" title="Pricing options to consider" subtitle="Calculated options at a markup on your all-in cost — you know your market, so you decide.">
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => {
          const price = m.suggest(o.pct, "markup");
          const u = m.econ(price);
          const is = incomeStatement(u, m.base, m.i);
          const active = Math.abs(m.proposed - price) < 0.005;
          return (
            <div key={o.name} className={`flex flex-col rounded-xl border p-4 ${active ? "border-brand ring-2 ring-brand/30" : "border-line"}`}>
              <p className="text-sm font-semibold text-ink">{o.name}</p>
              <p className="text-xs text-muted">{o.pct}% markup · {f.pct(u.margin)} margin</p>
              <p className="tnum mt-3 text-3xl font-bold text-ink">{f.money(price)}</p>
              <dl className="tnum mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-2">Profit / unit</dt><dd className="font-medium text-profit">{f.money(u.profit)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Net profit ({f.num(is.unitsSold)} pcs)</dt><dd className={`font-medium ${is.netProfit < 0 ? "text-loss" : "text-profit"}`}>{f.money(is.netProfit)}</dd></div>
              </dl>
              <p className="mt-3 flex-1 text-xs text-ink-2">{o.blurb}</p>
              <button
                type="button"
                onClick={() => onUse(price)}
                disabled={active}
                className="mt-3 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-brand-ink disabled:border-line disabled:text-muted disabled:hover:bg-transparent"
              >
                {active ? "Using this price" : "Use this price"}
              </button>
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </Card>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2">
      <b>Note:</b> These calculations are estimates. Actual profit may vary depending on fees, discounts, returns, taxes, unsold inventory, and other business expenses.
    </p>
  );
}

/* ================================================================== */
/* Scenario comparison                                                 */
/* ================================================================== */

export interface Scenario {
  id: string;
  name: string;
  kind: "markup" | "margin" | "price";
  value: number;
}

export function Scenarios({
  m,
  scenarios,
  setScenarios,
  onUse,
}: {
  m: Model;
  scenarios: Scenario[];
  setScenarios: (s: Scenario[]) => void;
  onUse: (price: number) => void;
}) {
  const f = useFmt();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Scenario["kind"]>("markup");
  const [value, setValue] = useState(35);

  const priceOf = (s: Scenario) => (s.kind === "price" ? s.value : m.suggest(s.value, s.kind));

  return (
    <Card id="scenarios" title="Compare pricing scenarios" subtitle="Save several ideas side by side. Add your own at the bottom.">
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium sm:pl-0">Scenario</th>
              <th className="px-2 py-2 text-right font-medium">Markup</th>
              <th className="px-2 py-2 text-right font-medium">Margin</th>
              <th className="px-2 py-2 text-right font-medium">Selling price</th>
              <th className="px-2 py-2 text-right font-medium">Profit / unit</th>
              <th className="px-2 py-2 text-right font-medium">Net profit ({f.num(m.is.unitsSold)} pcs)</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const price = priceOf(s);
              if (!Number.isFinite(price)) {
                return (
                  <tr key={s.id} className="border-b border-line">
                    <td className="px-4 py-2.5 font-medium text-ink sm:pl-0">{s.name}</td>
                    <td colSpan={6} className="px-2 py-2.5 text-right text-loss">Not reachable after fees</td>
                    <td className="px-2 py-2.5 text-right"><RemoveBtn onClick={() => setScenarios(scenarios.filter((x) => x.id !== s.id))} /></td>
                  </tr>
                );
              }
              const u = m.econ(price);
              const is = incomeStatement(u, m.base, m.i);
              return (
                <tr key={s.id} className="border-b border-line">
                  <td className="px-4 py-2.5 font-medium text-ink sm:pl-0">
                    {s.name}
                    <span className="block text-xs font-normal text-muted">
                      {s.kind === "price" ? "Fixed price" : `${s.value}% ${s.kind}`}
                    </span>
                  </td>
                  <td className="tnum px-2 py-2.5 text-right text-ink-2">{f.pct(u.markup)}</td>
                  <td className="tnum px-2 py-2.5 text-right text-ink-2">{f.pct(u.margin)}</td>
                  <td className="tnum px-2 py-2.5 text-right font-semibold text-ink">{f.money(price)}</td>
                  <td className="px-2 py-2.5 text-right"><Money n={u.profit} tone={toneOf(u.status)} /></td>
                  <td className="px-2 py-2.5 text-right"><Money n={is.netProfit} tone={is.netProfit > 0.005 ? "profit" : is.netProfit < -0.005 ? "loss" : "warn"} /></td>
                  <td className="px-2 py-2.5"><StatusBadge status={u.status} /></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    <button type="button" onClick={() => onUse(price)} className="mr-2 text-xs font-semibold text-info hover:underline">Use</button>
                    <RemoveBtn onClick={() => setScenarios(scenarios.filter((x) => x.id !== s.id))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="mt-4 grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-[1fr_auto_8rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = Math.max(0, value || 0);
          const label = name.trim() || (kind === "price" ? `Price ${f.money(clean)}` : `${clean}% ${kind}`);
          setScenarios([...scenarios, { id: `${Date.now()}`, name: label, kind, value: clean }]);
          setName("");
        }}
      >
        <div>
          <label htmlFor="sc-name" className="mb-1 block text-xs font-medium text-ink-2">Scenario name</label>
          <input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Payday sale" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label htmlFor="sc-kind" className="mb-1 block text-xs font-medium text-ink-2">Based on</label>
          <select id="sc-kind" value={kind} onChange={(e) => setKind(e.target.value as Scenario["kind"])} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="markup">Markup %</option>
            <option value="margin">Margin %</option>
            <option value="price">Exact price</option>
          </select>
        </div>
        <div>
          <label htmlFor="sc-val" className="mb-1 block text-xs font-medium text-ink-2">{kind === "price" ? `Price (${f.symbol})` : "Percent"}</label>
          <input id="sc-val" type="number" min={0} step="any" value={value} onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))} className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">Add scenario</button>
      </form>
    </Card>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Remove scenario" className="rounded px-1 text-muted hover:text-loss">
      ✕
    </button>
  );
}

/* ================================================================== */
/* Sales target calculator                                             */
/* ================================================================== */

export function SalesTargetCalc({ m, set }: { m: Model; set: SetInput }) {
  const f = useFmt();
  const t = salesTarget(m.u, m.base, m.i);
  return (
    <Card id="target" title="How many do I need to sell?" subtitle={`At your price of ${f.money(m.proposed)}, to reach a target net profit.`}>
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <div>
          <NumberField label="Target profit" prefix={f.symbol} value={m.i.targetProfit} onChange={(n) => set("targetProfit", n)} />
          <div className="mt-4 space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
            <p className="flex justify-between"><span className="text-ink-2">Profit per unit</span><Money n={m.u.profit} /></p>
            <p className="flex justify-between"><span className="text-ink-2">Kept per sale after inventory cost</span><Money n={m.u.contribution} /></p>
            <p className="flex justify-between"><span className="text-ink-2">Ads & other to cover first</span><Money n={m.base.operatingExpenses} /></p>
          </div>
        </div>
        {t.reachable ? (
          <div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat big label="Units to sell" value={f.num(t.units)} tone={t.withinStock ? "profit" : "warn"} sub={`${f.num(m.i.quantity)} in stock`} />
              <Stat label="Required revenue" value={f.money(t.netSales)} tone="info" sub="What buyers pay in total" />
              <Stat label="Sales at posted price" value={f.money(t.grossSales)} tone="info" sub={m.base.discountRate > 0 ? "Before discounts" : "Same as revenue (no discount)"} />
              <Stat label="Capital recovered" value={f.money(t.capitalRecovered)} tone="info" sub={`${f.pct(m.base.totalCapital ? t.capitalRecovered / m.base.totalCapital : 0, 0)} of ${f.money(m.base.totalCapital)}`} />
            </div>
            <p className="mt-4 text-sm text-ink-2">
              Formula: (target {f.money(m.i.targetProfit)} + ads &amp; other {f.money(m.base.operatingExpenses)}) ÷ {f.money(m.u.contribution)} kept per sale ={" "}
              <b className="tnum text-ink">{f.num(t.units)} units</b> (rounded up — you can’t sell part of a unit).
            </p>
            {!t.withinStock && (
              <p className="mt-3 rounded-lg border border-warn-mark/40 bg-warn-soft px-3 py-2 text-sm text-warn">
                ⚠ You only have {f.num(m.i.quantity)} pcs. You would need to restock about <b>{f.num(t.restockUnits)} more</b> (≈ {f.money(t.restockUnits * m.base.landedCostPerUnit)} more capital at today’s cost), or raise your price.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-loss-mark/30 bg-loss-soft p-4 text-sm text-loss">
            <b>Not reachable at this price.</b> Each sale doesn’t even cover its own inventory cost and fees, so selling more only increases the loss. Raise your price above {f.money(roundUp(m.base.breakEvenPrice, 0.01))}.
          </div>
        )}
      </div>
    </Card>
  );
}

/* ================================================================== */
/* What-if simulator                                                   */
/* ================================================================== */

export function WhatIf({ m, step }: { m: Model; step: number }) {
  const f = useFmt();
  const [priceO, setPrice] = useState<number | null>(null);
  const [unitsO, setUnits] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const [discO, setDisc] = useState<number | null>(null);

  const price = priceO ?? roundUp(m.proposed * 1.25, step);
  const units = Math.min(unitsO ?? m.is.unitsSold, m.i.quantity);
  const disc = discO ?? m.i.discountPct;

  const altInputs: Inputs = { ...m.i, otherExpenses: m.i.otherExpenses + extra, discountPct: disc, expectedUnits: units };
  const altBase = computeBase(altInputs);
  const altU = unitEconomics(price, altBase, altInputs);
  const altIs = incomeStatement(altU, altBase, altInputs);
  const altMarkupPct = altBase.costPerUnit > 0 ? Math.round(altU.markup * 100) : 0;

  const rows: { label: string; a: number; b: number; money?: boolean; pct?: boolean }[] = [
    { label: "Posted price", a: m.proposed, b: price, money: true },
    { label: "Buyer pays (after discount)", a: m.u.netPrice, b: altU.netPrice, money: true },
    { label: "Units sold", a: m.is.unitsSold, b: altIs.unitsSold },
    { label: "Cost per unit (all-in)", a: m.base.costPerUnit, b: altBase.costPerUnit, money: true },
    { label: "Profit per unit", a: m.u.profit, b: altU.profit, money: true },
    { label: "Revenue", a: m.is.netSales, b: altIs.netSales, money: true },
    { label: "Net profit", a: m.is.netProfit, b: altIs.netProfit, money: true },
    { label: "Markup", a: m.u.markup, b: altU.markup, pct: true },
    { label: "Margin", a: m.u.margin, b: altU.margin, pct: true },
  ];
  const diff = altIs.netProfit - m.is.netProfit;
  const show = (v: number, r: (typeof rows)[number]) => (r.money ? f.money(v) : r.pct ? f.pct(v) : f.num(v));

  return (
    <Card id="whatif" title="What if I change my price?" subtitle="Try a different plan and see the difference against your current price.">
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          <NumberField label="New selling price" prefix={f.symbol} value={roundMoney2(price)} onChange={(n) => setPrice(n)} />
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor="wi-pct" className="font-medium text-ink-2">…or set by markup %</label>
              <span className="tnum font-semibold text-ink">{altMarkupPct}%</span>
            </div>
            <input
              id="wi-pct"
              type="range"
              min={-50}
              max={200}
              value={Math.max(-50, Math.min(200, altMarkupPct))}
              onChange={(e) => {
                const p = Number(e.target.value) / 100;
                const exact = (altBase.costPerUnit * (1 + p) + altInputs.platformFeeFixed) / altBase.keepRate;
                setPrice(Math.max(0, roundUp(exact, step)));
              }}
              className="w-full"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor="wi-units" className="font-medium text-ink-2">Quantity sold</label>
              <span className="tnum font-semibold text-ink">{f.num(units)} / {f.num(m.i.quantity)}</span>
            </div>
            <input id="wi-units" type="range" min={0} max={m.i.quantity} value={units} onChange={(e) => setUnits(Number(e.target.value))} className="w-full" />
          </div>
          <NumberField label="Extra expenses (add or reduce)" prefix={f.symbol} min={-(m.i.otherExpenses + m.i.advertising)} value={extra} onChange={setExtra} hint="e.g. +₱300 more ads. Negative = savings." />
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor="wi-disc" className="font-medium text-ink-2">Discount</label>
              <span className="tnum font-semibold text-ink">{disc}%</span>
            </div>
            <input id="wi-disc" type="range" min={0} max={70} value={disc} onChange={(e) => setDisc(Number(e.target.value))} className="w-full" />
          </div>
          <button
            type="button"
            onClick={() => { setPrice(null); setUnits(null); setExtra(0); setDisc(null); }}
            className="text-sm font-medium text-info hover:underline"
          >
            Reset what-if
          </button>
        </div>

        <div>
          <div className={`mb-4 rounded-xl border p-4 ${toneClass.bg[diff > 0.005 ? "profit" : diff < -0.005 ? "loss" : "neutral"]}`}>
            <p className="text-sm text-ink-2">
              If you sell at <b className="tnum text-ink">{f.money(price)}</b> instead of <b className="tnum text-ink">{f.money(m.proposed)}</b>
              {units !== m.is.unitsSold && <> and sell {f.num(units)} pcs</>}, your estimated net profit changes by
            </p>
            <p className={`tnum mt-1 text-3xl font-bold ${diff > 0.005 ? "text-profit" : diff < -0.005 ? "text-loss" : "text-ink"}`}>
              {diff > 0.005 ? "+" : ""}{f.money(diff)}
            </p>
            <div className="mt-2"><StatusBadge status={statusOf(price, altBase)} /></div>
          </div>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium sm:pl-0"></th>
                  <th className="px-2 py-2 text-right font-medium">Current plan</th>
                  <th className="px-2 py-2 text-right font-medium">What if</th>
                  <th className="px-2 py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.b - r.a;
                  const good = r.label === "Cost per unit (all-in)" ? d < 0 : d > 0;
                  return (
                    <tr key={r.label} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink-2 sm:pl-0">{r.label}</td>
                      <td className="tnum px-2 py-2 text-right text-ink">{show(r.a, r)}</td>
                      <td className="tnum px-2 py-2 text-right font-semibold text-ink">{show(r.b, r)}</td>
                      <td className={`tnum px-2 py-2 text-right ${Math.abs(d) < 0.005 ? "text-muted" : good ? "text-profit" : "text-loss"}`}>
                        {Math.abs(d) < 0.005 ? "—" : `${d > 0 ? "+" : "−"}${show(Math.abs(d), r)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ================================================================== */
/* Visual charts                                                       */
/* ================================================================== */

export function Charts({ m }: { m: Model }) {
  const f = useFmt();
  const be = roundUp(m.base.breakEvenPrice, 0.01);
  const minPrice = Math.max(0, Math.min(be * 0.6, m.proposed * 0.8));
  const maxPrice = Math.max(be * 1.8, m.proposed * 1.3, minPrice + 1);
  return (
    <Card id="charts" title="See your numbers" subtitle="Hover or tap a chart to read exact values.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Selling price vs. profit per unit</h3>
          <p className="mb-2 text-xs text-muted">Left of the yellow line = loss on every sale. Right = profit.</p>
          <ProfitCurveChart profitAt={(p) => m.econ(p).profit} breakEven={be} proposed={m.proposed} minPrice={minPrice} maxPrice={maxPrice} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Capital vs. expected revenue</h3>
          <p className="mb-4 text-xs text-muted">Selling {f.num(m.is.unitsSold)} pcs at {f.money(m.proposed)}.</p>
          <HBarChart
            ariaLabel="Bar comparison of capital invested, revenue, cash kept after fees, and net profit"
            items={[
              { label: "Capital invested", value: m.base.totalCapital, color: "var(--info-mark)", note: "All money spent on this batch." },
              { label: "Expected revenue", value: m.is.netSales, color: "#86b6ef", note: "What buyers pay. Not profit." },
              { label: "Cash kept after platform fees", value: m.is.cashCollected, color: "#5598e7", note: "Compare to capital: this is how much you get back." },
              { label: "Estimated net profit", value: m.is.netProfit, color: m.is.netProfit >= 0 ? "var(--profit-mark)" : "var(--loss-mark)", note: "Revenue − cost of units sold − fees − ads & other." },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

/* ================================================================== */
/* Listing preview                                                     */
/* ================================================================== */

export function ListingPreview({
  m,
  set,
  setManualPrice,
}: {
  m: Model;
  set: SetInput;
  setManualPrice: (n: number | null) => void;
}) {
  const f = useFmt();
  const [img, setImg] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState(true);
  const [showCost, setShowCost] = useState(false);
  const [desc, setDesc] = useState("Brand new · Ready to ship · COD available");
  const discounted = m.base.discountRate > 0;

  return (
    <Card id="preview" title="Preview my selling price" subtitle="See how your listing could look before you post it.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label htmlFor="pv-name" className="mb-1 block text-sm font-medium text-ink-2">Product name</label>
            <input id="pv-name" value={m.i.productName} maxLength={80} onChange={(e) => set("productName", e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
          </div>
          <div>
            <label htmlFor="pv-img" className="mb-1 block text-sm font-medium text-ink-2">Product image</label>
            <input
              id="pv-img"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (img) URL.revokeObjectURL(img);
                setImg(URL.createObjectURL(file));
              }}
              className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
            />
            <p className="mt-1 text-xs text-muted">Stays on your device — nothing is uploaded.</p>
          </div>
          <div>
            <label htmlFor="pv-desc" className="mb-1 block text-sm font-medium text-ink-2">Short description</label>
            <input id="pv-desc" value={desc} maxLength={100} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Selling price" prefix={f.symbol} value={roundMoney2(m.proposed)} onChange={(n) => setManualPrice(n)} />
            <div>
              <p className="mb-1 text-sm font-medium text-ink-2">Original cost</p>
              <p className="tnum rounded-lg bg-surface-2 px-3 py-2 text-ink">{f.money(m.base.costPerUnit)}</p>
            </div>
          </div>
          <p className="text-sm text-ink-2">
            Profit: <b className="tnum text-ink">{f.pct(m.u.markup)}</b> markup · <b className="tnum text-ink">{f.pct(m.u.margin)}</b> margin
          </p>
          <div className="space-y-2">
            <Toggle checked={showProfit} onChange={setShowProfit} label="Show my estimated profit (only visible to me)" />
            <Toggle checked={showCost} onChange={setShowCost} label="Show my original cost in the preview" />
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-surface shadow-md">
            <div className="flex aspect-square items-center justify-center bg-surface-2">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={img} alt={m.i.productName} className="h-full w-full object-cover" />
              ) : (
                <div className="text-center text-muted">
                  <svg aria-hidden width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
                    <path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" />
                  </svg>
                  <p className="mt-2 text-xs">Add a photo</p>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="line-clamp-2 font-medium text-ink">{m.i.productName || "Product name"}</p>
              <p className="mt-1 line-clamp-1 text-xs text-muted">{desc}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tnum text-2xl font-bold text-[#e4572e]">{f.money(discounted ? m.u.netPrice : m.proposed)}</span>
                {discounted && (
                  <>
                    <span className="tnum text-sm text-muted line-through">{f.money(m.proposed)}</span>
                    <span className="rounded bg-[#e4572e]/10 px-1 text-xs font-semibold text-[#e4572e]">-{m.i.discountPct}%</span>
                  </>
                )}
              </div>
              {showCost && <p className="tnum mt-1 text-xs text-ink-2">Original cost: {f.money(m.base.costPerUnit)}</p>}
              <p className="mt-1 text-xs text-muted">{f.num(m.i.quantity)} pcs available</p>
            </div>
            {showProfit && (
              <div className="border-t border-dashed border-line bg-surface-2 px-4 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">🔒 Seller only — not shown to buyers</p>
                <p className={`tnum text-sm font-semibold ${toneClass.text[toneOf(m.u.status)]}`}>Estimated profit: {f.money(m.u.profit)} per unit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* re-exported for ProfitWise */
export { roundMoney2 };
