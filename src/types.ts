import type { CSSProperties } from "react";

export type Objective = "minimize" | "maximize";

export type ParetoPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  description?: string;
};

export type AxisOptions = {
  label: string;
  objective: Objective;
  domain?: readonly [number, number];
  includeZero?: boolean;
  format?: (value: number) => string;
  ticks?: number;
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
  className?: string;
  style?: CSSProperties;
};

export type FrontierOptions = {
  xObjective?: Objective;
  yObjective?: Objective;
};
