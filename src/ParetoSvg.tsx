import type { CSSProperties, KeyboardEvent } from "react";

import { paretoFrontier, validatePoints } from "./frontier.js";
import { niceDomain, niceTicks, placeLabels } from "./layout.js";
import type { AxisOptions, ParetoPlotProps, ParetoPoint } from "./types.js";

const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 290;
const MARGIN = { top: 45, right: 36, bottom: 56, left: 54 } as const;
/** Top margin when neither the title nor the legend is drawn. */
const BARE_TOP = 16;
const MINT_GLOW = "rgba(142, 230, 189, .7)";

const baseStyle = {
  display: "block",
  width: "100%",
  height: "auto",
  background: "var(--pareto-background, #09100f)",
  color: "var(--pareto-foreground, #eef4ed)",
  fontFamily: "var(--pareto-font-family, 'JetBrains Mono', ui-monospace, monospace)",
  overflow: "visible",
} satisfies CSSProperties;

const chartStyles = `
  .pareto-point { cursor: pointer; outline: none; }
  .pareto-point circle { stroke: var(--pareto-background, #09100f); stroke-width: 2; transition: .2s; }
  .pareto-point.colored circle { stroke: var(--pareto-point-color); }
  .pareto-point-label { opacity: 0; pointer-events: none; transition: .2s; }
  .pareto-point-label.visible { opacity: 1; }
  .pareto-labels.dimmed .pareto-point-label.visible { opacity: .4; }
  .pareto-labels.dimmed .pareto-point-label.active { opacity: 1; }
  .pareto-point:hover circle, .pareto-point:focus circle, .pareto-point.selected circle {
    fill: var(--pareto-point-color, var(--pareto-frontier, #8ee6bd));
    stroke: var(--pareto-point-color, var(--pareto-frontier, #8ee6bd));
    filter: drop-shadow(0 0 5px var(--pareto-glow, ${MINT_GLOW}));
  }
  .pareto-point.colored:hover circle, .pareto-point.colored:focus circle, .pareto-point.colored.selected circle {
    filter: drop-shadow(0 0 5px var(--pareto-glow, color-mix(in srgb, var(--pareto-point-color) 70%, transparent)));
  }
  .pareto-point:hover .pareto-point-label, .pareto-point:focus .pareto-point-label, .pareto-point.selected .pareto-point-label { opacity: 1; }
`;

