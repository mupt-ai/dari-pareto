import { describe, expect, test } from "bun:test";

import { dominates, paretoFrontier, type ParetoPoint } from "../src";

const point = (id: string, x: number, y: number): ParetoPoint => ({ id, label: id, x, y });

describe("paretoFrontier", () => {
  test("returns the cost-minimizing, score-maximizing frontier in x order", () => {
    const points = [
      point("cheap", 1, 50),
      point("balanced", 2, 75),
      point("dominated", 3, 60),
      point("best", 4, 90),
    ];

    expect(paretoFrontier(points).map(({ id }) => id)).toEqual(["cheap", "balanced", "best"]);
  });

  test("supports every objective direction", () => {
    const points = [point("a", 1, 1), point("b", 2, 2), point("c", 1, 2)];

    expect(paretoFrontier(points, { xObjective: "minimize", yObjective: "maximize" }).map((p) => p.id)).toEqual(["c"]);
    expect(paretoFrontier(points, { xObjective: "maximize", yObjective: "maximize" }).map((p) => p.id)).toEqual(["b"]);
    expect(paretoFrontier(points, { xObjective: "minimize", yObjective: "minimize" }).map((p) => p.id)).toEqual(["a"]);
    expect(paretoFrontier(points, { xObjective: "maximize", yObjective: "minimize" }).map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("keeps exact duplicates and removes weaker points at the same x value", () => {
    const points = [point("a", 1, 2), point("b", 1, 2), point("c", 1, 1)];

    expect(paretoFrontier(points).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  test("does not mutate the input", () => {
    const points = [point("b", 2, 2), point("a", 1, 1)];

    paretoFrontier(points);

    expect(points.map(({ id }) => id)).toEqual(["b", "a"]);
  });

  test("rejects duplicate ids and non-finite coordinates", () => {
    expect(() => paretoFrontier([point("same", 1, 1), point("same", 2, 2)])).toThrow("Duplicate Pareto point id");
    expect(() => paretoFrontier([point("bad", Number.NaN, 1)])).toThrow("finite x and y");
  });
});

describe("dominates", () => {
  test("requires one strictly better coordinate", () => {
    expect(dominates(point("a", 1, 2), point("b", 1, 2))).toBe(false);
    expect(dominates(point("a", 1, 2), point("b", 2, 2))).toBe(true);
  });
});
