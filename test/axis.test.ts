import { describe, expect, test } from "bun:test";

import { axisScale, niceStep } from "../src/axis";
import type { AxisOptions } from "../src/types";

/** The range and ticks of an axis, without its position function. */
const shape = (values: number[], options: AxisOptions) => {
  const { domain, ticks } = axisScale(values, options);
  return { domain, ticks };
};

const axis = { label: "Cost", objective: "minimize" as const };

describe("axisScale", () => {
  test("splits the domain evenly by default", () => {
    expect(shape([1, 2], { ...axis, domain: [0, 1], ticks: 3 })).toEqual({
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
    expect(shape([0.21, 4.68], { ...axis, nice: true, includeZero: true, ticks: 6 })).toEqual({
      domain: [0, 5],
      ticks: [0, 1, 2, 3, 4, 5],
    });
    // Equal values take a wider padding, which must not cross zero either.
    expect(axisScale([0.5, 0.5], { ...axis, nice: true, includeZero: true }).domain[0]).toBe(0);
    expect(axisScale([-3, -1], { ...axis, nice: true, includeZero: true }).domain[1]).toBe(0);
  });

  test("keeps an explicit domain and ticks inside it", () => {
    expect(shape([60, 100], { ...axis, domain: [50, 104], nice: true, ticks: 6 })).toEqual({
      domain: [50, 104],
      ticks: [50, 60, 70, 80, 90, 100],
    });
  });

  test("still validates the tick count", () => {
    expect(() => axisScale([1, 2], { ...axis, nice: true, ticks: 1 })).toThrow("between 2 and 10");
  });

  test("places values proportionally on a linear axis", () => {
    const { position } = axisScale([0, 10], { ...axis, domain: [0, 10] });
    expect(position(0)).toBe(0);
    expect(position(2.5)).toBe(0.25);
    expect(position(10)).toBe(1);
  });
});

describe("log axis", () => {
  const log = { ...axis, scale: "log" as const, nice: true, ticks: 6 };

  test("ticks on round values within each decade and spaces equal ratios equally", () => {
    const { domain, ticks, position } = axisScale([0.25, 0.9, 5.1], log);
    expect(domain).toEqual([0.2, 6]);
    expect(ticks).toEqual([0.2, 0.5, 1, 2, 5]);
    expect(position(2) - position(1)).toBeCloseTo(position(1) - position(0.5), 10);
  });

  test("ends the domain close to the data at the bottom of a decade", () => {
    expect(shape([0.21, 4.68], log).domain).toEqual([0.15, 6]);
  });

  test("asks fewer ticks of a short axis, and gets 1, 3, 10 rather than 1, 2, 5, 10", () => {
    expect(shape([0.12, 5.1], { ...log, ticks: 4 }).ticks).toEqual([0.1, 0.3, 1, 3]);
    expect(shape([0.12, 5.1], log).ticks).toEqual([0.1, 0.2, 0.5, 1, 2, 5]);
  });

  test("ticks only on powers of ten across many decades", () => {
    expect(shape([0.01, 100], log).ticks).toEqual([0.01, 0.1, 1, 10, 100]);
  });

  test("falls back to a round linear step inside a fraction of a decade", () => {
    expect(shape([3.1, 3.2, 3.3], log)).toEqual({
      domain: [3.05, 3.35],
      ticks: [3.05, 3.1, 3.15, 3.2, 3.25, 3.3, 3.35],
    });
  });

  test("puts values at or below zero on a zero tick at the axis start", () => {
    const { ticks, position } = axisScale([0, 0.5, 5], log);
    expect(ticks[0]).toBe(0);
    expect(position(0)).toBe(0);
    expect(position(0.5)).toBeGreaterThan(0.05);
    expect(shape([0.5, 5], log).ticks[0]).not.toBe(0);
  });

  test("rejects a domain that is not positive", () => {
    expect(() => axisScale([1, 2], { ...log, domain: [0, 10] })).toThrow("positive");
  });
});
