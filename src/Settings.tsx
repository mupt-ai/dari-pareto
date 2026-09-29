import type { KeyboardEvent } from "react";

import { CHARACTER_WIDTH } from "./labels.js";

/** Text size steps a viewer can take from the plot's own size, each 15 percent. */
const STEP_FACTOR = 1.15;
export const MIN_TEXT_STEP = -3;
export const MAX_TEXT_STEP = 4;

/** How much a viewer's text size step scales the plot's text. */
export function textFactor(step: number): number {
  return STEP_FACTOR ** step;
}

/** Size of the settings button, square, in the plot's top right corner. */
const BUTTON = 22;
const EDGE = 4;

type SettingsProps = {
  width: number;
  fontSize: number;
  open: boolean;
  step: number;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: number) => void;
};

/**
 * A quiet settings button in the plot's top right corner, and the panel it opens: a text size
 * control with smaller and larger buttons and the current size.
 */
export function Settings({ width, fontSize, open, step, onOpenChange, onStepChange }: SettingsProps) {
  const x = width - EDGE - BUTTON;
  const y = EDGE;
  const pressed = (event: KeyboardEvent<SVGGElement>, act: () => void) => {
    if (event.key === "Escape") onOpenChange(false);
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    act();
  };

  const padding = fontSize * 0.8;
  const control = fontSize * 1.9;
  const label = "Text Size";
  const value = `${Math.round(textFactor(step) * 100)}%`;
  const labelWidth = label.length * fontSize * CHARACTER_WIDTH;
  const valueWidth = "100%".length * fontSize * CHARACTER_WIDTH;
  const panelWidth = padding * 2 + labelWidth + fontSize + control * 2 + valueWidth + fontSize;
  const panelHeight = control + padding * 1.2;
  const panelLeft = width - EDGE - panelWidth;
  const panelTop = y + BUTTON + 4;
  const middle = panelTop + panelHeight / 2;
  const smallerX = panelLeft + padding + labelWidth + fontSize;
  const valueX = smallerX + control + fontSize / 2 + valueWidth / 2;
  const largerX = smallerX + control + fontSize + valueWidth;

  const stepButton = (label: string, symbol: string, left: number, to: number, enabled: boolean) => (
    <g
      aria-disabled={enabled ? undefined : true}
      aria-label={label}
      className={`pareto-settings-step${enabled ? "" : " disabled"}`}
      onClick={enabled ? () => onStepChange(to) : undefined}
      onKeyDown={(event) => pressed(event, () => enabled && onStepChange(to))}
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
        <rect fill="transparent" height={BUTTON} width={BUTTON} x={x} y={y} />
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
          <text dominantBaseline="middle" fill="var(--pareto-muted, #91a39b)" x={panelLeft + padding} y={middle}>
            {label}
          </text>
          {stepButton("Smaller Text", "−", smallerX, step - 1, step > MIN_TEXT_STEP)}
          <text
            dominantBaseline="middle"
            fill="var(--pareto-foreground, #eef4ed)"
            textAnchor="middle"
            x={valueX}
            y={middle}
          >
            {value}
          </text>
          {stepButton("Larger Text", "+", largerX, step + 1, step < MAX_TEXT_STEP)}
        </g>
      ) : null}
    </g>
  );
}
