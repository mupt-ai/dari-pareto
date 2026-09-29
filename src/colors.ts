import { orderGroups } from "./order.js";
import type { GroupOrder, ParetoPoint } from "./types.js";

/**
 * Each point's color. A point's own `color` wins. Otherwise each group takes the next
 * `palette` color, in display order (see `groupOrder`), then each point without a group, in
 * order; the palette starts over when it runs out. Subgroups of an `expanded` group take the
 * next colors after that, one each, so expanding a group never recolors any other. Exported so a
 * page can color other parts of itself, such as a table, exactly as the plot does.
 */
export function pointColors(
  points: readonly ParetoPoint[],
  palette?: readonly string[],
  { order, expanded }: { order?: GroupOrder; expanded?: ReadonlySet<string> } = {},
): Map<string, string | undefined> {
  let used = 0;
  const next = () =>
    palette && palette.length > 0 ? palette[used++ % palette.length] : undefined;
  const groups = orderGroups(points, order);
  const groupColor = new Map<string, string | undefined>();
  for (const name of groups) {
    const needsOne = points.some((point) => point.group === name && !point.color);
    groupColor.set(name, needsOne ? next() : undefined);
  }
  const colors = new Map<string, string | undefined>();
  for (const point of points) {
    colors.set(point.id, point.color ?? (point.group ? groupColor.get(point.group) : next()));
  }
  for (const name of groups.filter((group) => expanded?.has(group))) {
    const subgroups = [
      ...new Set(points.flatMap((point) => (point.group === name && point.subgroup ? [point.subgroup] : []))),
    ];
    for (const subgroup of subgroups) {
      const color = next();
      if (color === undefined) continue;
      for (const point of points) {
        if (point.group === name && point.subgroup === subgroup) colors.set(point.id, color);
      }
    }
  }
  return colors;
}
