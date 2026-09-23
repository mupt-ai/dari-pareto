import { describe, expect, test } from "bun:test";

import { niceDomain, niceStep, niceTicks, placeLabels } from "../src/layout";

describe("nice axes", () => {
  test("rounds steps to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceStep(0.87)).toBe(1);
    expect(niceStep(1.04)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(12)).toBe(20);
  });

  test("widens a domain to round bounds and ticks on round values", () => {
    expect(niceDomain([0, 4.9], 6)).toEqual([0, 5]);
    expect(niceTicks([0, 5], 6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(niceTicks([50, 104], 6)).toEqual([50, 60, 70, 80, 90, 100]);
  });
});

describe("placeLabels", () => {
  const bounds = { x: 0, y: 0, width: 400, height: 200 };

  test("prefers the spot above the point", () => {
    const [label] = placeLabels([{ id: "a", x: 100, y: 100, text: "Alpha" }], [], bounds, 10);
    expect(label?.anchor).toBe("middle");
    expect(label?.y).toBeLessThan(100);
  });

  test("moves a label that would cover an earlier one, and drops one with no room", () => {
    const placed = placeLabels(
      [
        { id: "a", x: 100, y: 100, text: "Alpha" },
        { id: "b", x: 104, y: 100, text: "Beta" },
      ],
      [],
      bounds,
      10,
    );
    expect(placed.map((label) => label.id)).toEqual(["a", "b"]);
    // Above is taken by the first label; beside it would touch that label, so it goes below.
    expect(placed[1]?.y).toBeGreaterThan(100);
    const cramped = placeLabels(
      [{ id: "a", x: 5, y: 5, text: "A very long label" }],
      [],
      { x: 0, y: 0, width: 20, height: 10 },
      10,
    );
    expect(cramped).toEqual([]);
  });
});
