import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ParetoSvg } from "./ParetoSvg.js";
import type { ParetoPlotProps } from "./types.js";

export type StaticParetoPlotProps = Omit<ParetoPlotProps, "mode" | "onSelect">;

export function StaticParetoPlot(props: StaticParetoPlotProps): ReactElement {
  return createElement(ParetoSvg, { ...props, mode: "static" });
}

export function renderParetoPlot(props: StaticParetoPlotProps): string {
  return renderToStaticMarkup(StaticParetoPlot(props));
}
