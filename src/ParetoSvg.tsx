import type { CSSProperties, KeyboardEvent } from "react";

import { paretoFrontier, validatePoints } from "./frontier.js";
import type { AxisOptions, ParetoPlotProps, ParetoPoint } from "./types.js";

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 380;
const MARGIN = { top: 48, right: 24, bottom: 66, left: 76 } as const;

const baseStyle = {
  display: "block",
  width: "100%",
  height: "auto",
  background: "var(--pareto-background, #09100f)",
  color: "var(--pareto-foreground, #eef4ed)",
  fontFamily: "var(--pareto-font-family, 'JetBrains Mono', ui-monospace, monospace)",
} satisfies CSSProperties;

function defaultFormat(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
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

function axisTicks(domain: readonly [number, number], requested = 5): number[] {
  if (!Number.isInteger(requested) || requested < 2 || requested > 10) {
    throw new Error("Axis ticks must be an integer between 2 and 10.");
  }
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
  const xTicks = axisTicks(xDomain, xAxis.ticks);
  const yTicks = axisTicks(yDomain, yAxis.ticks);
  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom);
  const scaleX = (value: number) =>
    MARGIN.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotWidth;
  const scaleY = (value: number) =>
    MARGIN.top + plotHeight - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * plotHeight;
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
  const handleKeyDown = (event: KeyboardEvent<SVGCircleElement>, point: ParetoPoint) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate(point);
  };

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
      <title>{title}</title>
      <desc>{fullDescription}</desc>

      <text
        fill="currentColor"
        fontSize="14"
        fontWeight="700"
        letterSpacing="0.04em"
        x={MARGIN.left}
        y="24"
      >
        {title}
      </text>

      {showLegend ? (
        <g aria-hidden="true" fontSize="10" transform={`translate(${width - MARGIN.right - 176} 20)`}>
          <circle cx="0" cy="0" fill="var(--pareto-frontier, #8ee6bd)" r="4" />
          <text fill="var(--pareto-muted, #91a39b)" x="9" y="3">
            EFFICIENT
          </text>
          <circle cx="90" cy="0" fill="var(--pareto-point, #60736b)" r="4" />
          <text fill="var(--pareto-muted, #91a39b)" x="99" y="3">
            DOMINATED
          </text>
        </g>
      ) : null}

      <g aria-hidden="true">
        {yTicks.map((tick) => {
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
                fontSize="10"
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
            <g key={`x-${tick}`}>
              <line
                stroke="var(--pareto-grid, #263631)"
                strokeWidth="1"
                x1={x}
                x2={x}
                y1={MARGIN.top}
                y2={height - MARGIN.bottom}
              />
              <text
                fill="var(--pareto-muted, #91a39b)"
                fontSize="10"
                textAnchor="middle"
                x={x}
                y={height - MARGIN.bottom + 20}
              >
                {formatX(tick)}
              </text>
            </g>
          );
        })}
      </g>

      {frontier.length > 1 ? (
        <polyline
          aria-hidden="true"
          fill="none"
          points={frontier.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" ")}
          stroke="var(--pareto-frontier, #8ee6bd)"
          strokeDasharray="5 5"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      <g>
        {points.map((point) => {
          const efficient = frontierIds.has(point.id);
          const selected = point.id === selectedId || point.id === activeId;
          const showLabel =
            showPointLabels === "all" ||
            (showPointLabels === "frontier" && efficient) ||
            selected ||
            (interactive && point.id === activeId);
          return (
            <g key={point.id}>
              <circle
                aria-label={interactive ? pointDescription(point, xAxis, yAxis, efficient) : undefined}
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                fill={
                  efficient
                    ? "var(--pareto-frontier, #8ee6bd)"
                    : "var(--pareto-point, #60736b)"
                }
                onBlur={interactive ? () => onFocusedIdChange?.(null) : undefined}
                onClick={interactive ? () => activate(point) : undefined}
                onFocus={interactive ? () => onFocusedIdChange?.(point.id) : undefined}
                onKeyDown={interactive ? (event) => handleKeyDown(event, point) : undefined}
                onMouseEnter={interactive ? () => onHoveredIdChange?.(point.id) : undefined}
                onMouseLeave={interactive ? () => onHoveredIdChange?.(null) : undefined}
                r={selected ? 8 : efficient ? 6 : 5}
                role={interactive ? "button" : undefined}
                stroke={selected ? "var(--pareto-foreground, #eef4ed)" : "none"}
                strokeWidth={selected ? 2 : 0}
                style={interactive ? { cursor: "pointer", outline: "none" } : undefined}
                tabIndex={interactive ? 0 : undefined}
              >
                {!interactive ? <title>{pointDescription(point, xAxis, yAxis, efficient)}</title> : null}
              </circle>
              {showLabel ? (
                <text
                  aria-hidden="true"
                  fill="var(--pareto-foreground, #eef4ed)"
                  fontSize="10"
                  paintOrder="stroke"
                  stroke="var(--pareto-background, #09100f)"
                  strokeWidth="4"
                  textAnchor="middle"
                  x={scaleX(point.x)}
                  y={scaleY(point.y) - (selected ? 13 : 11)}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      {points.length === 0 ? (
        <text
          fill="var(--pareto-muted, #91a39b)"
          fontSize="12"
          textAnchor="middle"
          x={MARGIN.left + plotWidth / 2}
          y={MARGIN.top + plotHeight / 2}
        >
          NO DATA
        </text>
      ) : null}

      <text
        fill="var(--pareto-muted, #91a39b)"
        fontSize="11"
        letterSpacing="0.04em"
        textAnchor="middle"
        x={MARGIN.left + plotWidth / 2}
        y={height - 12}
      >
        {xAxis.label.toUpperCase()}
      </text>
      <text
        fill="var(--pareto-muted, #91a39b)"
        fontSize="11"
        letterSpacing="0.04em"
        textAnchor="middle"
        transform={`rotate(-90 16 ${MARGIN.top + plotHeight / 2})`}
        x="16"
        y={MARGIN.top + plotHeight / 2}
      >
        {yAxis.label.toUpperCase()}
      </text>
    </svg>
  );
}
