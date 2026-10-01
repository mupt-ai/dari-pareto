import type { CSSProperties } from "react";

export type Objective = "minimize" | "maximize";

export type ParetoPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  /**
   * A short qualifier drawn faint after the label, in parentheses, such as a model's reasoning
   * level: "GPT-5 (high)".
   */
  note?: string;
  description?: string;
  /**
   * Any CSS color. Draws this point in its own color instead of the theme's: filled when
   * Pareto-efficient, a ring when dominated.
   */
  color?: string;
  /**
   * The point's group, such as the vendor that made a model. With `showGroups`, each group
   * gets a chip above the plot, colored like its first point.
   */
  group?: string;
  /**
   * A finer group within `group`, such as the model behind a custom endpoint. A group with
   * subgroups gets a chevron on its chip that lists them as chips of their own, each in the
   * next `palette` color while listed.
   */
  subgroup?: string;
};

/** The order of group chips; see `ParetoPlotProps.groupOrder`. */
export type GroupOrder = {
  /** Groups named here come first, in this order, when the plot has them. */
  first?: readonly string[];
  /** The order of every other group: "appearance" (the default) or "count", most points first. */
  rest?: "appearance" | "count";
  /** Groups named here come last, in this order, whatever the other rules say. */
  last?: readonly string[];
};

export type AxisOptions = {
  label: string;
  objective: Objective;
  domain?: readonly [number, number];
  includeZero?: boolean;
  format?: (value: number) => string;
  ticks?: number;
  /**
   * Places ticks on round steps (1, 2, 2.5 or 5 times a power of ten), `ticks` being the
   * approximate count, and rounds an inferred domain out to whole steps. An inferred domain
   * that includes zero then starts, or ends, exactly at zero. Defaults to false: ticks split
   * the domain evenly.
   */
  nice?: boolean;
  /**
   * "linear" (the default) or "log". A log axis suits values spanning orders of magnitude,
   * such as prices: equal distances are equal ratios. Its ticks fall on round values within
   * each decade, and values at or below zero sit on a zero tick at the axis start. `includeZero`
   * does not apply to it. The axis title says it is a log scale.
   */
  scale?: "linear" | "log";
  /**
   * Draws a short mark at each tick, just outside the plot's edge, between the plot and the
   * tick labels. Defaults to false.
   */
  tickMarks?: boolean;
};

export type ParetoPlotMode = "static" | "interactive";

export type ParetoPlotProps = {
  points: readonly ParetoPoint[];
  xAxis: AxisOptions;
  yAxis: AxisOptions;
  mode?: ParetoPlotMode;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  selectedId?: string | null;
  onSelect?: (point: ParetoPoint) => void;
  /**
   * Called when the point being inspected changes, hovered, focused or tapped, with that point,
   * or with null when none is: for a page that marks the same point elsewhere, such as a row in
   * a table beside the plot.
   */
  onActivePointChange?: (point: ParetoPoint | null) => void;
  /**
   * Called when the highlighted group chip changes, hovered or held by a click or tap (see
   * `showGroups`), with the points of that group or subgroup, or with null when none is.
   */
  onHighlightChange?: (points: ParetoPoint[] | null) => void;
  showLegend?: boolean;
  showPointLabels?: "none" | "frontier" | "all";
  /**
   * Where resting point labels go. "above" (the default) centers each above its point.
   * "auto" places frontier labels first, each in the first of eight spots around its point
   * (above, beside, below, then the diagonals) that covers no point and no other label,
   * preferring spots off the frontier line; a label with no room is left out and still
   * appears on hover.
   */
  labelPlacement?: "above" | "auto";
  /** Draws the title above the plot. Defaults to true. */
  showTitle?: boolean;
  /**
   * In interactive mode, shows a card with the hovered or focused point's label, both axis
   * values and its description, in place of its label. Defaults to false.
   */
  showTooltip?: boolean;
  /**
   * How the tooltip looks. "card" (the default) is a card with the label, both axis values and
   * the description, one per line. "label" is a smaller box with the label, its note faint
   * after it, over its values on one line ("70.2% at $1.36"); a point the page selects shows
   * the same while none is inspected.
   */
  tooltipStyle?: "card" | "label";
  /**
   * Text drawn along the frontier line's longest segment, such as "PARETO FRONTIER". Left out
   * when no segment is long enough to hold it.
   */
  frontierLabel?: string;
  /**
   * In interactive mode, the pointer inspects the nearest point within this many pixels
   * instead of only the point directly under it; a tap does the same, and a tap away from
   * every point puts the card away. Unset: only the point under the pointer.
   */
  hoverRadius?: number;
  /**
   * Colors for points without their own `color`: each group (or each point, when points have
   * no group) takes the next one in order of first appearance, starting over when there are
   * more groups than colors, so groups past the palette's length share colors and rely on
   * their names. `pointColors` gives the same assignment, for coloring the rest of a page to
   * match.
   */
  palette?: readonly string[];
  /**
   * Draws a row of chips above the plot, one per point `group`. Hovering or focusing a chip
   * fades every point outside its group; a click or tap holds that until the chip is pressed
   * again. Static plots show the chips as a key. Defaults to false.
   */
  showGroups?: boolean;
  /**
   * The order of the group chips, and of the palette colors groups take. Unset: order of first
   * appearance.
   */
  groupOrder?: GroupOrder;
  /**
   * In interactive mode, a quiet settings button in the top right corner opens a panel where
   * the viewer can set the text size, from 50 to 200 percent: typed, or in 10 percent steps.
   * Defaults to false.
   */
  showSettings?: boolean;
  /**
   * Multiplies every text size, for plots drawn larger or smaller than their logical size.
   * Setting it also fits the left margin to the y-axis tick labels, keeping a gap between
   * them and the y-axis title. Unset, text is at 1× in the fixed layout.
   */
  textScale?: number;
  className?: string;
  style?: CSSProperties;
};

export type FrontierOptions = {
  xObjective?: Objective;
  yObjective?: Objective;
};
