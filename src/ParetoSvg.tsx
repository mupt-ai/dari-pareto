import type { CSSProperties, KeyboardEvent } from "react";

import { axisScale } from "./axis.js";
import { paretoFrontier, validatePoints } from "./frontier.js";
import { placeLabels } from "./labels.js";
import { Tooltip } from "./Tooltip.js";
import type { AxisOptions, ParetoPlotProps, ParetoPoint } from "./types.js";

const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 290;
const MARGIN = { top: 45, right: 36, bottom: 56, left: 54 } as const;
/** The top margin when neither the title nor the legend is drawn. */
const BARE_TOP = 16;
/**
 * A colored dominated point is a ring. Its colored stroke reaches past its radius while a
 * filled point's background halo covers part of its own, so the ring is drawn smaller to keep
 * the filled, Pareto-efficient points the heavier mark at the same apparent size.
 */
const RING_RADIUS = 3.5;

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
  .pareto-point-label { opacity: 0; pointer-events: none; transition: .2s; }
  .pareto-point-label.visible { opacity: 1; }
  .pareto-point:hover circle, .pareto-point:focus circle, .pareto-point.selected circle {
    fill: var(--pareto-frontier, #8ee6bd); stroke: var(--pareto-frontier, #8ee6bd);
    filter: drop-shadow(0 0 5px var(--pareto-glow, rgba(142, 230, 189, .7)));
  }
  .pareto-point:hover .pareto-point-label, .pareto-point:focus .pareto-point-label, .pareto-point.selected .pareto-point-label { opacity: 1; }
`;

/** Only when a point has its own color: dominated points are rings, and hover keeps the color. */
const colorStyles = `
  .pareto-point.colored:not(.efficient) circle { stroke: var(--pareto-point-color); stroke-width: 1.5; }
  .pareto-point.colored:hover circle, .pareto-point.colored:focus circle, .pareto-point.colored.selected circle {
    fill: var(--pareto-point-color); stroke: var(--pareto-point-color);
    filter: drop-shadow(0 0 5px var(--pareto-glow, color-mix(in srgb, var(--pareto-point-color) 70%, transparent)));
  }
`;

/** Only with the tooltip: while it shows, the other labels step back. */
const tooltipStyles = `
  .pareto-point-label.visible.dimmed { opacity: .4; }
`;

function defaultFormat(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
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
  labelPlacement = "above",
  showTitle = true,
  showTooltip = false,
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
  const { domain: xDomain, ticks: xTicks } = axisScale(
    points.map((point) => point.x),
    xAxis,
  );
  const { domain: yDomain, ticks: yTicks } = axisScale(
    points.map((point) => point.y),
    yAxis,
  );
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
  const colored = points.some((point) => point.color);
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

  const labelSize = size(8);
  const labelled = (point: ParetoPoint) =>
    showPointLabels === "all" || (showPointLabels === "frontier" && frontierIds.has(point.id));
  // Automatic placement settles every resting label up front, frontier labels first.
  const placed =
    labelPlacement === "auto"
      ? new Map(
          placeLabels(
            points
              .filter(labelled)
              .sort((left, right) => Number(frontierIds.has(right.id)) - Number(frontierIds.has(left.id)))
              .map((point) => ({ id: point.id, x: scaleX(point.x), y: scaleY(point.y), text: point.label })),
            {
              markers: points.map((point) => ({ x: scaleX(point.x), y: scaleY(point.y), radius: 5 })),
              lines: [frontier.map((point) => ({ x: scaleX(point.x), y: scaleY(point.y) }))],
              bounds: { x: MARGIN.left, y: top, width: plotWidth, height: plotHeight },
              fontSize: labelSize,
            },
          ).map((label) => [label.id, label]),
        )
      : null;
  const tooltipPoint =
    showTooltip && interactive ? points.find((point) => point.id === activeId) : undefined;

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
      <style>{chartStyles + (colored ? colorStyles : "") + (showTooltip && interactive ? tooltipStyles : "")}</style>
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

      {showLegend && !colored ? (
        <g aria-hidden="true" fontSize={size(9)} transform={`translate(${width - MARGIN.right - size(150)} 20)`}>
          <circle cx="0" cy="0" fill="var(--pareto-background, #09100f)" r="3" stroke="var(--pareto-frontier, #8ee6bd)" />
          <text fill="var(--pareto-muted, #91a39b)" x={size(9)} y={size(3)}>
            Selected
          </text>
          <circle cx={size(75)} cy="0" fill="var(--pareto-frontier, #8ee6bd)" r="3" />
          <text fill="var(--pareto-muted, #91a39b)" x={size(84)} y={size(3)}>
            Pareto-efficient
          </text>
        </g>
      ) : null}
      {showLegend && colored ? (
        // With colored points, color names the point, so the legend explains fill and ring.
        <g aria-hidden="true" fontSize={size(9)} transform={`translate(${width - MARGIN.right - size(170)} 20)`}>
          <circle cx="0" cy="0" fill="var(--pareto-foreground, #eef4ed)" r="3" />
          <text fill="var(--pareto-muted, #91a39b)" x={size(9)} y={size(3)}>
            Pareto-efficient
          </text>
          <circle cx={size(105)} cy="0" fill="none" r="3" stroke="var(--pareto-foreground, #eef4ed)" />
          <text fill="var(--pareto-muted, #91a39b)" x={size(114)} y={size(3)}>
            Dominated
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
          const themeFill = efficient ? "var(--pareto-frontier, #8ee6bd)" : "var(--pareto-point, #60736b)";
          const ownFill = efficient ? point.color : "var(--pareto-background, #09100f)";
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
                fill={point.color ? ownFill : themeFill}
                r={selected ? 8 : point.color && !efficient ? RING_RADIUS : 5}
              >
                {!interactive ? <title>{pointDescription(point, xAxis, yAxis, efficient)}</title> : null}
              </circle>
            </g>
          );
        })}
      </g>

      <g aria-hidden="true">
        {points.map((point) => {
          // The tooltip carries the hovered point's label.
          if (point.id === tooltipPoint?.id) return null;
          const selected = point.id === selectedId || point.id === activeId;
          const spot = placed?.get(point.id);
          const resting = placed ? spot !== undefined : labelled(point);
          if (!resting && !selected) return null;
          return (
            <text
              className={`pareto-point-label visible${tooltipPoint ? " dimmed" : ""}`}
              fill="var(--pareto-foreground, #eef4ed)"
              fontSize={labelSize}
              key={point.id}
              paintOrder="stroke"
              stroke="var(--pareto-background, #09100f)"
              strokeWidth="4"
              textAnchor={spot?.anchor ?? "middle"}
              x={spot?.x ?? scaleX(point.x)}
              y={spot?.y ?? scaleY(point.y) - size(selected ? 13 : 11)}
            >
              {point.label}
            </text>
          );
        })}
      </g>

      {tooltipPoint ? (
        <Tooltip
          fontSize={size(10)}
          height={height}
          point={tooltipPoint}
          rows={[
            [yAxis.label, formatY(tooltipPoint.y)],
            [xAxis.label, formatX(tooltipPoint.x)],
          ]}
          width={width}
          x={scaleX(tooltipPoint.x)}
          y={scaleY(tooltipPoint.y)}
        />
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
