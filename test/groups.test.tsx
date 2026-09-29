import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { chipKey, groupsOf, inChip, layoutGroups } from "../src/Groups";
import { orderGroups } from "../src/order";
import { ParetoSvg } from "../src/ParetoSvg";
import { parseTextSize, stepFrom, stepTextSize } from "../src/Settings";
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
      { name: "Acme", color: "#111111", subgroups: [] },
      { name: "Bolt", color: "#222222", subgroups: [] },
    ]);
  });

  test("wraps chips onto a new row when the row is full", () => {
    const groups = ["One", "Two", "Three"].map((name) => ({ name, color: "#000", subgroups: [] }));
    const wide = layoutGroups(groups, new Set(), { left: 0, top: 0, maxWidth: 1000, fontSize: 10 });
    const narrow = layoutGroups(groups, new Set(), { left: 0, top: 0, maxWidth: 80, fontSize: 10 });
    expect(new Set(wide.chips.map((chip) => chip.y)).size).toBe(1);
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  test("keeps a group chip in its group's color while its subgroups are listed", () => {
    const custom = ["m1", "m2"].map((subgroup, index) => ({
      id: subgroup,
      label: subgroup,
      x: index + 1,
      y: 50 + index,
      group: "Custom",
      subgroup,
      color: "#888888",
    }));
    const markup = renderToStaticMarkup(
      ParetoSvg({ ...props, points: custom, palette: ["#aaaaaa", "#bbbbbb"], expandedGroups: ["Custom"] }),
    );
    const chipColor = (name: string) =>
      markup.match(new RegExp(`aria-label="Highlight ${name}"[^]*?<circle[^>]*fill="([^"]+)"`))?.[1];

    expect(chipColor("Custom")).toBe("#888888");
    expect(chipColor("m1")).toBe("#aaaaaa");
    expect(chipColor("m2")).toBe("#bbbbbb");
  });

  test("leaves room for a chevron only where one is drawn", () => {
    const groups = [
      { name: "Custom", color: "#000", subgroups: [{ name: "m1", color: "#111" }] },
      { name: "Next", color: "#000", subgroups: [] },
    ];
    const layout = (expandable?: boolean) =>
      layoutGroups(groups, new Set(), { left: 0, top: 0, maxWidth: 1000, fontSize: 10, expandable }).chips;
    const [interactiveCustom, interactiveNext] = layout();
    const [staticCustom, staticNext] = layout(false);

    expect(interactiveCustom?.expandable).toBe(true);
    expect(staticCustom?.expandable).toBe(false);
    expect((interactiveNext?.x ?? 0) - (staticNext?.x ?? 0)).toBeCloseTo(13, 5);
  });

  test("a chip stands for its group's points, or only its subgroup's", () => {
    const point = { id: "p", label: "P", x: 1, y: 1, group: "Custom", subgroup: "m1" };
    expect(inChip(point, chipKey("Custom"))).toBe(true);
    expect(inChip(point, chipKey("Custom", "m1"))).toBe(true);
    expect(inChip(point, chipKey("Custom", "m2"))).toBe(false);
    expect(inChip(point, chipKey("Acme"))).toBe(false);
  });

  test("fades points outside a highlighted group", () => {
    const markup = renderToStaticMarkup(ParetoSvg({ ...props, hoveredGroup: chipKey("Bolt") }));
    expect(markup.match(/pareto-point[^"]* faded/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Highlight Acme"');
  });

  test("shows the chips as a plain key in a static plot", () => {
    const markup = renderParetoPlot(props);
    expect(markup).toContain(">Acme<");
    expect(markup).not.toContain("Highlight Acme");
  });
});

describe("group order", () => {
  const many = ["Cove", "Acme", "Bolt", "Acme", "Custom", "Bolt", "Acme"].map((group, index) => ({
    id: String(index),
    label: String(index),
    x: index + 1,
    y: index,
    group,
  }));

  test("keeps first appearance by default", () => {
    expect(orderGroups(many)).toEqual(["Cove", "Acme", "Bolt", "Custom"]);
  });

  test("puts named groups first and last, and can sort the rest by size", () => {
    expect(orderGroups(many, { rest: "count", last: ["Custom"] })).toEqual(["Acme", "Bolt", "Cove", "Custom"]);
    expect(orderGroups(many, { first: ["Bolt", "Missing", "Cove"], last: ["Custom"] })).toEqual([
      "Bolt",
      "Cove",
      "Acme",
      "Custom",
    ]);
  });
});

describe("subgroups", () => {
  const custom = [
    ...points,
    { id: "x", label: "X", x: 0.5, y: 50, group: "Custom", subgroup: "coder-70b", color: "#999999" },
    { id: "y", label: "Y", x: 0.7, y: 55, group: "Custom", subgroup: "sql-13b", color: "#999999" },
  ];
  const plot = { ...props, points: custom, palette: ["#aa0000", "#00aa00"] };

  test("stay in the group's color and chip until the group is expanded", () => {
    const collapsed = renderToStaticMarkup(ParetoSvg(plot));
    expect(collapsed).toContain('aria-label="Expand Custom"');
    expect(collapsed).not.toContain(">coder-70b<");
    expect(collapsed.match(/#999999/g)?.length).toBeGreaterThan(1);
  });

  test("get chips and palette colors of their own when expanded, leaving other groups alone", () => {
    const open = renderToStaticMarkup(ParetoSvg({ ...plot, expandedGroups: ["Custom"] }));
    expect(open).toContain('aria-label="Collapse Custom"');
    expect(open).toContain(">coder-70b<");
    expect(open).toContain(">sql-13b<");
    expect(open).toContain("--pareto-point-color:#aa0000");
    expect(open).toContain("--pareto-point-color:#00aa00");
    expect(open).toContain("--pareto-point-color:#111111");
  });

  test("can be highlighted one at a time", () => {
    const markup = renderToStaticMarkup(
      ParetoSvg({ ...plot, expandedGroups: ["Custom"], hoveredGroup: chipKey("Custom", "sql-13b") }),
    );
    expect(markup.match(/class="pareto-point[^"]* faded/g)).toHaveLength(4);
  });

  test("are not expandable in a static plot", () => {
    expect(renderParetoPlot(plot)).not.toContain("Expand Custom");
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

  test("steps from what the field holds, and stops only at the end of that", () => {
    // A typed 150 not yet applied at 200%: larger is still open, from 150.
    expect(stepFrom("150", 200, 1)).toBe(160);
    expect(stepFrom("200", 200, 1)).toBeUndefined();
    expect(stepFrom("55", 100, -1)).toBe(50);
    expect(stepFrom("50", 100, -1)).toBeUndefined();
    // A step that lands on the applied size still gives it, for the field to show.
    expect(stepFrom("105", 110, 1)).toBe(110);
    // Nothing that parses: from the applied size.
    expect(stepFrom("", 120, 1)).toBe(130);
  });
});
