import { useEffect, useState } from "react";

import { ParetoSvg } from "./ParetoSvg.js";
import type { ParetoPlotProps } from "./types.js";

/** Whether the main pointer is coarse, such as a finger; false until the page has loaded. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)") : null;
    if (!query) return;
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return coarse;
}

export function ParetoPlot(props: ParetoPlotProps) {
  const touch = useCoarsePointer();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textSize, setTextSize] = useState(100);
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
      expandedGroups={expandedGroups}
      onExpandedGroupsChange={setExpandedGroups}
      touch={touch}
      settingsOpen={settingsOpen}
      textSize={textSize}
      onSettingsOpenChange={setSettingsOpen}
      onTextSizeChange={setTextSize}
    />
  );
}
