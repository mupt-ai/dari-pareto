import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { CAP_HEIGHT, CHARACTER_WIDTH } from "./labels.js";

/** The viewer's text size, in percent of the plot's own. */
export const MIN_TEXT_SIZE = 50;
export const MAX_TEXT_SIZE = 200;
/** The smaller and larger buttons move between multiples of this many percent. */
const TEXT_SIZE_STEP = 10;

/** A text size kept within range and to a whole percent. */
export function clampTextSize(size: number): number {
  return Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(size)));
}

/** The next multiple of the step above (`1`) or below (`-1`) `size`, within range. */
export function stepTextSize(size: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? Math.floor(size / TEXT_SIZE_STEP) * TEXT_SIZE_STEP + TEXT_SIZE_STEP
      : Math.ceil(size / TEXT_SIZE_STEP) * TEXT_SIZE_STEP - TEXT_SIZE_STEP;
  return clampTextSize(next);
}

/**
 * A typed text size ("120", "120%", " 73.4 ", "-5"), kept in range, or `current` when it holds
 * no number. A minus sign counts, so a negative size is below the range, not above it.
 */
export function parseTextSize(typed: string, current: number): number {
  const value = Number.parseFloat(typed.replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? clampTextSize(value) : current;
}

/**
 * What a smaller (`-1`) or larger (`1`) button gives from what the field holds, typed or not
 * yet applied, or `size` when nothing in it parses: the next multiple of the step, or undefined
 * at the end of the range.
 */
export function stepFrom(typed: string, size: number, direction: 1 | -1): number | undefined {
  const current = parseTextSize(typed, size);
  if (direction > 0 ? current >= MAX_TEXT_SIZE : current <= MIN_TEXT_SIZE) return undefined;
  return stepTextSize(current, direction);
}

/** Size of the settings button, square, in the plot's top right corner. */
export const SETTINGS_BUTTON = 22;
const BUTTON = SETTINGS_BUTTON;
const EDGE = 4;

type SettingsProps = {
  width: number;
  fontSize: number;
  open: boolean;
  /** The viewer's text size, in percent. */
  size: number;
  /** On a touch screen, the least size of every control's target. */
  target?: number;
  onOpenChange: (open: boolean) => void;
  onSizeChange: (size: number) => void;
};

/**
 * A quiet settings button in the plot's top right corner, and the panel it opens: a text size
 * control with smaller and larger buttons around the size itself, which can also be typed.
 */
export function Settings({
  width,
  fontSize,
  open,
  size,
  target = 0,
  onOpenChange,
  onSizeChange,
}: SettingsProps) {
  const [draft, setDraft] = useState(String(size));
  // A new size from the buttons replaces whatever was being typed.
  useEffect(() => setDraft(String(size)), [size]);
  const commit = () => {
    const next = parseTextSize(draft, size);
    setDraft(String(next));
    if (next !== size) onSizeChange(next);
  };
  // Closing the panel applies what was typed, as leaving the field does: a press outside the
  // panel closes it before the field would lose focus, so the field never sees it go. Escape
  // puts the size back first, so closing with it changes nothing.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) commit();
    wasOpen.current = open;
  }, [open]);

  const x = width - EDGE - BUTTON;
  const y = EDGE;
  const pressed = (event: KeyboardEvent<SVGGElement>, act: () => void) => {
    if (event.key === "Escape") onOpenChange(false);
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    act();
  };

  const padding = fontSize * 0.8;
  const control = Math.max(fontSize * 1.9, target);
  const label = "Text Size";
  const labelWidth = label.length * fontSize * CHARACTER_WIDTH;
  // A touch screen's browser zooms into a field set smaller than 16px when it is tapped.
  const fieldFont = target ? Math.max(fontSize, 16) : fontSize;
  const fieldWidth = 3 * fieldFont * CHARACTER_WIDTH + fieldFont * 1.2;
  const unitWidth = fontSize * CHARACTER_WIDTH;
  const gap = fontSize * 0.4;
  const panelWidth =
    padding * 2 + labelWidth + fontSize + control * 2 + fieldWidth + unitWidth + gap * 4;
  const panelHeight = control + padding * 1.2;
  const panelLeft = width - EDGE - panelWidth;
  const panelTop = y + BUTTON + 4;
  const middle = panelTop + panelHeight / 2;
  const smallerX = panelLeft + padding + labelWidth + fontSize;
  const fieldX = smallerX + control + gap;
  const unitX = fieldX + fieldWidth + gap / 2;
  // The label's and the unit's baseline, centering them on the controls (see CAP_HEIGHT).
  const baseline = middle + (fontSize * CAP_HEIGHT) / 2;
  const largerX = unitX + unitWidth + gap * 2;

  const stepButton = (label: string, symbol: string, left: number, direction: 1 | -1) => {
    // From what the field holds: a browser that keeps focus in the field on the press has not
    // applied a typed size yet. The field then shows the result, even when it is the size
    // already applied.
    const next = stepFrom(draft, size, direction);
    const enabled = next !== undefined;
    const act = () => {
      if (next === undefined) return;
      setDraft(String(next));
      if (next !== size) onSizeChange(next);
    };
    return (
      <g
        aria-disabled={enabled ? undefined : true}
        aria-label={label}
        className={`pareto-settings-step${enabled ? "" : " disabled"}`}
        onClick={act}
        onKeyDown={(event) => pressed(event, act)}
        role="button"
        tabIndex={0}
      >
        <rect
          fill="transparent"
          height={control}
          stroke="var(--pareto-grid, #263631)"
          width={control}
          x={left}
          y={middle - control / 2}
        />
        <text
          dominantBaseline="middle"
          fill="var(--pareto-foreground, #eef4ed)"
          textAnchor="middle"
          x={left + control / 2}
          y={middle}
        >
          {symbol}
        </text>
      </g>
    );
  };

  return (
    <g className="pareto-settings" fontSize={fontSize}>
      <g
        aria-expanded={open}
        aria-label="Plot Settings"
        className="pareto-settings-button"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => pressed(event, () => onOpenChange(!open))}
        role="button"
        tabIndex={0}
      >
        {/* The button's target: the icon, or on a touch screen the corner a fingertip covers. */}
        <rect
          fill="transparent"
          height={Math.max(BUTTON, target)}
          width={Math.max(BUTTON, target)}
          x={target > BUTTON ? width - target : x}
          y={target > BUTTON ? 0 : y}
        />
        {/* Three sliders. */}
        {[
          [-4, 13],
          [0, 8],
          [4, 11],
        ].map(([dy, knob]) => (
          <g key={dy}>
            <line
              stroke="var(--pareto-muted, #91a39b)"
              strokeWidth="1.2"
              x1={x + 5}
              x2={x + BUTTON - 5}
              y1={y + BUTTON / 2 + (dy ?? 0)}
              y2={y + BUTTON / 2 + (dy ?? 0)}
            />
            <circle
              cx={x + (knob ?? 0)}
              cy={y + BUTTON / 2 + (dy ?? 0)}
              fill="var(--pareto-background, #09100f)"
              r="1.8"
              stroke="var(--pareto-muted, #91a39b)"
              strokeWidth="1.2"
            />
          </g>
        ))}
      </g>
      {open ? (
        <g className="pareto-settings-panel">
          <rect
            fill="var(--pareto-tooltip-background, var(--pareto-background, #09100f))"
            height={panelHeight}
            stroke="var(--pareto-grid, #263631)"
            width={panelWidth}
            x={panelLeft}
            y={panelTop}
          />
          <text fill="var(--pareto-muted, #91a39b)" x={panelLeft + padding} y={baseline}>
            {label}
          </text>
          {stepButton("Smaller Text", "−", smallerX, -1)}
          {/* The size itself, typed: applied on Enter or on leaving the field, kept in range. */}
          <foreignObject height={control} width={fieldWidth} x={fieldX} y={middle - control / 2}>
            <input
              aria-label="Text Size in Percent"
              className="pareto-settings-field"
              inputMode="numeric"
              onBlur={commit}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") {
                  setDraft(String(size));
                  onOpenChange(false);
                }
              }}
              style={{ fontSize: fieldFont }}
              type="text"
              value={draft}
            />
          </foreignObject>
          <text fill="var(--pareto-muted, #91a39b)" x={unitX} y={baseline}>
            %
          </text>
          {stepButton("Larger Text", "+", largerX, 1)}
        </g>
      ) : null}
    </g>
  );
}
