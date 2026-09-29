export type Box = { x: number; y: number; width: number; height: number };

type Point = { x: number; y: number };

export type PlacedLabel = {
  id: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
};

/** Approximate advance of one character of a monospace font, in ems. */
export const CHARACTER_WIDTH = 0.62;
/** Space between a point's center and its label. */
const GAP = 7;
/**
 * Spots around a point in order of preference: the label's text anchor across it, and its
 * position along it. Above, beside and below come first, then the four diagonals.
 */
const SPOTS = [
  ["middle", "above"],
  ["start", "level"],
  ["end", "level"],
  ["middle", "below"],
  ["start", "above"],
  ["end", "above"],
  ["start", "below"],
  ["end", "below"],
] as const;

function overlaps(a: Box, b: Box, padding = 2): boolean {
  return (
    a.x < b.x + b.width + padding &&
    b.x < a.x + a.width + padding &&
    a.y < b.y + b.height + padding &&
    b.y < a.y + a.height + padding
  );
}

/** Whether the segment from `from` to `to` passes through `box` (Liang–Barsky clipping). */
function crosses(box: Box, from: Point, to: Point): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [
    [-dx, from.x - box.x],
    [dx, box.x + box.width - from.x],
    [-dy, from.y - box.y],
    [dy, box.y + box.height - from.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

/** How far `point` is from the nearest edge of `box`; zero inside it. */
function distanceTo(box: Box, point: Point): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

function inside(box: Box, bounds: Box): boolean {
  return (
    box.x >= bounds.x &&
    box.y >= bounds.y &&
    box.x + box.width <= bounds.x + bounds.width &&
    box.y + box.height <= bounds.y + bounds.height
  );
}

/**
 * Greedy label placement. Labels are placed in the order given; each tries the `SPOTS` around
 * its point and takes the first inside `bounds` that covers no marker and no label placed
 * before it, and that sits nearer its own point than any other, so no label reads as another
 * point's; it prefers a spot no line runs through. A label that fits nowhere is left out: it
 * still shows on hover, and hiding a point under a label would be worse.
 */
export function placeLabels(
  labels: readonly (Point & { id: string; text: string })[],
  {
    markers,
    lines = [],
    bounds,
    fontSize,
  }: {
    markers: readonly (Point & { radius: number })[];
    /** Polylines, such as the frontier, that labels should keep off. */
    lines?: readonly (readonly Point[])[];
    bounds: Box;
    fontSize: number;
  },
): PlacedLabel[] {
  const height = fontSize * 1.2;
  const baseline = height * 0.78;
  const taken: Box[] = markers.map((marker) => ({
    x: marker.x - marker.radius,
    y: marker.y - marker.radius,
    width: marker.radius * 2,
    height: marker.radius * 2,
  }));
  const segments = lines.flatMap((line) =>
    line.slice(1).map((to, index) => [line[index] as Point, to] as const),
  );
  const placed: PlacedLabel[] = [];
  for (const { id, x, y, text } of labels) {
    const width = text.length * fontSize * CHARACTER_WIDTH;
    const spots = SPOTS.map(([across, along]): [Box, PlacedLabel] => {
      const left = across === "middle" ? x - width / 2 : across === "start" ? x + GAP : x - GAP - width;
      const top = along === "above" ? y - GAP - height : along === "level" ? y - height / 2 : y + GAP;
      const anchorX = across === "middle" ? x : across === "start" ? x + GAP : x - GAP;
      return [{ x: left, y: top, width, height }, { id, x: anchorX, y: top + baseline, anchor: across }];
    });
    const free = ([box]: [Box, PlacedLabel]) =>
      inside(box, bounds) && !taken.some((other) => overlaps(box, other));
    const clear = ([box]: [Box, PlacedLabel]) =>
      !segments.some(([from, to]) => crosses(box, from, to));
    const own = (candidate: [Box, PlacedLabel]) => {
      const [box] = candidate;
      const distance = distanceTo(box, { x, y });
      return !markers.some(
        (marker) =>
          (marker.x !== x || marker.y !== y) && distanceTo(box, marker) < distance,
      );
    };
    const usable = (candidate: [Box, PlacedLabel]) => free(candidate) && own(candidate);
    const spot = spots.find((candidate) => usable(candidate) && clear(candidate)) ?? spots.find(usable);
    if (!spot) continue;
    taken.push(spot[0]);
    placed.push(spot[1]);
  }
  return placed;
}
