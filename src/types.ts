import type { CSSProperties } from "react";

export type Objective = "minimize" | "maximize";

export type ParetoPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  description?: string;
  /**
   * Any CSS color. Draws this point in its own color instead of the theme's: filled when
   * Pareto-efficient, a ring when dominated.
   */
  color?: string;
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
  showLegend?: boolean;
  showPointLabels?: "none" | "frontier" | "all";
  /**
   * Where resting point labels go. "above" (the default) centers each above its point.
   * "auto" tries above, right, left, then below, taking the first spot that covers no point
   * and no other label; a label with no room is left out and still appears on hover.
   */
  labelPlacement?: "above" | "auto";
  /** Draws the title above the plot. Defaults to true. */
  showTitle?: boolean;
  /**
   * In interactive mode, shows a card with the hovered or focused point's label, both axis
   * values and its description, in place of its label. Defaults to false.
   */
  showTooltip?: boolean;
  /** Multiplies every text size, for plots drawn larger or smaller than their logical size. Defaults to 1. */
  textScale?: number;
  className?: string;
  style?: CSSProperties;
};

export type FrontierOptions = {
  xObjective?: Objective;
  yObjective?: Objective;
};
