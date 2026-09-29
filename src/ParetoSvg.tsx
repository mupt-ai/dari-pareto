import type { CSSProperties, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import { axisScale } from "./axis.js";
import { pointColors } from "./colors.js";
import { paretoFrontier, validatePoints } from "./frontier.js";
import { GroupLegend, groupsOf, layoutGroups, parseChipKey } from "./Groups.js";
import { CHARACTER_WIDTH, placeLabels } from "./labels.js";
import { nearestWithin } from "./pointer.js";
import { Settings } from "./Settings.js";
import { Tooltip } from "./Tooltip.js";
import type { AxisOptions, ParetoPlotProps, ParetoPoint } from "./types.js";

const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 290;
const MARGIN = { top: 45, right: 36, bottom: 56, left: 54 } as const;
/** The top margin when neither the title nor the legend is drawn. */
const BARE_TOP = 16;
/** How far the legend moves left to clear the settings button. */
const SETTINGS_ROOM = 28;
/** Where the rotated y-axis title sits: its baseline's x, unless the margin is fitted. */
const Y_TITLE_X = 16;
/** Space kept between the y-axis title, the tick labels and the plot in a fitted margin. */
const Y_AXIS_GAP = 10;
/** Length of a tick mark outside the plot's edge; see `AxisOptions.tickMarks`. */
const TICK_MARK = 5;
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

/** Only with group chips: highlighting a group fades the rest. */
const groupStyles = `
  .pareto-point, .pareto-point-label { transition: opacity .15s; }
  .pareto-point.faded, .pareto-point-label.visible.faded { opacity: .15; }
  .pareto-group { cursor: pointer; outline: none; }
  .pareto-group text, .pareto-group circle { transition: opacity .15s; }
  .pareto-group.muted text, .pareto-group.muted circle { opacity: .4; }
  .pareto-group.pinned text { fill: var(--pareto-foreground, #eef4ed); }
  .pareto-group:focus-visible rect { stroke: var(--pareto-muted, #91a39b); }
  .pareto-group-toggle { cursor: pointer; outline: none; }
  .pareto-group-toggle:focus-visible rect { stroke: var(--pareto-muted, #91a39b); }
`;

/** Only with the settings button: quiet until hovered, focused or open. */
const settingsStyles = `
  .pareto-settings-button, .pareto-settings-step { cursor: pointer; outline: none; }
  .pareto-settings-button { opacity: .55; transition: opacity .15s; }
  .pareto-settings-button:hover, .pareto-settings-button:focus-visible, .pareto-settings-button[aria-expanded="true"] { opacity: 1; }
  .pareto-settings-step.disabled { cursor: default; opacity: .35; }
  .pareto-settings-button:focus-visible rect, .pareto-settings-step:focus-visible rect { stroke: var(--pareto-muted, #91a39b); }
  .pareto-settings-field {
    box-sizing: border-box; width: 100%; height: 100%; margin: 0; padding: 0;
    border: 1px solid var(--pareto-grid, #263631); border-radius: 0; outline: none;
    background: transparent; color: var(--pareto-foreground, #eef4ed);
    font: inherit; text-align: center;
  }
  .pareto-settings-field:focus { border-color: var(--pareto-muted, #91a39b); }
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
  /** The chip under the pointer or focus, and the one held by a click or tap (see `chipKey`). */
  hoveredGroup?: string | null;
  pinnedGroup?: string | null;
  onHoveredGroupChange?: (key: string | null) => void;
  onPinnedGroupChange?: (key: string | null) => void;
  /** Groups whose subgroups are listed as chips of their own. */
  expandedGroups?: readonly string[];
  onExpandedGroupsChange?: (groups: string[]) => void;
  /** Whether the settings panel is open, and the viewer's text size in percent. */
  settingsOpen?: boolean;
  textSize?: number;
  onSettingsOpenChange?: (open: boolean) => void;
  onTextSizeChange?: (size: number) => void;
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
  textScale,
  hoverRadius,
  palette,
  showGroups = false,
  groupOrder,
  showSettings = false,
  className,
  style,
  focusedId = null,
  hoveredId = null,
  onFocusedIdChange,
  onHoveredIdChange,
  hoveredGroup = null,
  pinnedGroup = null,
  onHoveredGroupChange,
  onPinnedGroupChange,
  expandedGroups = [],
  onExpandedGroupsChange,
  settingsOpen = false,
  textSize = 100,
  onSettingsOpenChange,
  onTextSizeChange,
}: ParetoSvgProps) {
  validatePoints(points);
  const activeId = hoveredId ?? focusedId;
  const interactive = mode === "interactive";
  const settings = interactive && showSettings;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 320 || height < 240) {
    throw new Error("Pareto plot width and height must be finite and at least 320 × 240.");
  }
  if (textScale !== undefined && (!Number.isFinite(textScale) || textScale <= 0)) {
    throw new Error("Pareto plot text scale must be a positive number.");
  }
  // The plot's own text scale, times the viewer's size from the settings panel.
  const scale =
    textScale !== undefined || (settings && textSize !== 100)
      ? (textScale ?? 1) * (settings ? textSize / 100 : 1)
      : undefined;
  const size = (base: number) => base * (scale ?? 1);

  const frontier = paretoFrontier(points, {
    xObjective: xAxis.objective,
    yObjective: yAxis.objective,
  });
  const frontierIds = new Set(frontier.map((point) => point.id));
  const { ticks: xTicks, position: xAt } = axisScale(
    points.map((point) => point.x),
    xAxis,
  );
  const { ticks: yTicks, position: yAt } = axisScale(
    points.map((point) => point.y),
    yAxis,
  );
  const formatX = xAxis.format ?? defaultFormat;
  const formatY = yAxis.format ?? defaultFormat;
  const shownYTicks = yTicks.filter((tick) => tick !== 0);
  // Scaled text gets a left margin fitted to it: the y-axis title, a gap, the widest tick
  // label, a gap, then the plot. Unscaled plots keep the fixed layout.
  let left: number = MARGIN.left;
  let yTitleX = Y_TITLE_X;
  // Below the plot: the x tick labels, then the x-axis title. Scaled text pushes the tick
  // labels down to stay clear of the lowest y tick label, and the plot's bottom up to fit.
  let bottom: number = MARGIN.bottom;
  let xTickOffset = 20;
  if (scale !== undefined) {
    xTickOffset = size(10) / 2 + 6 + size(9) * 0.75;
    bottom = Math.max(MARGIN.bottom, Math.ceil(xTickOffset + size(9) * 0.3 + 8 + size(11) * 0.8 + 8));
    const titleSize = size(11);
    const widestTick = Math.max(0, ...shownYTicks.map((tick) => formatY(tick).length)) * size(10) * CHARACTER_WIDTH;
    // Capitals rise about 0.8 em from the rotated baseline, toward the left edge.
    yTitleX = 4 + titleSize * 0.8;
    left = Math.max(MARGIN.left, Math.ceil(yTitleX + titleSize * 0.2 + Y_AXIS_GAP + widestTick + Y_AXIS_GAP));
  }
  const plotWidth = Math.max(1, width - left - MARGIN.right);
  // Group chips sit in rows above the plot, below the title and legend when those are shown.
  // Only an interactive plot can expand a group; a static one shows the groups as they are.
  const expanded = new Set(interactive && showGroups ? expandedGroups : []);
  const colorOf = pointColors(points, palette, { order: groupOrder, expanded });
  const groups = showGroups ? groupsOf(points, colorOf, groupOrder) : [];
  const chipsTop = showTitle || showLegend ? 34 : 6;
  const legend = layoutGroups(groups, expanded, { left, top: chipsTop, maxWidth: plotWidth, fontSize: size(9) });
  const baseTop = showTitle || showLegend ? MARGIN.top : BARE_TOP;
  const top = groups.length > 0 ? Math.max(baseTop, chipsTop + legend.height + 10) : baseTop;
  const plotHeight = Math.max(1, height - top - bottom);
  const scaleX = (value: number) => left + xAt(value) * plotWidth;
  const scaleY = (value: number) => top + plotHeight - yAt(value) * plotHeight;
  const colored = points.some((point) => colorOf.get(point.id));
  const highlighted = groups.length > 0 ? (hoveredGroup ?? pinnedGroup) : null;
  const shown = highlighted === null ? null : parseChipKey(highlighted);
  const faded = (point: ParetoPoint) =>
    shown !== null &&
    (point.group !== shown.group || (shown.subgroup !== undefined && point.subgroup !== shown.subgroup));
  // Collapsing a group lets go of any of its subgroups that was highlighted.
  const toggleGroup = (group: string) => {
    const open = expanded.has(group);
    onExpandedGroupsChange?.(open ? [...expanded].filter((name) => name !== group) : [...expanded, group]);
    if (!open) return;
    for (const [key, clear] of [
      [pinnedGroup, onPinnedGroupChange],
      [hoveredGroup, onHoveredGroupChange],
    ] as const) {
      if (key !== null && parseChipKey(key).group === group && parseChipKey(key).subgroup !== undefined) clear?.(null);
    }
  };
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
              bounds: { x: left, y: top, width: plotWidth, height: plotHeight },
              fontSize: labelSize,
            },
          ).map((label) => [label.id, label]),
        )
      : null;
  // With a hover radius, the plot as a whole finds the nearest point to the pointer.
  const nearHover = interactive && hoverRadius !== undefined && hoverRadius > 0;
  const onScreen = points.map((point) => ({ point, x: scaleX(point.x), y: scaleY(point.y) }));
  const pointerAt = (event: ReactMouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // The SVG scales to its box; the points are placed in its own units.
    const units = box.width > 0 ? width / box.width : 1;
    const x = (event.clientX - box.left) * units;
    const y = (event.clientY - box.top) * units;
    return nearestWithin(onScreen, x, y, hoverRadius ?? 0)?.point;
  };
  // The chips and the settings control handle their own pointer; the plot leaves them be.
  const within = (event: ReactMouseEvent<SVGSVGElement>, selector: string) =>
    Boolean((event.target as { closest?: (selector: string) => unknown } | null)?.closest?.(selector));
  const onControls = (event: ReactMouseEvent<SVGSVGElement>) =>
    within(event, ".pareto-groups, .pareto-settings");
  const tooltipPoint =
    showTooltip && interactive ? points.find((point) => point.id === activeId) : undefined;

  return (
    <svg
      aria-label={title}
      className={className}
      height={height}
      role={interactive ? "group" : "img"}
      style={{ ...baseStyle, ...(nearHover && hoveredId ? { cursor: "pointer" } : {}), ...style }}
      // A mouse inspects the nearest point as it moves; a tap inspects the nearest point, or
      // puts the card away when none is near. A touch that becomes a scroll ends in
      // pointercancel, not pointerup, so scrolling across the plot opens nothing.
      onClick={
        nearHover
          ? (event) => {
              const point = onControls(event) ? undefined : pointerAt(event);
              if (point) activate(point);
            }
          : undefined
      }
      onPointerLeave={
        nearHover
          ? (event) => {
              if (event.pointerType === "mouse") onHoveredIdChange?.(null);
            }
          : undefined
      }
      onPointerMove={
        nearHover
          ? (event) => {
              if (event.pointerType !== "mouse") return;
              onHoveredIdChange?.(onControls(event) ? null : (pointerAt(event)?.id ?? null));
            }
          : undefined
      }
      onPointerUp={
        nearHover
          ? (event) => {
              if (event.pointerType === "mouse" || onControls(event)) return;
              onHoveredIdChange?.(pointerAt(event)?.id ?? null);
            }
          : undefined
      }
      // An open settings panel closes on any press outside it.
      onPointerDown={
        settings && settingsOpen
          ? (event) => {
              if (!within(event, ".pareto-settings")) onSettingsOpenChange?.(false);
            }
          : undefined
      }
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>
        {chartStyles +
          (colored ? colorStyles : "") +
          (showTooltip && interactive ? tooltipStyles : "") +
          (groups.length > 0 ? groupStyles : "") +
          (settings ? settingsStyles : "")}
      </style>
      <title>{title}</title>
      <desc>{fullDescription}</desc>

      {showTitle ? (
        <text
          fill="currentColor"
          fontSize={size(14)}
          fontWeight="700"
          letterSpacing="0.04em"
          x={left}
          y="24"
        >
          {title}
        </text>
      ) : null}

      {showLegend && !colored ? (
        <g
          aria-hidden="true"
          fontSize={size(9)}
          transform={`translate(${width - MARGIN.right - size(150) - (settings ? SETTINGS_ROOM : 0)} 20)`}
        >
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
        <g
          aria-hidden="true"
          fontSize={size(9)}
          transform={`translate(${width - MARGIN.right - size(170) - (settings ? SETTINGS_ROOM : 0)} 20)`}
        >
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
        {shownYTicks.map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                stroke="var(--pareto-grid, #263631)"
                strokeWidth="1"
                x1={left}
                x2={width - MARGIN.right}
                y1={y}
                y2={y}
              />
              {yAxis.tickMarks ? (
                <line
                  className="pareto-tick-mark"
                  stroke="var(--pareto-muted, #91a39b)"
                  strokeWidth="1"
                  x1={left - TICK_MARK}
                  x2={left}
                  y1={y}
                  y2={y}
                />
              ) : null}
              <text
                dominantBaseline="middle"
                fill="var(--pareto-muted, #91a39b)"
                fontSize={size(10)}
                textAnchor="end"
                x={left - Y_AXIS_GAP}
                y={y}
              >
                {formatY(tick)}
              </text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = scaleX(tick);
          const label = (
            <text
              key={`x-${tick}`}
              fill="var(--pareto-muted, #91a39b)"
              fontSize={size(9)}
              textAnchor="middle"
              x={x}
              y={height - bottom + xTickOffset}
            >
              {formatX(tick)}
            </text>
          );
          if (!xAxis.tickMarks) return label;
          return (
            <g key={`x-${tick}`}>
              <line
                className="pareto-tick-mark"
                stroke="var(--pareto-muted, #91a39b)"
                strokeWidth="1"
                x1={x}
                x2={x}
                y1={height - bottom}
                y2={height - bottom + TICK_MARK}
              />
              {label}
            </g>
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
          const color = colorOf.get(point.id);
          const ownFill = efficient ? color : "var(--pareto-background, #09100f)";
          return (
            <g
              aria-label={interactive ? pointDescription(point, xAxis, yAxis, efficient) : undefined}
              className={`pareto-point${selected ? " selected" : ""}${efficient ? " efficient" : ""}${color ? " colored" : ""}${faded(point) ? " faded" : ""}`}
              key={point.id}
              onBlur={interactive ? () => onFocusedIdChange?.(null) : undefined}
              onClick={interactive && !nearHover ? () => activate(point) : undefined}
              onFocus={interactive ? () => onFocusedIdChange?.(point.id) : undefined}
              onKeyDown={interactive ? (event) => handleKeyDown(event, point) : undefined}
              onMouseEnter={interactive && !nearHover ? () => onHoveredIdChange?.(point.id) : undefined}
              onMouseLeave={interactive && !nearHover ? () => onHoveredIdChange?.(null) : undefined}
              role={interactive ? "button" : undefined}
              style={color ? ({ "--pareto-point-color": color } as CSSProperties) : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              <circle
                cx={scaleX(point.x)}
                cy={scaleY(point.y)}
                fill={color ? ownFill : themeFill}
                r={selected ? 8 : color && !efficient ? RING_RADIUS : 5}
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
              className={`pareto-point-label visible${tooltipPoint ? " dimmed" : ""}${faded(point) ? " faded" : ""}`}
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

      {groups.length > 0 ? (
        <GroupLegend
          chips={legend.chips}
          fontSize={size(9)}
          highlighted={highlighted}
          interactive={interactive}
          onHover={(group) => onHoveredGroupChange?.(group)}
          onPin={(group) => onPinnedGroupChange?.(group)}
          onToggle={toggleGroup}
          pinned={pinnedGroup}
        />
      ) : null}

      {settings ? (
        <Settings
          // The panel keeps the plot's own size, so it does not move as the viewer resizes text.
          fontSize={10 * (textScale ?? 1)}
          onOpenChange={(open) => onSettingsOpenChange?.(open)}
          onSizeChange={(size) => onTextSizeChange?.(size)}
          open={settingsOpen}
          size={textSize}
          width={width}
        />
      ) : null}

      {points.length === 0 ? (
        <text
          fill="var(--pareto-muted, #91a39b)"
          fontSize={size(12)}
          textAnchor="middle"
          x={left + plotWidth / 2}
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
        transform={`rotate(-90 ${yTitleX} ${top + plotHeight / 2})`}
        x={yTitleX}
        y={top + plotHeight / 2}
      >
        {yAxis.label.toUpperCase()}
      </text>
    </svg>
  );
}
