import { describe, expect, test } from "bun:test";

import { pointColors } from "../src/colors";
import { renderParetoPlot } from "../src/static";

const point = (id: string, group?: string, color?: string) => ({
  id,
  label: id,
  x: 1,
  y: 1,
  ...(group ? { group } : {}),
  ...(color ? { color } : {}),
});

describe("pointColors", () => {
  test("keeps a point's own color and gives each group the next palette color", () => {
    const colors = pointColors(
      [point("a", "Acme", "#000"), point("b", "Bolt"), point("c", "Cove"), point("d", "Bolt")],
      ["#111", "#222"],
    );
    expect([...colors.values()]).toEqual(["#000", "#111", "#222", "#111"]);
  });

  test("starts over when there are more groups than colors", () => {
    const colors = pointColors(
      ["One", "Two", "Three"].map((group) => point(group, group)),
      ["#111", "#222"],
    );
    expect([...colors.values()]).toEqual(["#111", "#222", "#111"]);
  });

  test("colors ungrouped points one by one, and leaves points alone without a palette", () => {
    expect([...pointColors([point("a"), point("b")], ["#111", "#222"]).values()]).toEqual([
      "#111",
      "#222",
    ]);
    expect([...pointColors([point("a")]).values()]).toEqual([undefined]);
  });

  test("draws the plot in the palette's colors", () => {
    const markup = renderParetoPlot({
      points: [
        { id: "a", label: "A", x: 1, y: 2, group: "Acme" },
        { id: "b", label: "B", x: 2, y: 3, group: "Bolt" },
      ],
      xAxis: { label: "Cost", objective: "minimize" },
      yAxis: { label: "Score", objective: "maximize" },
      palette: ["#123456", "#654321"],
      showGroups: true,
    });
    expect(markup).toContain("--pareto-point-color:#123456");
    expect(markup).toContain('fill="#654321"');
  });
});
