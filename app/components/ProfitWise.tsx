"use client";

import { useMemo, useState } from "react";
import type { Basis, Inputs } from "../lib/finance";
import { buildModel, SAMPLE } from "./model";
import {
  Charts,
  CostBreakdown,
  Dashboard,
  Disclaimer,
  ListingPreview,
  LossWarning,
  MarkupVsMargin,
  PriceSetter,
  ProductInput,
  Recommendations,
  SalesTargetCalc,
  Scenarios,
  Simulator,
  WhatIf,
  type Scenario,
} from "./sections";
import { CURRENCIES, FmtContext, makeFmt } from "./ui";

const DEFAULT_SCENARIOS: Scenario[] = [
  { id: "c", name: "Conservative", kind: "markup", value: 10 },
  { id: "s", name: "Standard", kind: "markup", value: 20 },
  { id: "h", name: "Higher profit", kind: "markup", value: 30 },
];

const STEPS = [
  { value: 0.01, label: "Exact (centavo)" },
  { value: 1, label: "Whole peso / unit" },
  { value: 5, label: "Nearest 5" },
  { value: 10, label: "Nearest 10" },
];

const NAV = [
  ["inputs", "Product"],
  ["price", "Price"],
  ["dashboard", "Dashboard"],
  ["simulator", "Simulator"],
  ["scenarios", "Scenarios"],
  ["target", "Sales target"],
  ["whatif", "What if"],
  ["charts", "Charts"],
  ["preview", "Preview"],
] as const;

export default function ProfitWise() {
  const [inputs, setInputs] = useState<Inputs>(SAMPLE);
  const [basis, setBasis] = useState<Basis>("markup");
  const [pct, setPct] = useState(30);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [currencyCode, setCurrencyCode] = useState("PHP");
  const [step, setStep] = useState(1);
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [resetKey, setResetKey] = useState(0);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const fmt = useMemo(() => makeFmt(currency), [currency]);
  const m = useMemo(() => buildModel(inputs, basis, pct, step, manualPrice), [inputs, basis, pct, step, manualPrice]);

  const set = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs((prev) => ({ ...prev, [key]: value }));

  const applyPrice = (price: number) => setManualPrice(Math.round(price * 100) / 100);
  const pickPct = (p: number) => {
    setPct(p);
    setManualPrice(null);
  };

  const reset = (blank: boolean) => {
    setInputs(
      blank
        ? { ...SAMPLE, productName: "", unitCost: 0, quantity: 1, shipping: 0, packaging: 0, advertising: 0, otherExpenses: 0, platformFeePct: 0, expectedUnits: 1, targetProfit: 0 }
        : SAMPLE,
    );
    setBasis("markup");
    setPct(blank ? 20 : 30);
    setManualPrice(null);
    setScenarios(DEFAULT_SCENARIOS);
    setResetKey((k) => k + 1);
  };

  return (
    <FmtContext.Provider value={fmt}>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="font-bold tracking-tight text-ink">ProfitWise</p>
              <p className="hidden text-xs text-muted sm:block">Know your numbers before you sell.</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:text-ink">
                ⚙ Settings
              </summary>
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-surface p-4 shadow-xl">
                <label htmlFor="currency" className="mb-1 block text-sm font-medium text-ink-2">Currency</label>
                <select id="currency" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <label htmlFor="rounding" className="mt-4 mb-1 block text-sm font-medium text-ink-2">Round suggested prices up to</label>
                <select id="rounding" value={step} onChange={(e) => setStep(Number(e.target.value))} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
                  {STEPS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted">Prices are always rounded <b>up</b>, so rounding never pushes you below your target profit.</p>
                <div className="mt-4 flex gap-2 border-t border-line pt-4">
                  <button type="button" onClick={() => reset(false)} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">Load sample</button>
                  <button type="button" onClick={() => reset(true)} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">Start blank</button>
                </div>
              </div>
            </details>
          </div>
        </div>
        <nav aria-label="Sections" className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1 text-sm whitespace-nowrap">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-full px-3 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6">
        <div className="rounded-2xl bg-brand p-5 text-brand-ink sm:p-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Business Pricing &amp; Profit Simulator</h1>
          <p className="mt-2 max-w-3xl text-sm opacity-90 sm:text-base">
            Enter your product cost and expenses, then try different profit percentages to see your selling price, break-even point, and expected profit — before you post.
          </p>
          <p className="mt-3 max-w-3xl text-xs opacity-80">
            ProfitWise is a planning and simulation tool. It helps reduce pricing mistakes but cannot guarantee you will never lose money. All results are estimates.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <ProductInput key={`in-${resetKey}`} raw={inputs} set={set} />
          <CostBreakdown m={m} />
        </div>

        <PriceSetter m={m} setBasis={(b) => { setBasis(b); setManualPrice(null); if (b === "margin") setPct((p) => Math.min(p, 50)); }} setPct={setPct} manualPrice={manualPrice} setManualPrice={setManualPrice} />
        <div className="z-20 lg:sticky lg:top-[6.5rem]">
          <LossWarning m={m} />
        </div>
        <Dashboard m={m} />
        <Simulator m={m} onPick={pickPct} />
        <MarkupVsMargin m={m} />
        <Recommendations m={m} onUse={applyPrice} />
        <Scenarios m={m} scenarios={scenarios} setScenarios={setScenarios} onUse={applyPrice} />
        <SalesTargetCalc m={m} set={set} />
        <WhatIf key={`wi-${resetKey}`} m={m} step={step} />
        <Charts m={m} />
        <ListingPreview key={`pv-${resetKey}`} m={m} set={set} setManualPrice={setManualPrice} />
        <Disclaimer />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        ProfitWise · Know your numbers before you sell. · Estimates only — not financial or tax advice.
      </footer>
    </FmtContext.Provider>
  );
}
