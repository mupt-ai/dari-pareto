import { CHARACTER_WIDTH } from "./labels.js";
import type { ParetoPoint } from "./types.js";

/** Space between the point and the card, and between the card and the plot's edge. */
const OFFSET = 14;
const EDGE = 4;

type TooltipProps = {
  point: ParetoPoint;
  /** Label and formatted value of each axis. */
  rows: readonly (readonly [string, string])[];
  /** The point's center. */
  x: number;
  y: number;
  /** The plot's size; the card stays inside it. */
  width: number;
  height: number;
  fontSize: number;
};

/**
 * A card beside a point with its label, its value on each axis and its description. It sits
 * to the right of the point, or to the left when there is no room; on a plot too narrow for
 * either, above or below it. It never leaves the plot.
 */
export function Tooltip({ point, rows, x, y, width, height, fontSize }: TooltipProps) {
  const lineHeight = fontSize * 1.5;
  const padding = fontSize;
  const lines = [point.label, ...rows.map(([label, value]) => `${label}  ${value}`)];
  if (point.description) lines.push(point.description);
  const cardWidth = Math.max(...lines.map((line) => line.length)) * fontSize * CHARACTER_WIDTH + padding * 2;
  const cardHeight = lines.length * lineHeight + padding * 1.2;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
  const fitsRight = x + OFFSET + cardWidth <= width - EDGE;
  const fitsLeft = x - OFFSET - cardWidth >= EDGE;
  const beside = fitsRight || fitsLeft;
  const left = beside
    ? fitsRight
      ? x + OFFSET
      : x - OFFSET - cardWidth
    : clamp(x - cardWidth / 2, EDGE, width - cardWidth - EDGE);
  // Too wide to sit beside the point (a narrow plot): above it, or below when there is no room
  // above, so the point it describes stays in view.
  const top = beside
    ? clamp(y - cardHeight / 2, EDGE, height - cardHeight - EDGE)
    : y - OFFSET - cardHeight >= EDGE
      ? y - OFFSET - cardHeight
      : Math.min(y + OFFSET, height - cardHeight - EDGE);
  const baseline = (line: number) => top + padding * 0.6 + lineHeight * (line + 0.75);
  return (
    <g aria-hidden="true" className="pareto-tooltip" fontSize={fontSize} pointerEvents="none">
      <rect
        fill="var(--pareto-tooltip-background, var(--pareto-background, #09100f))"
        height={cardHeight}
        stroke="var(--pareto-grid, #263631)"
        width={cardWidth}
        x={left}
        y={top}
      />
      <text fill="var(--pareto-foreground, #eef4ed)" fontWeight="700" x={left + padding} y={baseline(0)}>
        {point.label}
      </text>
      {rows.map(([label, value], index) => (
        <g key={label}>
          <text fill="var(--pareto-muted, #91a39b)" x={left + padding} y={baseline(index + 1)}>
            {label}
          </text>
          <text
            fill="var(--pareto-foreground, #eef4ed)"
            textAnchor="end"
            x={left + cardWidth - padding}
            y={baseline(index + 1)}
          >
            {value}
          </text>
        </g>
      ))}
      {point.description ? (
        <text fill="var(--pareto-muted, #91a39b)" x={left + padding} y={baseline(rows.length + 1)}>
          {point.description}
        </text>
      ) : null}
    </g>
  );
}

/** The name's size relative to the values line under it. */
const NAME_SCALE = 1.1;
/**
 * Approximate advance of one character of a name, in ems: narrower than a monospace character,
 * as names are often set in a proportional face. The box keeps its left padding exact and takes
 * any error on its right.
 */
const NAME_CHARACTER_WIDTH = 0.57;

/** A point's label with its note in parentheses, as resting labels and screen readers give it. */
export function labelText(point: ParetoPoint): string {
  return point.note ? `${point.label} (${point.note})` : point.label;
}

