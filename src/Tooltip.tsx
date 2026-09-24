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
 * to the right of the point, or to the left when there is no room, and never leaves the plot.
 */
export function Tooltip({ point, rows, x, y, width, height, fontSize }: TooltipProps) {
  const lineHeight = fontSize * 1.5;
  const padding = fontSize;
  const lines = [point.label, ...rows.map(([label, value]) => `${label}  ${value}`)];
  if (point.description) lines.push(point.description);
  const cardWidth = Math.max(...lines.map((line) => line.length)) * fontSize * CHARACTER_WIDTH + padding * 2;
  const cardHeight = lines.length * lineHeight + padding * 1.2;
  const left = x + OFFSET + cardWidth <= width - EDGE ? x + OFFSET : Math.max(EDGE, x - OFFSET - cardWidth);
  const top = Math.max(EDGE, Math.min(y - cardHeight / 2, height - cardHeight - EDGE));
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
