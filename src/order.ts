import type { GroupOrder, ParetoPoint } from "./types.js";

/**
 * The points' group names in display order: the groups named in `first`, in that order; then
 * the rest, by first appearance or by how many points each has (most first, ties by first
 * appearance); then the groups named in `last`, in that order, whatever the other rules say.
 */
export function orderGroups(points: readonly ParetoPoint[], order: GroupOrder = {}): string[] {
  const counts = new Map<string, number>();
  for (const point of points) {
    if (point.group) counts.set(point.group, (counts.get(point.group) ?? 0) + 1);
  }
  const present = (names: readonly string[] = []) => names.filter((name) => counts.has(name));
  const first = present(order.first);
  const last = present(order.last).filter((name) => !first.includes(name));
  const rest = [...counts.keys()].filter((name) => !first.includes(name) && !last.includes(name));
  if (order.rest === "count") {
    // A stable sort keeps first appearance among groups of the same size.
    rest.sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0));
  }
  return [...first, ...rest, ...last];
}
