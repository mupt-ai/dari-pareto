import type { CSSProperties } from "react";

export type Objective = "minimize" | "maximize";

export type ParetoPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  description?: string;
  /** Any CSS color. Colors the point; Pareto-efficient points are filled, dominated ones ringed. */
  color?: string;
};

export type AxisOptions = {
  label: string;
  objective: Objective;
  domain?: readonly [number, number];
  includeZero?: boolean;
  format?: (value: number) => string;
  ticks?: number;
  /** Rounds the automatic domain out to, and places ticks on, round values. */
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
  /** Shows the title above the plot. Defaults to true. */
  showTitle?: boolean;
  /** Shows a card with the point's values on hover or focus. Defaults to true. */
  showTooltip?: boolean;
  /** Multiplies every text size, for plots drawn larger or smaller than their logical size. */
  textScale?: number;
  className?: string;
  style?: CSSProperties;
};

export type FrontierOptions = {
  xObjective?: Objective;
  yObjective?: Objective;
};
