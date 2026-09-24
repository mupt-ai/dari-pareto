import { describe, expect, test } from "bun:test";

import { axisScale, niceStep } from "../src/axis";

const axis = { label: "Cost", objective: "minimize" as const };

describe("axisScale", () => {
  test("splits the domain evenly by default", () => {
    expect(axisScale([1, 2], { ...axis, domain: [0, 1], ticks: 3 })).toEqual({
      domain: [0, 1],
      ticks: [0, 0.5, 1],
    });
  });

  test("picks the round step closest to the even split", () => {
    expect(niceStep(1.04)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(3.2)).toBe(2.5);
    expect(niceStep(10.8)).toBe(10);
    expect(niceStep(0.087)).toBe(0.1);
  });

  test("rounds an inferred domain out to whole steps that are also ticks", () => {
    const { domain, ticks } = axisScale([0.5, 4.4], { ...axis, nice: true, ticks: 4 });
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks.at(-1)).toBe(domain[1]);
    expect(ticks).toEqual([0, 2, 4, 6]);
  });

  test("starts all-positive data at zero when zero is included", () => {
    expect(axisScale([0.21, 4.68], { ...axis, nice: true, includeZero: true, ticks: 6 })).toEqual({
      domain: [0, 5],
      ticks: [0, 1, 2, 3, 4, 5],
    });
    // Equal values take a wider padding, which must not cross zero either.
    expect(axisScale([0.5, 0.5], { ...axis, nice: true, includeZero: true }).domain[0]).toBe(0);
    expect(axisScale([-3, -1], { ...axis, nice: true, includeZero: true }).domain[1]).toBe(0);
  });

  test("keeps an explicit domain and ticks inside it", () => {
    expect(axisScale([60, 100], { ...axis, domain: [50, 104], nice: true, ticks: 6 })).toEqual({
      domain: [50, 104],
      ticks: [50, 60, 70, 80, 90, 100],
    });
  });

  test("still validates the tick count", () => {
    expect(() => axisScale([1, 2], { ...axis, nice: true, ticks: 1 })).toThrow("between 2 and 10");
  });
});
