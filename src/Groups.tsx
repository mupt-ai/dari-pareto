import type { KeyboardEvent } from "react";

import { CAP_HEIGHT, CHARACTER_WIDTH } from "./labels.js";
import { orderGroups } from "./order.js";
import type { GroupOrder, ParetoPoint } from "./types.js";

export type Group = {
  name: string;
  color: string;
  /** Its subgroups, in order of first appearance, each in its first point's color. */
  subgroups: { name: string; color: string }[];
};

/** What a chip stands for, as one string: a group, or a subgroup within one. */
export function chipKey(group: string, subgroup?: string): string {
  return JSON.stringify(subgroup === undefined ? [group] : [group, subgroup]);
}

export function parseChipKey(key: string): { group: string; subgroup?: string } {
  const [group = "", subgroup] = JSON.parse(key) as string[];
  return subgroup === undefined ? { group } : { group, subgroup };
}

type Chip = {
  key: string;
  group: string;
  name: string;
  color: string;
  /** 0 for a group, 1 for a subgroup listed under its expanded group. */
  depth: 0 | 1;
  expandable: boolean;
  expanded: boolean;
  x: number;
  y: number;
  /** The chip's dot and name; a chevron, if any, sits after it. */
  width: number;
  /** The chip's target: its row's height, and at least `target` wide. */
  hitWidth: number;
  hitHeight: number;
  /** The chevron's target width, from just before the chevron. */
  toggleWidth: number;
};

const fallback = "var(--pareto-frontier, #8ee6bd)";

/**
 * The points' groups in display order (see `orderGroups`), each in its first point's color and
 * each subgroup in its first point's. `groupColorOf` colors the groups themselves when it
 * differs, as while a group is expanded: its points take their subgroups' colors, its chip keeps
 * the group's.
 */
export function groupsOf(
  points: readonly ParetoPoint[],
  colorOf: ReadonlyMap<string, string | undefined> = new Map(),
  order?: GroupOrder,
  groupColorOf: ReadonlyMap<string, string | undefined> = colorOf,
): Group[] {
  const colorFor = (point: ParetoPoint) => colorOf.get(point.id) ?? point.color ?? fallback;
  const groupColorFor = (point: ParetoPoint) => groupColorOf.get(point.id) ?? point.color ?? fallback;
  return orderGroups(points, order).map((name) => {
    const members = points.filter((point) => point.group === name);
    const subgroups = new Map<string, string>();
    for (const point of members) {
      if (point.subgroup && !subgroups.has(point.subgroup)) subgroups.set(point.subgroup, colorFor(point));
    }
    return {
      name,
      color: members[0] ? groupColorFor(members[0]) : fallback,
      subgroups: [...subgroups].map(([subgroup, color]) => ({ name: subgroup, color })),
    };
  });
}

/**
 * Chips in rows from `left`, wrapping within `maxWidth`: each group, followed by its subgroups
 * when it is expanded. A group with subgroups gets room for a chevron unless `expandable` is
 * false, as on a static plot. `target`, for a touch screen, is the least size of every chip's
 * and chevron's target; rows are spaced to fit it. `height` is the rows' total height.
 */
export function layoutGroups(
  groups: readonly Group[],
  expanded: ReadonlySet<string>,
  {
    left,
    top,
    maxWidth,
    fontSize,
    expandable: canExpand = true,
    target = 0,
  }: {
    left: number;
    top: number;
    maxWidth: number;
    fontSize: number;
    expandable?: boolean;
    target?: number;
  },
): { chips: Chip[]; height: number } {
  const rowHeight = Math.max(fontSize * 2, target);
  const spacing = fontSize * 1.4;
  const toggleWidth = Math.max(fontSize * 1.2, target);
  const chips: Chip[] = [];
  let x = left;
  let row = 0;
  const place = (chip: Omit<Chip, "x" | "y" | "width" | "hitWidth" | "hitHeight" | "toggleWidth">) => {
    const width = fontSize * 1.3 + chip.name.length * fontSize * CHARACTER_WIDTH;
    const hitWidth = Math.max(width + fontSize * 0.8, target);
    const room = width + (chip.expandable ? fontSize * 1.3 : 0);
    // On a touch screen the targets can be wider than the chip; the next chip starts after them.
    // The chevron's target starts just before it, 0.55 em past the name.
    const reach = target
      ? Math.max(room, hitWidth - fontSize * 0.4, chip.expandable ? width - fontSize * 0.05 + toggleWidth : 0)
      : room;
    if (x > left && x + reach > left + maxWidth) {
      x = left;
      row++;
    }
    const y = top + row * rowHeight + rowHeight / 2;
    chips.push({ ...chip, x, y, width, hitWidth, hitHeight: rowHeight, toggleWidth });
    x += reach + spacing;
  };
  for (const group of groups) {
    const expandable = canExpand && group.subgroups.length > 0;
    const open = expandable && expanded.has(group.name);
    place({ key: chipKey(group.name), group: group.name, name: group.name, color: group.color, depth: 0, expandable, expanded: open });
    if (!open) continue;
    for (const subgroup of group.subgroups) {
      place({
        key: chipKey(group.name, subgroup.name),
        group: group.name,
        name: subgroup.name,
        color: subgroup.color,
        depth: 1,
        expandable: false,
        expanded: false,
      });
    }
  }
  return { chips, height: groups.length > 0 ? (row + 1) * rowHeight : 0 };
}