type LabelTooltipProps = {
  point: ParetoPoint;
  /** The point's values on one line, such as "70.2% at $1.36". */
  value: string;
  /** The point's center. */
  x: number;
  y: number;
  /** The plot's size; the box stays inside it. */
  width: number;
  height: number;
  fontSize: number;
  /** Other points' centers, for `tooltipPlacement: "auto"`: the box takes a spot clear of them. */
  avoid?: readonly { x: number; y: number }[];
  /** Boxes already on the plot, such as a pinned label: the box never overlaps them. */
  keepClearOf?: readonly LabelBox[];
};

/** Where a label-style tooltip's box sits, and its size. */
export type LabelBox = { left: number; top: number; width: number; height: number };

/** How far apart two label boxes stay. */
const BOX_GAP = 6;

/** How far a point's center must sit outside the box for the box to count as clear of it. */
const CLEARANCE = 7;

/** The box's type sizes, from the tooltip's font size. */
function metrics(fontSize: number) {
  const nameSize = fontSize * NAME_SCALE;
  return { nameSize, padding: fontSize * 0.9, lineGap: fontSize * 1.6 };
}

/**
 * Where a label-style tooltip's box goes. It sits to the right of the point, or to the left when
 * there is no room; on a plot too narrow for either, above or below it. Given points to `avoid`
 * or boxes to `keepClearOf`, it takes the first spot around its point (beside, above, below, then
 * the corners) that covers none of those points and overlaps none of those boxes, or failing
 * that, the first that overlaps none of the boxes. It never leaves the plot.
 */
export function labelBox({ point, value, x, y, width, height, fontSize, avoid, keepClearOf }: LabelTooltipProps): LabelBox {
  const { nameSize, padding, lineGap } = metrics(fontSize);
  const textWidth = Math.max(
    labelText(point).length * nameSize * NAME_CHARACTER_WIDTH,
    value.length * fontSize * CHARACTER_WIDTH,
  );
  const boxWidth = textWidth + padding * 2;
  const boxHeight = nameSize * 0.75 + lineGap + padding * 2;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));
  const fitsRight = x + OFFSET + boxWidth <= width - EDGE;
  const fitsLeft = x - OFFSET - boxWidth >= EDGE;
  const beside = fitsRight || fitsLeft;
  const besideLeft = beside
    ? fitsRight
      ? x + OFFSET
      : x - OFFSET - boxWidth
    : clamp(x - boxWidth / 2, EDGE, width - boxWidth - EDGE);
  // Too wide to sit beside the point (a narrow plot): above it, or below when there is no room
  // above, so the point stays in view.
  const besideTop = beside
    ? clamp(y - boxHeight / 2, EDGE, height - boxHeight - EDGE)
    : y - OFFSET - boxHeight >= EDGE
      ? y - OFFSET - boxHeight
      : Math.min(y + OFFSET, height - boxHeight - EDGE);
  const boxes = keepClearOf ?? [];
  const place = { x, y, boxWidth, boxHeight, width, height };
  // Clear of the points and the boxes; else of the boxes alone; else of the boxes with the spots
  // pulled inside the plot; else a corner of the plot clear of the boxes. Only a plot too small
  // for two boxes falls through to beside.
  const spot =
    avoid || boxes.length
      ? (clearSpot({ ...place, avoid: avoid ?? [], boxes }) ??
        (boxes.length
          ? (clearSpot({ ...place, avoid: [], boxes }) ??
            clearSpot({ ...place, avoid: [], boxes, inside: true }) ??
            clearCorner({ ...place, boxes }))
          : undefined))
      : undefined;
  return { left: spot?.left ?? besideLeft, top: spot?.top ?? besideTop, width: boxWidth, height: boxHeight };
}

