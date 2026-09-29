import { type RefObject, useEffect, useRef, useState } from "react";

import { inChip } from "./Groups.js";
import { DEFAULT_WIDTH, ParetoSvg, TOUCH_TARGET } from "./ParetoSvg.js";
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

/**
 * Plot units per screen pixel: above 1 when the plot is drawn narrower than its `width`, as it
 * is when it scales down to fit a narrow screen.
 */
function useDrawnScale(svg: RefObject<SVGSVGElement | null>, width: number): number {
  const [drawn, setDrawn] = useState(width);
  useEffect(() => {
    const element = svg.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setDrawn(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [svg]);
  return drawn > 0 ? width / drawn : 1;
}

/** Calls `report` with `value` each time it changes after the first render, never on mount. */
function useReport<Value>(value: Value, report: (value: Value) => void) {
  const last = useRef(value);
  const latest = useRef(report);
  latest.current = report;
  useEffect(() => {
    if (Object.is(last.current, value)) return;
    last.current = value;
    latest.current(value);
  }, [value]);
}

export function ParetoPlot(props: ParetoPlotProps) {
  const svg = useRef<SVGSVGElement>(null);
  const touch = useCoarsePointer();
  const scale = useDrawnScale(svg, props.width ?? DEFAULT_WIDTH);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [textSize, setTextSize] = useState(100);
  // The page hears which point is inspected and which chip is highlighted, as they change.
  useReport(hoveredId ?? focusedId, (id) =>
    props.onActivePointChange?.(props.points.find((point) => point.id === id) ?? null),
  );
  useReport(hoveredGroup ?? pinnedGroup, (key) =>
    props.onHighlightChange?.(key === null ? null : props.points.filter((point) => inChip(point, key))),
  );
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
      svgRef={svg}
      // A fingertip on screen, in the plot's own units at the size it is drawn.
      touchTarget={touch ? TOUCH_TARGET * scale : 0}
      settingsOpen={settingsOpen}
      textSize={textSize}
      onSettingsOpenChange={setSettingsOpen}
      onTextSizeChange={setTextSize}
    />
  );
}
