import { useState } from "react";

import { ParetoSvg } from "./ParetoSvg.js";
import type { ParetoPlotProps } from "./types.js";

export function ParetoPlot(props: ParetoPlotProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textStep, setTextStep] = useState(0);
  return (
    <ParetoSvg
      {...props}
      focusedId={focusedId}
      hoveredId={hoveredId}
      onFocusedIdChange={setFocusedId}
      onHoveredIdChange={setHoveredId}
      hoveredGroup={hoveredGroup}
      pinnedGroup={pinnedGroup}
      onHoveredGroupChange={setHoveredGroup}
      onPinnedGroupChange={setPinnedGroup}
      settingsOpen={settingsOpen}
      textStep={textStep}
      onSettingsOpenChange={setSettingsOpen}
      onTextStepChange={setTextStep}
    />
  );
}
