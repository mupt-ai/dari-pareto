import type { FrontierOptions, Objective, ParetoPoint } from "./types.js";

function compareForObjective(left: number, right: number, objective: Objective): number {
  return objective === "minimize" ? left - right : right - left;
}

function atLeastAsGood(left: number, right: number, objective: Objective): boolean {
  return objective === "minimize" ? left <= right : left >= right;
}

function better(left: number, right: number, objective: Objective): boolean {
  return objective === "minimize" ? left < right : left > right;
}

export function dominates(
  candidate: Pick<ParetoPoint, "x" | "y">,
  other: Pick<ParetoPoint, "x" | "y">,
  options: FrontierOptions = {},
): boolean {
  const xObjective = options.xObjective ?? "minimize";
  const yObjective = options.yObjective ?? "maximize";
  return (
    atLeastAsGood(candidate.x, other.x, xObjective) &&
    atLeastAsGood(candidate.y, other.y, yObjective) &&
    (better(candidate.x, other.x, xObjective) || better(candidate.y, other.y, yObjective))
  );
}

export function paretoFrontier<T extends ParetoPoint>(
  points: readonly T[],
  options: FrontierOptions = {},
): T[] {
  validatePoints(points);
  const xObjective = options.xObjective ?? "minimize";
  const yObjective = options.yObjective ?? "maximize";
  const sorted = [...points].sort((left, right) => {
    const xOrder = compareForObjective(left.x, right.x, xObjective);
    if (xOrder !== 0) return xOrder;
    const yOrder = compareForObjective(left.y, right.y, yObjective);
    if (yOrder !== 0) return yOrder;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  const frontier: T[] = [];
  let bestPreviousY: number | undefined;

  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].x === sorted[start].x) end += 1;

    const bestAtX = sorted[start].y;
    if (bestPreviousY === undefined || better(bestAtX, bestPreviousY, yObjective)) {
      for (let index = start; index < end && sorted[index].y === bestAtX; index += 1) {
        frontier.push(sorted[index]);
      }
    }
    if (bestPreviousY === undefined || better(bestAtX, bestPreviousY, yObjective)) {
      bestPreviousY = bestAtX;
    }
    start = end;
  }

  return frontier;
}

export function validatePoints(points: readonly ParetoPoint[]): void {
  const ids = new Set<string>();
  for (const point of points) {
    if (!point.id) throw new Error("Pareto point ids must be non-empty.");
    if (ids.has(point.id)) throw new Error(`Duplicate Pareto point id: ${point.id}`);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error(`Pareto point ${point.id} must have finite x and y values.`);
    }
    ids.add(point.id);
  }
}