function defaultFormat(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function autoDomain(values: readonly number[], axis: AxisOptions): readonly [number, number] {
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
  // With zero included, padding never pushes the axis past zero: all-positive data starts at 0.
  return [
    axis.includeZero ? Math.min(dataMinimum >= 0 ? 0 : dataMinimum - padding, 0) : dataMinimum - padding,
    axis.includeZero ? Math.max(dataMaximum <= 0 ? 0 : dataMaximum + padding, 0) : dataMaximum + padding,
  ];
}

function axisDomain(values: readonly number[], axis: AxisOptions): readonly [number, number] {
  const domain = autoDomain(values, axis);
  return axis.nice && !axis.domain ? niceDomain(domain, axis.ticks ?? 5) : domain;
}

function axisTicks(domain: readonly [number, number], requested = 5, nice = false): number[] {
  if (!Number.isInteger(requested) || requested < 2 || requested > 10) {
    throw new Error("Axis ticks must be an integer between 2 and 10.");
  }
  if (nice) return niceTicks(domain, requested);
  const [minimum, maximum] = domain;
  return Array.from(
    { length: requested },
    (_, index) => minimum + ((maximum - minimum) * index) / (requested - 1),
  );
}

function pointDescription(
  point: ParetoPoint,
  xAxis: AxisOptions,
  yAxis: AxisOptions,
  efficient: boolean,
): string {
  const formatX = xAxis.format ?? defaultFormat;
  const formatY = yAxis.format ?? defaultFormat;
  const values = `${xAxis.label}: ${formatX(point.x)}; ${yAxis.label}: ${formatY(point.y)}`;
  return [point.label, values, efficient ? "Pareto-efficient" : "Dominated", point.description]
    .filter(Boolean)
    .join(". ");
}

type ParetoSvgProps = ParetoPlotProps & {
  focusedId?: string | null;
  hoveredId?: string | null;
  onFocusedIdChange?: (id: string | null) => void;
  onHoveredIdChange?: (id: string | null) => void;
};

export function ParetoSvg({
  points,
  xAxis,
  yAxis,
  mode = "interactive",
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  title = "Pareto Frontier",
  description,
  selectedId = null,
  onSelect,
  showLegend = true,
  showPointLabels = "none",
  showTitle = true,
  showTooltip = true,
  textScale = 1,
  className,
  style,
  focusedId = null,
  hoveredId = null,
  onFocusedIdChange,
  onHoveredIdChange,
}: ParetoSvgProps) {
  validatePoints(points);
  const activeId = hoveredId ?? focusedId;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240) {
    throw new Error("Pareto plot width and height must be finite and at least 320 × 240.");
  }
  if (!Number.isFinite(textScale) || textScale <= 0) {
    throw new Error("Pareto plot text scale must be a positive number.");
  }
  const size = (base: number) => base * textScale;

  const frontier = paretoFrontier(points, {
    xObjective: xAxis.objective,
    yObjective: yAxis.objective,
  });
  const frontierIds = new Set(frontier.map((point) => point.id));
  const xDomain = axisDomain(
    points.map((point) => point.x),
    xAxis,
  );
  const yDomain = axisDomain(
    points.map((point) => point.y),
    yAxis,
  );
  const xTicks = axisTicks(xDomain, xAxis.ticks, xAxis.nice);
  const yTicks = axisTicks(yDomain, yAxis.ticks, yAxis.nice);
  const top = showTitle || showLegend ? MARGIN.top : BARE_TOP;
  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(1, height - top - MARGIN.bottom);
  const scaleX = (value: number) =>
    MARGIN.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const scaleY = (value: number) =>
    top + plotHeight - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
  const formatX = xAxis.format ?? defaultFormat;
  const formatY = yAxis.format ?? defaultFormat;
  const interactive = mode === "interactive";
  const fullDescription =
    description ??
    `${points.length} points. ${frontier.length} ${frontier.length === 1 ? "point is" : "points are"} Pareto-efficient.`;

  const activate = (point: ParetoPoint) => {
    if (!interactive) return;
    onSelect?.(point);
  };
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, point: ParetoPoint) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate(point);
  };

  // Resting labels, frontier first, each placed where it covers no marker and no other label.
  const labelSize = size(8);
  const wanted = points
    .filter(
      (point) =>
        showPointLabels === "all" || (showPointLabels === "frontier" && frontierIds.has(point.id)),
    )
    .sort((left, right) => Number(frontierIds.has(right.id)) - Number(frontierIds.has(left.id)));
  const placed = new Map(
    placeLabels(
      wanted.map((point) => ({ id: point.id, x: scaleX(point.x), y: scaleY(point.y), text: point.label })),
      points.map((point) => ({ x: scaleX(point.x), y: scaleY(point.y), radius: 5 })),
      { x: MARGIN.left, y: top, width: plotWidth, height: plotHeight },
      labelSize,
    ).map((label) => [label.id, label]),
  );
  const active = interactive ? points.find((point) => point.id === activeId) : undefined;
  const tooltip = showTooltip && active ? tooltipFor(active) : null;

  function tooltipFor(point: ParetoPoint) {
    const rows: [string, string][] = [
      [yAxis.label, formatY(point.y)],
      [xAxis.label, formatX(point.x)],
    ];
    const fontSize = size(10);
    const charWidth = fontSize * 0.62;
    const lineHeight = fontSize * 1.5;
    const padding = fontSize;
    const lines = [point.label, ...rows.map(([label, value]) => `${label}  ${value}`)];
    if (point.description) lines.push(point.description);
    const boxWidth = Math.max(...lines.map((line) => line.length)) * charWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 1.2;
    const x = scaleX(point.x);
    const y = scaleY(point.y);
    const left = x + 14 + boxWidth <= width - 4 ? x + 14 : Math.max(4, x - 14 - boxWidth);
    const boxTop = Math.min(Math.max(4, y - boxHeight / 2), height - boxHeight - 4);
    return { point, rows, fontSize, lineHeight, padding, boxWidth, boxHeight, left, top: boxTop };
  }

  return (
    <svg
      aria-label={title}
      className={className}
      height={height}
      role={interactive ? "group" : "img"}
      style={{ ...baseStyle, ...style }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{chartStyles}</style>
      <title>{title}</title>
      <desc>{fullDescription}</desc>

      {showTitle ? (
        <text
          fill="currentColor"
          fontSize={size(14)}
          fontWeight="700"
          letterSpacing="0.04em"
          x={MARGIN.left}
          y="24"
        >
          {title}
        </text>
      ) : null}

      {showLegend ? (
        <g
          aria-hidden="true"
          fontSize={size(9)}
          transform={`translate(${width - MARGIN.right - 150 * textScale} 20)`}
        >
          <circle cx="0" cy="0" fill="var(--pareto-background, #09100f)" r="3" stroke="var(--pareto-frontier, #8ee6bd)" />
          <text fill="var(--pareto-muted, #91a39b)" x="9" y="3">
            Selected
          </text>
          <circle cx={75 * textScale} cy="0" fill="var(--pareto-frontier, #8ee6bd)" r="3" />
          <text fill="var(--pareto-muted, #91a39b)" x={84 * textScale} y="3">
            Pareto-efficient
          </text>
        </g>
      ) : null}

      <g aria-hidden="true">
        {yTicks.filter((tick) => tick !== 0).map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                stroke="var(--pareto-grid, #263631)"
                strokeWidth="1"
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y}
                y2={y}
              />
              <text
                dominantBaseline="middle"
                fill="var(--pareto-muted, #91a39b)"
                fontSize={size(10)}
                textAnchor="end"
                x={MARGIN.left - 10}
                y={y}
              >
                {formatY(tick)}
              </text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = scaleX(tick);
          return (
            <text
              key={`x-${tick}`}
              fill="var(--pareto-muted, #91a39b)"
              fontSize={size(9)}
              textAnchor="middle"
              x={x}
              y={height - MARGIN.bottom + 20}
            >
              {formatX(tick)}
            </text>
          );
        })}
      </g>

      {frontier.length > 1 ? (
        <polyline
          aria-hidden="true"
          fill="none"
          points={frontier.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" ")}
          stroke="var(--pareto-frontier-line, var(--pareto-frontier, #8ee6bd))"
          opacity="0.7"
          strokeDasharray="4 5"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      <g>
        {points.map((point) => {
          const efficient = frontierIds.has(point.id);
          const selected = point.id === selectedId || point.id === activeId;
          const fill = point.color
            ? efficient
              ? point.color
              : "var(--pareto-background, #09100f)"
            : efficient
              ? "var(--pareto-frontier, #8ee6bd)"
              : "var(--pareto-point, #60736b)";
          return (
            <g
              aria-label={interactive ? pointDescription(point, xAxis, yAxis, efficient) : undefined}
              className={`pareto-point${selected ? " selected" : ""}${efficient ? " efficient" : ""}${point.color ? " colored" : ""}`}
              key={point.id}
              onBlur={interactive ? () => onFocusedIdChange?.(null) : undefined}
              onClick={interactive ? () => activate(point) : undefined}
              onFocus={interactive ? () => onFocusedIdChange?.(point.id) : undefined}
              onKeyDown={interactive ? (event) => handleKeyDown(event, point) : undefined}
              onMouseEnter={interactive ? () => onHoveredIdChange?.(point.id) : undefined}
              onMouseLeave={interactive ? () => onHoveredIdChange?.(null) : undefined}
              role={interactive ? "button" : undefined}
              style={point.color ? ({ "--pareto-point-color": point.color } as CSSProperties) : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              <circle
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                fill={fill}
                r={selected ? 8 : 5}
              >
                {!interactive ? <title>{pointDescription(point, xAxis, yAxis, efficient)}</title> : null}
              </circle>
            </g>
          );
        })}
      </g>

      <g aria-hidden="true" className={`pareto-labels${active ? " dimmed" : ""}`}>
        {points.map((point) => {
          const spot = placed.get(point.id);
          const isActive = point.id === active?.id;
          // A hovered point's label is shown by its card, or, without one, beside the point.
          if (isActive && tooltip) return null;
          const highlighted = isActive || point.id === selectedId;
          if (!spot && !highlighted) return null;
          const x = scaleX(point.x);
          const y = scaleY(point.y);
          return (
            <text
              className={`pareto-point-label visible${isActive ? " active" : ""}`}
              fill="var(--pareto-foreground, #eef4ed)"
              fontSize={labelSize}
              key={point.id}
              paintOrder="stroke"
              stroke="var(--pareto-background, #09100f)"
              strokeWidth="4"
              textAnchor={spot?.anchor ?? "middle"}
              x={spot?.x ?? x}
              y={spot?.y ?? y - 13}
            >
              {point.label}
            </text>
          );
        })}
      </g>

      {tooltip ? (
        <g aria-hidden="true" className="pareto-tooltip" pointerEvents="none">
          <rect
            fill="var(--pareto-tooltip-background, var(--pareto-background, #09100f))"
            height={tooltip.boxHeight}
            stroke="var(--pareto-grid, #263631)"
            width={tooltip.boxWidth}
            x={tooltip.left}
            y={tooltip.top}
          />
          <text
            fill="var(--pareto-foreground, #eef4ed)"
            fontSize={tooltip.fontSize}
            fontWeight="700"
            x={tooltip.left + tooltip.padding}
            y={tooltip.top + tooltip.padding * 0.6 + tooltip.lineHeight * 0.75}
          >
            {tooltip.point.label}
          </text>
          {tooltip.rows.map(([label, value], index) => {
            const y = tooltip.top + tooltip.padding * 0.6 + tooltip.lineHeight * (index + 1.75);
            return (
              <g fontSize={tooltip.fontSize} key={label}>
                <text fill="var(--pareto-muted, #91a39b)" x={tooltip.left + tooltip.padding} y={y}>
                  {label}
                </text>
                <text
                  fill="var(--pareto-foreground, #eef4ed)"
                  textAnchor="end"
                  x={tooltip.left + tooltip.boxWidth - tooltip.padding}
                  y={y}
                >
                  {value}
                </text>
              </g>
            );
          })}
          {tooltip.point.description ? (
            <text
              fill="var(--pareto-muted, #91a39b)"
              fontSize={tooltip.fontSize}
              x={tooltip.left + tooltip.padding}
              y={tooltip.top + tooltip.padding * 0.6 + tooltip.lineHeight * (tooltip.rows.length + 1.75)}
            >
              {tooltip.point.description}
            </text>
          ) : null}
        </g>
      ) : null}

      {points.length === 0 ? (
        <text
          fill="var(--pareto-muted, #91a39b)"
          fontSize={size(12)}
          textAnchor="middle"
          x={MARGIN.left + plotWidth / 2}
          y={top + plotHeight / 2}
        >
          NO DATA
        </text>
      ) : null}

      <text
        fill="var(--pareto-muted, #91a39b)"
        fontSize={size(11)}
        letterSpacing="0.04em"
        textAnchor="end"
        x={width - 4}
        y={height - 8}
      >
        {xAxis.label.toUpperCase()} →
      </text>
      <text
        fill="var(--pareto-muted, #91a39b)"
        fontSize={size(11)}
        letterSpacing="0.04em"
        textAnchor="middle"
        transform={`rotate(-90 16 ${top + plotHeight / 2})`}
        x="16"
        y={top + plotHeight / 2}
      >
        {yAxis.label.toUpperCase()}
      </text>
    </svg>
  );
}
