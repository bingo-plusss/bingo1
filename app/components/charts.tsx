"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFmt } from "./ui";

/* Width-aware container so text stays crisp at every screen size (no viewBox scaling). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    // Some embedded/background contexts never deliver the first observation.
    const raf = requestAnimationFrame(() => setWidth(Math.floor(el.getBoundingClientRect().width)));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return [ref, width] as const;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const w = 190;
  const left = Math.min(Math.max(x - w / 2, 0), Math.max(0, width - w));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
      style={{ left, top: Math.max(0, y - 8), width: w, transform: "translateY(-100%)" }}
      role="status"
    >
      {children}
    </div>
  );
}

function TipRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-1.5 text-ink-2">
        {swatch && <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="tnum font-semibold text-ink">{value}</span>
    </div>
  );
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/* ------------------------------------------------------------------ */
/* 1. Selling price vs profit per unit                                  */
/* ------------------------------------------------------------------ */

export function ProfitCurveChart({
  profitAt,
  breakEven,
  proposed,
  minPrice,
  maxPrice,
}: {
  profitAt: (price: number) => number;
  breakEven: number;
  proposed: number;
  minPrice: number;
  maxPrice: number;
}) {
  const f = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const m = { t: 16, r: 16, b: 36, l: 64 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;

  const N = 60;
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const p = minPrice + ((maxPrice - minPrice) * k) / N;
    return { p, y: profitAt(p) };
  });
  const ys = pts.map((d) => d.y);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const pad = (yMax - yMin) * 0.08 || 1;
  const y0 = yMin - pad;
  const y1 = yMax + pad;
  const sx = (p: number) => m.l + ((p - minPrice) / (maxPrice - minPrice)) * iw;
  const sy = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * ih;
  const line = pts.map((d, k) => `${k ? "L" : "M"}${sx(d.p).toFixed(1)},${sy(d.y).toFixed(1)}`).join("");
  const zeroY = sy(0);
  const beX = sx(breakEven);
  const propX = sx(proposed);
  const propIn = proposed >= minPrice && proposed <= maxPrice;
  const hoverPrice = hover;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Line chart: profit per unit rises as selling price increases. Break-even at ${f.money(breakEven)}.`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < m.l || x > m.l + iw) return setHover(null);
            setHover(minPrice + ((x - m.l) / iw) * (maxPrice - minPrice));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {/* loss / profit zones */}
          <rect x={m.l} y={m.t} width={Math.max(0, beX - m.l)} height={ih} fill="var(--loss-mark)" opacity={0.07} />
          <rect x={beX} y={m.t} width={Math.max(0, m.l + iw - beX)} height={ih} fill="var(--profit-mark)" opacity={0.07} />
          {niceTicks(y0, y1).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
              <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tnum">
                {f.moneyShort(t)}
              </text>
            </g>
          ))}
          {niceTicks(minPrice, maxPrice, width < 420 ? 3 : 5).map((t) => (
            <text key={t} x={sx(t)} y={height - m.b + 18} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tnum">
              {f.moneyShort(t)}
            </text>
          ))}
          <line x1={m.l} x2={m.l + iw} y1={zeroY} y2={zeroY} stroke="var(--axis)" strokeWidth={1.5} />
          <text x={m.l + iw} y={height - 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">
            Selling price →
          </text>
          {/* break-even */}
          <line x1={beX} x2={beX} y1={m.t} y2={m.t + ih} stroke="var(--warn-mark)" strokeWidth={2} />
          <text x={beX + 4} y={m.t + 12} fontSize={11} fontWeight={600} fill="var(--warn)">
            Break-even
          </text>
          <path d={line} fill="none" stroke="var(--info-mark)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {propIn && (
            <g>
              <circle cx={propX} cy={sy(profitAt(proposed))} r={6} fill={profitAt(proposed) >= -0.005 ? "var(--profit-mark)" : "var(--loss-mark)"} stroke="var(--surface)" strokeWidth={2} />
              <text x={propX} y={sy(profitAt(proposed)) - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)">
                Your price
              </text>
            </g>
          )}
          {hoverPrice !== null && (
            <g pointerEvents="none">
              <line x1={sx(hoverPrice)} x2={sx(hoverPrice)} y1={m.t} y2={m.t + ih} stroke="var(--ink-2)" strokeOpacity={0.4} />
              <circle cx={sx(hoverPrice)} cy={sy(profitAt(hoverPrice))} r={4} fill="var(--info-mark)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hoverPrice !== null && (
        <Tooltip x={sx(hoverPrice)} y={sy(profitAt(hoverPrice))} width={width}>
          <TipRow label="Selling price" value={f.money(hoverPrice)} />
          <TipRow
            label="Profit per unit"
            value={f.money(profitAt(hoverPrice))}
            swatch={profitAt(hoverPrice) >= 0 ? "var(--profit-mark)" : "var(--loss-mark)"}
          />
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Profit % vs selling price (stacked: cost-to-cover + profit)       */
/* ------------------------------------------------------------------ */

export function PriceLadderChart({
  rows,
  selectedPct,
  basisLabel,
}: {
  rows: { pct: number; price: number; costPart: number; profit: number }[];
  selectedPct: number;
  basisLabel: string;
}) {
  const f = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 250;
  const m = { t: 20, r: 8, b: 40, l: 60 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const valid = rows.filter((r) => Number.isFinite(r.price));
  const max = Math.max(1, ...valid.map((r) => r.price)) * 1.08;
  const band = iw / Math.max(1, rows.length);
  const bw = Math.min(28, band * 0.6);
  const sy = (v: number) => m.t + ih - (v / max) * ih;
  const GAP = 2;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Column chart: suggested selling price for each profit percentage, split into cost to cover and profit.">
          {niceTicks(0, max).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
              <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tnum">
                {f.moneyShort(t)}
              </text>
            </g>
          ))}
          {rows.map((r, k) => {
            const cx = m.l + band * k + band / 2;
            const x = cx - bw / 2;
            const sel = r.pct === selectedPct;
            const ok = Number.isFinite(r.price);
            const costTop = sy(r.costPart);
            const priceTop = sy(r.price);
            const profitH = Math.max(0, costTop - priceTop - GAP);
            return (
              <g key={r.pct} opacity={hover === null || hover === k ? 1 : 0.55}>
                {ok && (
                  <>
                    <path d={roundedTopBar(x, costTop, bw, sy(0) - costTop, profitH > 0 ? 0 : 4)} fill="var(--info-mark)" opacity={0.35} />
                    {profitH > 0 && <path d={roundedTopBar(x, priceTop, bw, profitH, 4)} fill="var(--profit-mark)" />}
                    {sel && (
                      <text x={cx} y={priceTop - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)" className="tnum">
                        {f.moneyShort(r.price)}
                      </text>
                    )}
                  </>
                )}
                <text
                  x={cx}
                  y={height - m.b + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={sel ? 700 : 400}
                  fill={sel ? "var(--ink)" : "var(--muted)"}
                >
                  {r.pct}%
                </text>
                <rect
                  x={m.l + band * k}
                  y={m.t}
                  width={band}
                  height={ih + 24}
                  fill="transparent"
                  onPointerEnter={() => setHover(k)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          <line x1={m.l} x2={m.l + iw} y1={sy(0)} y2={sy(0)} stroke="var(--axis)" />
          <text x={m.l + iw} y={height - 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">
            {basisLabel} →
          </text>
        </svg>
      )}
      {hover !== null && rows[hover] && (
        <Tooltip x={m.l + band * hover + band / 2} y={sy(Number.isFinite(rows[hover].price) ? rows[hover].price : 0)} width={width}>
          <p className="mb-1 font-semibold text-ink">{rows[hover].pct}% {basisLabel.toLowerCase()}</p>
          {Number.isFinite(rows[hover].price) ? (
            <>
              <TipRow label="Selling price" value={f.money(rows[hover].price)} />
              <TipRow label="Cost + fees to cover" value={f.money(rows[hover].costPart)} swatch="var(--info-mark)" />
              <TipRow label="Profit per unit" value={f.money(rows[hover].profit)} swatch="var(--profit-mark)" />
            </>
          ) : (
            <p className="text-loss">Not reachable after fees.</p>
          )}
        </Tooltip>
      )}
    </div>
  );
}

function roundedTopBar(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/* ------------------------------------------------------------------ */
/* 3. Horizontal comparison bars (capital vs revenue, etc.)             */
/* ------------------------------------------------------------------ */

export interface HBarItem {
  label: string;
  value: number;
  color: string;
  note?: string;
}

export function HBarChart({ items, ariaLabel }: { items: HBarItem[]; ariaLabel: string }) {
  const f = useFmt();
  const [hover, setHover] = useState<number | null>(null);
  const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const hasNeg = items.some((i) => i.value < 0);
  // With negatives, zero sits at a proportional point so losses extend left.
  const minV = Math.min(0, ...items.map((i) => i.value));
  const maxV = Math.max(0, ...items.map((i) => i.value));
  const span = maxV - minV || maxAbs;
  const zeroPct = hasNeg ? ((0 - minV) / span) * 100 : 0;

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3">
      {items.map((it, k) => {
        const w = (Math.abs(it.value) / span) * 100;
        const left = it.value < 0 ? zeroPct - w : zeroPct;
        return (
          <div
            key={it.label}
            onPointerEnter={() => setHover(k)}
            onPointerLeave={() => setHover(null)}
            className={`transition-opacity ${hover !== null && hover !== k ? "opacity-60" : ""}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink-2">{it.label}</span>
              <span className={`tnum font-semibold ${it.value < -0.005 ? "text-loss" : "text-ink"}`}>{f.money(it.value)}</span>
            </div>
            <div className="relative h-3.5 rounded bg-surface-2">
              {hasNeg && <span className="absolute inset-y-0 w-px bg-[var(--axis)]" style={{ left: `${zeroPct}%` }} />}
              <span
                className="absolute inset-y-0 rounded"
                style={{ left: `${left}%`, width: `${Math.max(w, it.value === 0 ? 0 : 0.8)}%`, background: it.color }}
              />
            </div>
            {it.note && hover === k && <p className="mt-1 text-xs text-muted">{it.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Break-even vs proposed price ruler                                */
/* ------------------------------------------------------------------ */

export function PriceRuler({
  costPerUnit,
  breakEven,
  proposed,
}: {
  costPerUnit: number;
  breakEven: number;
  proposed: number;
}) {
  const f = useFmt();
  const hi = Math.max(breakEven * 1.6, proposed * 1.15, costPerUnit * 1.2, 1);
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / hi) * 100))}%`;
  const beP = (breakEven / hi) * 100;
  const band = Math.max(0.8, beP * 0.03);
  const markers = [
    { v: costPerUnit, label: "Cost / unit", cls: "bg-info-mark", above: false },
    { v: breakEven, label: "Break-even", cls: "bg-warn-mark", above: true },
  ];
  return (
    <div
      className="pt-10 pb-24"
      role="img"
      aria-label={`Price ruler: cost per unit ${f.money(costPerUnit)}, break-even ${f.money(breakEven)}, your price ${f.money(proposed)}.`}
    >
      <div className="relative h-4">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span className="h-full bg-loss-mark/70" style={{ width: `${Math.max(0, beP - band)}%` }} />
          <span className="h-full bg-warn-mark" style={{ width: `${band * 2}%` }} />
          <span className="h-full flex-1 bg-profit-mark/75" />
        </div>
        {markers.map((mk) => (
          <div key={mk.label} className="absolute top-0 -translate-x-1/2" style={{ left: pos(mk.v) }}>
            <span className={`block h-4 w-0.5 ${mk.cls}`} />
            <span
              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-tight text-ink-2 ${
                mk.above ? "bottom-6" : "top-5"
              }`}
            >
              {mk.label}
              <br />
              <b className="tnum text-ink">{f.money(mk.v)}</b>
            </span>
          </div>
        ))}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(proposed) }}>
          <span className="block h-6 w-6 rounded-full border-[3px] border-surface bg-ink shadow" />
          <span className="absolute top-16 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-center text-[11px] font-semibold text-surface">
            Your price {f.money(proposed)}
          </span>
        </div>
      </div>
    </div>
  );
}
