import type { AxisOptions } from "./types.js";

export type AxisScale = {
  domain: readonly [number, number];
  ticks: number[];
};

/** The range an axis covers and the values it labels. */
export function axisScale(values: readonly number[], axis: AxisOptions): AxisScale {
  const domain = axisDomain(values, axis);
  const requested = axis.ticks ?? 5;
  if (!Number.isInteger(requested) || requested < 2 || requested > 10) {
    throw new Error("Axis ticks must be an integer between 2 and 10.");
  }
  return axis.nice ? niceScale(values, axis, domain, requested) : { domain, ticks: evenTicks(domain, requested) };
}

function axisDomain(values: readonly number[], axis: AxisOptions): readonly [number, number] {
  if (axis.domain) {
    const [minimum, maximum] = axis.domain;
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      throw new Error(`${axis.label} axis domain must contain two finite, increasing values.`);
    }
    return axis.domain;
  }

  const dataMinimum = values.length > 0 ? Math.min(...values) : 0;
  const dataMaximum = values.length > 0 ? Math.max(...values) : 1;
  if (dataMinimum === dataMaximum) {
    const padding = Math.max(Math.abs(dataMinimum) * 0.1, 1);
    return [
      axis.includeZero ? Math.min(dataMinimum - padding, 0) : dataMinimum - padding,
      axis.includeZero ? Math.max(dataMaximum + padding, 0) : dataMaximum + padding,
    ];
  }
  const padding = (dataMaximum - dataMinimum) * 0.06;
  return [
    axis.includeZero ? Math.min(dataMinimum - padding, 0) : dataMinimum - padding,
    axis.includeZero ? Math.max(dataMaximum + padding, 0) : dataMaximum + padding,
  ];
}

/** `requested` ticks splitting the domain evenly, ends included. */
function evenTicks(domain: readonly [number, number], requested: number): number[] {
  const [minimum, maximum] = domain;
  return Array.from(
    { length: requested },
    (_, index) => minimum + ((maximum - minimum) * index) / (requested - 1),
  );
}

/**
 * Ticks on one round step, about `requested` of them. An explicit domain is kept as given;
 * an inferred one is rounded out to whole steps, after dropping any padding that crossed zero
 * when zero is included, so all-positive data starts exactly at zero.
 */
function niceScale(
  values: readonly number[],
  axis: AxisOptions,
  [low, high]: readonly [number, number],
  requested: number,
): AxisScale {
  if (!axis.domain && axis.includeZero && values.length > 0) {
    const dataMinimum = Math.min(...values);
    const dataMaximum = Math.max(...values);
    if (dataMinimum >= 0 && dataMaximum > 0) low = 0;
    if (dataMaximum <= 0 && dataMinimum < 0) high = 0;
  }
  // One step for both the domain and the ticks, so an inferred domain ends on ticks.
  const step = niceStep((high - low) / (requested - 1));
  const start = axis.domain ? Math.ceil(round(low / step)) : Math.floor(round(low / step));
  const end = axis.domain ? Math.floor(round(high / step)) : Math.ceil(round(high / step));
  return {
    domain: axis.domain ?? [round(start * step), round(end * step)],
    ticks: Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => round((start + index) * step)),
  };
}

/** The round step (1, 2, 2.5 or 5 times a power of ten) closest to `raw` on a log scale. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  let best = power;
  for (const multiple of [2, 2.5, 5, 10]) {
    const candidate = multiple * power;
    if (Math.abs(Math.log(candidate / raw)) < Math.abs(Math.log(best / raw))) best = candidate;
  }
  return round(best);
}

/** Strips floating-point noise such as 0.30000000000000004. */
function round(value: number): number {
  return Number(value.toPrecision(12));
}
