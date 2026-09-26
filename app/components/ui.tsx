"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import type { Status } from "../lib/finance";

/* ---------- formatting ---------- */

export interface Currency {
  code: string;
  label: string;
  locale: string;
}

export const CURRENCIES: Currency[] = [
  { code: "PHP", label: "Philippine Peso (₱)", locale: "en-PH" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "en-IE" },
  { code: "SGD", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "JPY", label: "Japanese Yen (¥)", locale: "ja-JP" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
];

export interface Fmt {
  money: (n: number) => string;
  moneyShort: (n: number) => string;
  symbol: string;
  pct: (ratio: number, digits?: number) => string;
  num: (n: number) => string;
}

export function makeFmt(c: Currency): Fmt {
  const full = new Intl.NumberFormat(c.locale, { style: "currency", currency: c.code });
  const short = new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const symbol =
    full.formatToParts(0).find((p) => p.type === "currency")?.value ?? c.code;
  const num = new Intl.NumberFormat(c.locale);
  const bad = (n: number) => !Number.isFinite(n);
  return {
    // Normalise -0 so tiny negative float noise never renders as "-₱0.00"
    money: (n) => (bad(n) ? "—" : full.format(Math.abs(n) < 0.005 ? 0 : n)),
    moneyShort: (n) => (bad(n) ? "—" : Math.abs(n) < 10000 ? full.format(n) : short.format(n)),
    symbol,
    pct: (r, d = 1) => (bad(r) ? "—" : `${(Math.abs(r) < 0.00005 ? 0 : r * 100).toFixed(d)}%`),
    num: (n) => (bad(n) ? "—" : num.format(n)),
  };
}

export const FmtContext = createContext<Fmt>(makeFmt(CURRENCIES[0]));
export const useFmt = () => useContext(FmtContext);

/* ---------- layout ---------- */

export function Card({
  id,
  title,
  subtitle,
  step,
  action,
  children,
  className = "",
}: {
  id?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  step?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 lg:scroll-mt-52 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {step && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{step}</p>
            )}
            {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------- inputs ---------- */

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  min = 0,
  max,
  step = "any",
  integer = false,
  error,
}: {
  label: ReactNode;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number | "any";
  integer?: boolean;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-2">
        {label}
      </label>
      <div
        className={`flex items-center rounded-lg border bg-surface px-3 focus-within:ring-2 focus-within:ring-brand/40 ${
          error ? "border-loss-mark" : "border-line"
        }`}
      >
        {prefix && <span className="mr-1.5 text-sm text-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          min={min}
          max={max}
          step={integer ? 1 : step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(0);
            let n = Number(raw);
            if (!Number.isFinite(n)) return;
            if (integer) n = Math.floor(n);
            if (n < min) n = min;
            if (max !== undefined && n > max) n = max;
            onChange(n);
          }}
          className="tnum w-full min-w-0 bg-transparent py-2 text-ink outline-none"
          aria-invalid={!!error}
        />
        {suffix && <span className="ml-1.5 text-sm text-muted">{suffix}</span>}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-loss">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}

/* ---------- status & numbers ---------- */

export type Tone = "profit" | "warn" | "loss" | "info" | "neutral";

export const toneOf = (s: Status): Tone =>
  s === "profit" ? "profit" : s === "breakeven" ? "warn" : "loss";

const toneText: Record<Tone, string> = {
  profit: "text-profit",
  warn: "text-warn",
  loss: "text-loss",
  info: "text-info",
  neutral: "text-ink",
};
const toneBg: Record<Tone, string> = {
  profit: "bg-profit-soft border-profit-mark/30",
  warn: "bg-warn-soft border-warn-mark/40",
  loss: "bg-loss-soft border-loss-mark/30",
  info: "bg-info-soft border-info-mark/25",
  neutral: "bg-surface-2 border-line",
};
const toneBar: Record<Tone, string> = {
  profit: "bg-profit-mark",
  warn: "bg-warn-mark",
  loss: "bg-loss-mark",
  info: "bg-info-mark",
  neutral: "bg-muted",
};

export const toneClass = { text: toneText, bg: toneBg, bar: toneBar };

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  big = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  big?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 sm:p-4 ${toneBg[tone]}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${toneBar[tone]}`} aria-hidden />
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={`tnum mt-1 font-semibold tracking-tight ${toneText[tone]} ${big ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
    </div>
  );
}

const statusIcon: Record<Status, string> = { profit: "▲", breakeven: "●", loss: "▼" };
const statusWord: Record<Status, string> = {
  profit: "Estimated profit",
  breakeven: "Break-even",
  loss: "Potential loss",
};

export function StatusBadge({ status }: { status: Status }) {
  const t = toneOf(status);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${toneBg[t]} ${toneText[t]}`}
    >
      <span aria-hidden className="text-[0.65rem]">{statusIcon[status]}</span>
      {statusWord[status]}
    </span>
  );
}

export function Money({ n, tone }: { n: number; tone?: Tone }) {
  const f = useFmt();
  const t: Tone = tone ?? (n < -0.005 ? "loss" : "neutral");
  return <span className={`tnum ${toneText[t]}`}>{f.money(n)}</span>;
}

export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-2 text-xs text-ink-2">
      <summary className="cursor-pointer list-none font-medium text-info hover:underline">
        <span aria-hidden>ⓘ </span>What does this mean?
      </summary>
      <div className="mt-1.5 rounded-lg bg-surface-2 p-3 leading-relaxed">{children}</div>
    </details>
  );
}
