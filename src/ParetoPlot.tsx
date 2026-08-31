import { useState } from "react";

import { ParetoSvg } from "./ParetoSvg.js";
import type { ParetoPlotProps } from "./types.js";

export function ParetoPlot(props: ParetoPlotProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return (
    <ParetoSvg
      {...props}
      focusedId={focusedId}
      hoveredId={hoveredId}
      onFocusedIdChange={setFocusedId}
      onHoveredIdChange={setHoveredId}
    />
  );
}
