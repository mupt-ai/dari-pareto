import type { AxisOptions } from "./types.js";

export type AxisScale = {
  domain: readonly [number, number];
  ticks: number[];
  /** Where a value sits along the axis: 0 at the domain's start, 1 at its end. */
  position: (value: number) => number;
};

/** Share of a log axis kept at its start for values at or below zero, which it cannot place. */
const ZERO_BAND = 0.06;
/** Tick multiples within each decade of a log axis, from sparse to dense. */
const LOG_MULTIPLES = [[1], [1, 2, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]] as const;

/** The range an axis covers, the values it labels, and where values sit along it. */
export function axisScale(values: readonly number[], axis: AxisOptions): AxisScale {
  const requested = axis.ticks ?? 5;
  if (axis.scale === "log") {
    checkTicks(requested);
    return logScale(values, axis, requested);
  }
  const domain = axisDomain(values, axis);
  checkTicks(requested);
  const { ticks, domain: shown } = axis.nice
    ? niceScale(values, axis, domain, requested)
    : { domain, ticks: evenTicks(domain, requested) };
  const [start, end] = shown;
  return { domain: shown, ticks, position: (value) => (value - start) / (end - start) };
}

function checkTicks(requested: number): void {
  if (!Number.isInteger(requested) || requested < 2 || requested > 10) {
    throw new Error("Axis ticks must be an integer between 2 and 10.");
  }
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
): Pick<AxisScale, "domain" | "ticks"> {
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

/**
 * A log axis. Ticks fall on round values within each decade (1, 10, 100; or 1, 2, 5, 10, …;
 * or every whole multiple), whichever gives about `requested` of them, or on a round linear
 * step when the data spans too little of a decade for any. `nice` rounds an inferred domain out
 * to a round value (1, 1.2, 1.5, 2, 2.5, 3, … times a power of ten). Values at or below zero, which a log scale cannot
 * place, sit on a zero tick at the axis start, in a short band of their own.
 */
function logScale(values: readonly number[], axis: AxisOptions, requested: number): AxisScale {
  const positive = values.filter((value) => value > 0);
  const zeros = values.some((value) => value <= 0);
  let [low, high] = axis.domain ?? paddedLogDomain(positive);
  if (!(low > 0) || !Number.isFinite(high) || low >= high) {
    throw new Error(`${axis.label} axis domain must contain two positive, increasing values.`);
  }
  if (axis.nice && !axis.domain) {
    // Round out on the same terms the ticks use: a linear step inside a fraction of a decade,
    // otherwise whole multiples of a power of ten.
    const step = logTicks(low, high, requested).step;
    low = step ? round(Math.floor(round(low / step)) * step) : roundLog(low, -1);
    high = step ? round(Math.ceil(round(high / step)) * step) : roundLog(high, 1);
  }
  const { ticks } = logTicks(low, high, requested);
  const band = zeros ? ZERO_BAND : 0;
  const from = Math.log10(low);
  const span = Math.log10(high) - from;
  return {
    domain: [low, high],
    ticks: zeros ? [0, ...ticks] : ticks,
    position: (value) => (value <= 0 ? 0 : band + ((1 - band) * (Math.log10(value) - from)) / span),
  };
}

/** The positive values' range, widened by a small share of its decades on each side. */
function paddedLogDomain(values: readonly number[]): readonly [number, number] {
  if (values.length === 0) return [1, 10];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return [minimum / 2, maximum * 2];
  const factor = 10 ** (0.04 * Math.log10(maximum / minimum));
  return [minimum / factor, maximum * factor];
}

/** Where a log domain may end within a decade: fine near 1, where a decade is widest. */
const LOG_EDGES = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];

/** `value` rounded down or up (`direction` -1 or 1) to one of `LOG_EDGES` in its decade. */
function roundLog(value: number, direction: 1 | -1): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const mantissa = round(value / power);
  const edge =
    direction < 0
      ? [...LOG_EDGES].reverse().find((candidate) => candidate <= mantissa)
      : LOG_EDGES.find((candidate) => candidate >= mantissa);
  return round((edge ?? 1) * power);
}

/** A log axis's ticks, and the linear step they use when the domain is too narrow for decades. */
function logTicks(low: number, high: number, requested: number): { ticks: number[]; step?: number } {
  const within = (multiples: readonly number[]) => {
    const ticks: number[] = [];
    for (let power = Math.floor(Math.log10(low)); power <= Math.floor(Math.log10(high)); power++) {
      for (const multiple of multiples) {
        const tick = round(multiple * 10 ** power);
        if (tick >= low * (1 - 1e-9) && tick <= high * (1 + 1e-9)) ticks.push(tick);
      }
    }
    return ticks;
  };
  for (const multiples of LOG_MULTIPLES) {
    const ticks = within(multiples);
    if (ticks.length >= requested - 1) return { ticks };
  }
  const densest = within(LOG_MULTIPLES[LOG_MULTIPLES.length - 1] ?? []);
  if (densest.length >= 3) return { ticks: densest };
  // Too little of a decade for round multiples: ticks on a round linear step instead.
  const step = niceStep((high - low) / (requested - 1));
  const ticks: number[] = [];
  for (let index = Math.ceil(round(low / step)); index * step <= high * (1 + 1e-9); index++) {
    ticks.push(round(index * step));
  }
  return { ticks, step };
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