/** A box beside the point with its label, its note faint after it, over its values; see `labelBox`. */
export function LabelTooltip(props: LabelTooltipProps) {
  const { point, value, fontSize } = props;
  const { nameSize, padding, lineGap } = metrics(fontSize);
  const { left, top, width: boxWidth, height: boxHeight } = labelBox(props);
  const nameY = top + padding + nameSize * 0.75;
  return (
    <g aria-hidden="true" className="pareto-tooltip" fontSize={fontSize} pointerEvents="none">
      <rect
        fill="var(--pareto-tooltip-background, var(--pareto-background, #09100f))"
        height={boxHeight}
        stroke="var(--pareto-grid, #263631)"
        width={boxWidth}
        x={left}
        y={top}
      />
      <text
        fill="var(--pareto-foreground, #eef4ed)"
        fontFamily="var(--pareto-label-font-family, inherit)"
        fontSize={nameSize}
        fontWeight="600"
        x={left + padding}
        y={nameY}
      >
        {point.label}
        {point.note ? (
          <tspan fill="var(--pareto-muted, #91a39b)" fontSize={nameSize * 0.85} fontWeight="400">
            {` (${point.note})`}
          </tspan>
        ) : null}
      </text>
      <text fill="var(--pareto-muted, #91a39b)" x={left + padding} y={nameY + lineGap}>
        {value}
      </text>
    </g>
  );
}

/** Whether a box at (left, top) of the given size overlaps any of the boxes, with a gap between. */
function overlapsAny(left: number, top: number, boxWidth: number, boxHeight: number, boxes: readonly LabelBox[]): boolean {
  return boxes.some(
    (box) =>
      left < box.left + box.width + BOX_GAP &&
      left + boxWidth + BOX_GAP > box.left &&
      top < box.top + box.height + BOX_GAP &&
      top + boxHeight + BOX_GAP > box.top,
  );
}

/** The first corner of the plot where a box of the given size overlaps none of the boxes. */
function clearCorner({
  boxWidth,
  boxHeight,
  width,
  height,
  boxes,
}: {
  boxWidth: number;
  boxHeight: number;
  width: number;
  height: number;
  boxes: readonly LabelBox[];
}): { left: number; top: number } | undefined {
  const right = width - boxWidth - EDGE;
  const bottom = height - boxHeight - EDGE;
  return [
    { left: EDGE, top: EDGE },
    { left: right, top: EDGE },
    { left: EDGE, top: bottom },
    { left: right, top: bottom },
  ].find(({ left, top }) => !overlapsAny(left, top, boxWidth, boxHeight, boxes));
}

/**
 * The first spot around (x, y) for a box of the given size that stays inside the plot, covers
 * none of the `avoid` points, and overlaps none of the `boxes`: right, left, above, below, then
 * the four corners. With `inside`, a spot past the plot's edge is pulled back inside it rather
 * than passed over.
 */
function clearSpot({
  x,
  y,
  boxWidth,
  boxHeight,
  width,
  height,
  avoid,
  boxes,
  inside = false,
}: {
  x: number;
  y: number;
  boxWidth: number;
  boxHeight: number;
  width: number;
  height: number;
  avoid: readonly { x: number; y: number }[];
  boxes: readonly LabelBox[];
  inside?: boolean;
}): { left: number; top: number } | undefined {
  const right = x + OFFSET;
  const leftSide = x - OFFSET - boxWidth;
  const middle = y - boxHeight / 2;
  const centered = x - boxWidth / 2;
  const above = y - OFFSET - boxHeight;
  const below = y + OFFSET;
  const spots = [
    { left: right, top: middle },
    { left: leftSide, top: middle },
    { left: centered, top: above },
    { left: centered, top: below },
    { left: right, top: above },
    { left: right, top: below },
    { left: leftSide, top: above },
    { left: leftSide, top: below },
  ];
  const pull = (value: number, high: number) => Math.max(EDGE, Math.min(value, high));
  const placed = inside
    ? spots.map(({ left, top }) => ({ left: pull(left, width - boxWidth - EDGE), top: pull(top, height - boxHeight - EDGE) }))
    : spots;
  return placed.find(
    ({ left, top }) =>
      left >= EDGE &&
      top >= EDGE &&
      left + boxWidth <= width - EDGE &&
      top + boxHeight <= height - EDGE &&
      !avoid.some(
        (other) =>
          other.x > left - CLEARANCE &&
          other.x < left + boxWidth + CLEARANCE &&
          other.y > top - CLEARANCE &&
          other.y < top + boxHeight + CLEARANCE,
      ) &&
      !overlapsAny(left, top, boxWidth, boxHeight, boxes),
  );
}