type GroupLegendProps = {
  chips: readonly Chip[];
  fontSize: number;
  /** The chip shown, if any: the rest step back, except its group or its subgroups. */
  highlighted: string | null;
  /** The chip held by a click or tap, if any. */
  pinned: string | null;
  interactive: boolean;
  onHover: (key: string | null) => void;
  onPin: (key: string | null) => void;
  /** Lists or hides a group's subgroups. */
  onToggle: (group: string) => void;
};

/**
 * A row of chips, one per group, above the plot: a dot in the group's color and its name.
 * Hovering or focusing a chip highlights its group; a click or tap holds the highlight until
 * the chip is pressed again, which is how a touch screen uses it. A group with subgroups has a
 * chevron after its name that lists them as chips of their own.
 */
export function GroupLegend({
  chips,
  fontSize,
  highlighted,
  pinned,
  interactive,
  onHover,
  onPin,
  onToggle,
}: GroupLegendProps) {
  const shown = highlighted === null ? null : parseChipKey(highlighted);
  // The highlighted chip stays bright, and so do its group's chip and, for a group, its subgroups.
  const bright = (chip: Chip) =>
    shown === null ||
    chip.key === highlighted ||
    (chip.group === shown.group && (shown.subgroup === undefined || chip.depth === 0));
  const pressed = (event: KeyboardEvent<SVGGElement>, act: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    act();
  };
  const toggle = (key: string) => onPin(pinned === key ? null : key);
  return (
    <g aria-label={interactive ? "Groups" : undefined} className="pareto-groups" fontSize={fontSize}>
      {chips.map((chip) => {
        const chevronX = chip.x + chip.width + fontSize * 0.55;
        const size = fontSize * 0.32;
        return (
          <g key={chip.key}>
            <g
              aria-label={interactive ? `Highlight ${chip.name}` : undefined}
              aria-pressed={interactive ? pinned === chip.key : undefined}
              className={`pareto-group${bright(chip) ? "" : " muted"}${pinned === chip.key ? " pinned" : ""}${chip.depth ? " subgroup" : ""}`}
              onBlur={interactive ? () => onHover(null) : undefined}
              onClick={interactive ? () => toggle(chip.key) : undefined}
              onFocus={interactive ? () => onHover(chip.key) : undefined}
              onKeyDown={interactive ? (event) => pressed(event, () => toggle(chip.key)) : undefined}
              onMouseEnter={interactive ? () => onHover(chip.key) : undefined}
              onMouseLeave={interactive ? () => onHover(null) : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              <rect
                fill="transparent"
                height={chip.hitHeight}
                width={chip.hitWidth}
                x={chip.x - fontSize * 0.4}
                y={chip.y - chip.hitHeight / 2}
              />
              <circle cx={chip.x + fontSize * 0.35} cy={chip.y} fill={chip.color} r={fontSize * 0.35} />
              {/* Centered on the dot and the chevron (see CAP_HEIGHT). */}
              <text
                fill="var(--pareto-muted, #91a39b)"
                x={chip.x + fontSize * 1.3}
                y={chip.y + (fontSize * CAP_HEIGHT) / 2}
              >
                {chip.name}
              </text>
            </g>
            {chip.expandable && interactive ? (
              <g
                aria-expanded={chip.expanded}
                aria-label={`${chip.expanded ? "Collapse" : "Expand"} ${chip.name}`}
                className="pareto-group-toggle"
                onClick={() => onToggle(chip.group)}
                onKeyDown={(event) => pressed(event, () => onToggle(chip.group))}
                role="button"
                tabIndex={0}
              >
                <rect
                  fill="transparent"
                  height={chip.hitHeight}
                  width={chip.toggleWidth}
                  x={chevronX - fontSize * 0.6}
                  y={chip.y - chip.hitHeight / 2}
                />
                <path
                  d={
                    chip.expanded
                      ? `M${chevronX - size} ${chip.y - size / 2} L${chevronX} ${chip.y + size / 2} L${chevronX + size} ${chip.y - size / 2}`
                      : `M${chevronX - size / 2} ${chip.y - size} L${chevronX + size / 2} ${chip.y} L${chevronX - size / 2} ${chip.y + size}`
                  }
                  fill="none"
                  stroke="var(--pareto-muted, #91a39b)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={Math.max(1, fontSize * 0.12)}
                />
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
