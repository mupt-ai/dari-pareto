import type { KeyboardEvent } from "react";

import { CHARACTER_WIDTH } from "./labels.js";
import type { ParetoPoint } from "./types.js";

export type Group = { name: string; color: string };

type Chip = Group & { x: number; y: number; width: number };

/** The points' groups in order of first appearance, each in its first point's color. */
export function groupsOf(
  points: readonly ParetoPoint[],
  colorOf: ReadonlyMap<string, string | undefined> = new Map(),
): Group[] {
  const groups = new Map<string, string>();
  for (const point of points) {
    if (point.group && !groups.has(point.group)) {
      groups.set(point.group, colorOf.get(point.id) ?? point.color ?? "var(--pareto-frontier, #8ee6bd)");
    }
  }
  return [...groups].map(([name, color]) => ({ name, color }));
}

/** Chips in rows from `left`, wrapping within `maxWidth`; `height` is the rows' total height. */
export function layoutGroups(
  groups: readonly Group[],
  { left, top, maxWidth, fontSize }: { left: number; top: number; maxWidth: number; fontSize: number },
): { chips: Chip[]; height: number } {
  const rowHeight = fontSize * 2;
  const spacing = fontSize * 1.4;
  const chips: Chip[] = [];
  let x = left;
  let row = 0;
  for (const group of groups) {
    const width = fontSize * 1.3 + group.name.length * fontSize * CHARACTER_WIDTH;
    if (x > left && x + width > left + maxWidth) {
      x = left;
      row++;
    }
    chips.push({ ...group, x, y: top + row * rowHeight + rowHeight / 2, width });
    x += width + spacing;
  }
  return { chips, height: groups.length > 0 ? (row + 1) * rowHeight : 0 };
}

type GroupLegendProps = {
  chips: readonly Chip[];
  fontSize: number;
  /** The group shown, if any: every other chip steps back. */
  highlighted: string | null;
  /** The group held by a click or tap, if any. */
  pinned: string | null;
  interactive: boolean;
  onHover: (group: string | null) => void;
  onPin: (group: string | null) => void;
};

/**
 * A row of chips, one per group, above the plot: a dot in the group's color and its name.
 * Hovering or focusing a chip highlights its group; a click or tap holds the highlight until
 * the chip is pressed again, which is how a touch screen uses it.
 */
export function GroupLegend({
  chips,
  fontSize,
  highlighted,
  pinned,
  interactive,
  onHover,
  onPin,
}: GroupLegendProps) {
  const toggle = (name: string) => onPin(pinned === name ? null : name);
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, name: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle(name);
  };
  return (
    <g aria-label={interactive ? "Groups" : undefined} className="pareto-groups" fontSize={fontSize}>
      {chips.map((chip) => (
        <g
          aria-label={interactive ? `Highlight ${chip.name}` : undefined}
          aria-pressed={interactive ? pinned === chip.name : undefined}
          className={`pareto-group${highlighted && highlighted !== chip.name ? " muted" : ""}${pinned === chip.name ? " pinned" : ""}`}
          key={chip.name}
          onBlur={interactive ? () => onHover(null) : undefined}
          onClick={interactive ? () => toggle(chip.name) : undefined}
          onFocus={interactive ? () => onHover(chip.name) : undefined}
          onKeyDown={interactive ? (event) => handleKeyDown(event, chip.name) : undefined}
          onMouseEnter={interactive ? () => onHover(chip.name) : undefined}
          onMouseLeave={interactive ? () => onHover(null) : undefined}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
        >
          <rect
            fill="transparent"
            height={fontSize * 2}
            width={chip.width + fontSize * 0.8}
            x={chip.x - fontSize * 0.4}
            y={chip.y - fontSize}
          />
          <circle cx={chip.x + fontSize * 0.35} cy={chip.y} fill={chip.color} r={fontSize * 0.35} />
          <text
            dominantBaseline="middle"
            fill="var(--pareto-muted, #91a39b)"
            x={chip.x + fontSize * 1.3}
            y={chip.y}
          >
            {chip.name}
          </text>
        </g>
      ))}
    </g>
  );
}
