import { describe, expect, test } from "bun:test";

import { nearestWithin } from "../src/pointer";

describe("nearestWithin", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 10, y: 0 },
  ];

  test("picks the nearest point within reach", () => {
    expect(nearestWithin(points, 7, 1, 20)?.id).toBe("b");
    expect(nearestWithin(points, 3, 1, 20)?.id).toBe("a");
  });

  test("picks nothing when every point is out of reach", () => {
    expect(nearestWithin(points, 50, 50, 20)).toBeUndefined();
  });
});
