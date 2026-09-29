/** The point nearest to (`x`, `y`) within `reach`, or nothing when none is that close. */
export function nearestWithin<T extends { x: number; y: number }>(
  points: readonly T[],
  x: number,
  y: number,
  reach: number,
): T | undefined {
  let nearest: T | undefined;
  let best = reach * reach;
  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance <= best) {
      nearest = point;
      best = distance;
    }
  }
  return nearest;
}
