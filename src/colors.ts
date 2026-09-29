import type { ParetoPoint } from "./types.js";

/**
 * Each point's color: its own `color` if it has one, otherwise the next `palette` color for
 * its group (or for the point itself, when it has no group), in order of first appearance,
 * starting over when there are more groups than colors. Exported so a page can color other
 * parts of itself, such as a table, exactly as the plot does.
 */
export function pointColors(
  points: readonly ParetoPoint[],
  palette?: readonly string[],
): Map<string, string | undefined> {
  const assigned = new Map<string, string>();
  const colors = new Map<string, string | undefined>();
  for (const point of points) {
    if (point.color || !palette || palette.length === 0) {
      colors.set(point.id, point.color);
      continue;
    }
    const key = point.group ?? `point:${point.id}`;
    let color = assigned.get(key);
    if (color === undefined) {
      color = palette[assigned.size % palette.length] ?? "";
      assigned.set(key, color);
    }
    colors.set(point.id, color);
  }
  return colors;
}
