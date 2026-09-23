export type Box = { x: number; y: number; width: number; height: number };

export type PlacedLabel = { id: string; x: number; y: number; anchor: "start" | "middle" | "end" };

/** A round step (1, 2, 2.5 or 5 times a power of ten) at least as large as `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((multiple) => multiple * power >= raw * (1 - 1e-9)) ?? 10) * power;
}

/** Widens a domain outward to whole multiples of a round step. */
export function niceDomain(
  domain: readonly [number, number],
  requested: number,
): readonly [number, number] {
  const step = niceStep((domain[1] - domain[0]) / requested);
  return [Math.floor(domain[0] / step) * step, Math.ceil(domain[1] / step) * step];
}

/** Round tick values inside the domain, about `requested` of them. */
export function niceTicks(domain: readonly [number, number], requested: number): number[] {
  const step = niceStep((domain[1] - domain[0]) / requested);
  const ticks: number[] = [];
  for (let index = Math.ceil(domain[0] / step - 1e-9); index * step <= domain[1] + step * 1e-9; index++) {
    ticks.push(Number((index * step).toPrecision(12)));
  }
  return ticks;
}

function overlaps(a: Box, b: Box, pad = 2): boolean {
  return (
    a.x < b.x + b.width + pad &&
    b.x < a.x + a.width + pad &&
    a.y < b.y + b.height + pad &&
    b.y < a.y + a.height + pad
  );
}

/**
 * Greedy label placement. Labels are placed in the order given; each tries above, right,
 * left and below its point, and takes the first spot inside `bounds` that covers no marker
 * and no earlier label. A label that fits nowhere is left out.
 */
export function placeLabels(
  labels: readonly { id: string; x: number; y: number; text: string }[],
  markers: readonly { x: number; y: number; radius: number }[],
  bounds: Box,
  fontSize: number,
): PlacedLabel[] {
  const charWidth = fontSize * 0.62;
  const height = fontSize * 1.2;
  const gap = 7;
  const taken: Box[] = markers.map((marker) => ({
    x: marker.x - marker.radius,
    y: marker.y - marker.radius,
    width: marker.radius * 2,
    height: marker.radius * 2,
  }));
  const placed: PlacedLabel[] = [];
  for (const label of labels) {
    const width = label.text.length * charWidth;
    const baseline = height * 0.78;
    const spots: [Box, PlacedLabel][] = [
      [
        { x: label.x - width / 2, y: label.y - gap - height, width, height },
        { id: label.id, x: label.x, y: label.y - gap - height + baseline, anchor: "middle" },
      ],
      [
        { x: label.x + gap, y: label.y - height / 2, width, height },
        { id: label.id, x: label.x + gap, y: label.y - height / 2 + baseline, anchor: "start" },
      ],
      [
        { x: label.x - gap - width, y: label.y - height / 2, width, height },
        { id: label.id, x: label.x - gap, y: label.y - height / 2 + baseline, anchor: "end" },
      ],
      [
        { x: label.x - width / 2, y: label.y + gap, width, height },
        { id: label.id, x: label.x, y: label.y + gap + baseline, anchor: "middle" },
      ],
    ];
    for (const [box, spot] of spots) {
      const inside =
        box.x >= bounds.x &&
        box.y >= bounds.y &&
        box.x + box.width <= bounds.x + bounds.width &&
        box.y + box.height <= bounds.y + bounds.height;
      if (inside && !taken.some((other) => overlaps(box, other))) {
        taken.push(box);
        placed.push(spot);
        break;
      }
    }
  }
  return placed;
}
