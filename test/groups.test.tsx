import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { groupsOf, layoutGroups } from "../src/Groups";
import { ParetoSvg } from "../src/ParetoSvg";
import { parseTextSize, stepTextSize } from "../src/Settings";
import { renderParetoPlot } from "../src/static";

const points = [
  { id: "a", label: "A", x: 1, y: 60, group: "Acme", color: "#111111" },
  { id: "b", label: "B", x: 2, y: 80, group: "Bolt", color: "#222222" },
  { id: "c", label: "C", x: 3, y: 90, group: "Acme", color: "#333333" },
];
const props = {
  points,
  xAxis: { label: "Cost", objective: "minimize" as const },
  yAxis: { label: "Score", objective: "maximize" as const, domain: [0, 100] as const },
  title: "Groups",
  showGroups: true,
};

describe("groups", () => {
  test("lists groups in order of first appearance, colored like their first point", () => {
    expect(groupsOf(points)).toEqual([
      { name: "Acme", color: "#111111" },
      { name: "Bolt", color: "#222222" },
    ]);
  });

  test("wraps chips onto a new row when the row is full", () => {
    const groups = ["One", "Two", "Three"].map((name) => ({ name, color: "#000" }));
    const wide = layoutGroups(groups, { left: 0, top: 0, maxWidth: 1000, fontSize: 10 });
    const narrow = layoutGroups(groups, { left: 0, top: 0, maxWidth: 80, fontSize: 10 });
    expect(new Set(wide.chips.map((chip) => chip.y)).size).toBe(1);
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  test("fades points outside a highlighted group", () => {
    const markup = renderToStaticMarkup(ParetoSvg({ ...props, hoveredGroup: "Bolt" }));
    expect(markup.match(/pareto-point[^"]* faded/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Highlight Acme"');
  });

  test("shows the chips as a plain key in a static plot", () => {
    const markup = renderParetoPlot(props);
    expect(markup).toContain(">Acme<");
    expect(markup).not.toContain("Highlight Acme");
  });
});

describe("settings", () => {
  test("offers a text size panel in interactive plots only", () => {
    const closed = renderToStaticMarkup(ParetoSvg({ ...props, showSettings: true }));
    expect(closed).toContain('aria-label="Plot Settings"');
    expect(closed).not.toContain("Text Size");
    const open = renderToStaticMarkup(ParetoSvg({ ...props, showSettings: true, settingsOpen: true }));
    expect(open).toContain("Text Size");
    expect(open).toContain('value="100"');
    expect(renderParetoPlot({ ...props, showSettings: true })).not.toContain("Plot Settings");
  });

  test("stops at the ends of the range", () => {
    const largest = renderToStaticMarkup(
      ParetoSvg({ ...props, showSettings: true, settingsOpen: true, textSize: 200 }),
    );
    expect(largest).toContain('aria-label="Larger Text" class="pareto-settings-step disabled"');
    expect(largest).not.toContain('aria-label="Smaller Text" class="pareto-settings-step disabled"');
  });

  test("steps to the next multiple of ten, from any size", () => {
    expect(stepTextSize(100, 1)).toBe(110);
    expect(stepTextSize(73, 1)).toBe(80);
    expect(stepTextSize(73, -1)).toBe(70);
    expect(stepTextSize(70, -1)).toBe(60);
    expect(stepTextSize(195, 1)).toBe(200);
    expect(stepTextSize(50, -1)).toBe(50);
  });

  test("takes typed sizes, kept in range, and ignores what is not a number", () => {
    expect(parseTextSize("120", 100)).toBe(120);
    expect(parseTextSize(" 73.4% ", 100)).toBe(73);
    expect(parseTextSize("999", 100)).toBe(200);
    expect(parseTextSize("5", 100)).toBe(50);
    expect(parseTextSize("-1231", 100)).toBe(50);
    expect(parseTextSize("-", 100)).toBe(100);
    expect(parseTextSize("big", 90)).toBe(90);
  });
});
