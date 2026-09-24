import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ParetoPlot, type ParetoPlotProps } from "../src";
import { ParetoSvg } from "../src/ParetoSvg";
import { renderParetoPlot } from "../src/static";

function elementsWithRole(node: ReactNode, role: string): ReactElement<Record<string, unknown>>[] {
  const matches: ReactElement<Record<string, unknown>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<Record<string, unknown>>;
    if (element.props.role === role) matches.push(element);
    matches.push(...elementsWithRole(element.props.children as ReactNode, role));
  });
  return matches;
}

const props = {
  points: [
    { id: "small", label: "Small", x: 0.01, y: 70 },
    { id: "large", label: "Large", x: 0.03, y: 90 },
    { id: "weak", label: "Weak", x: 0.04, y: 80 },
  ],
  xAxis: { label: "Cost / Task", objective: "minimize" as const },
  yAxis: { label: "Score", objective: "maximize" as const, domain: [0, 100] as const },
  title: "Model Comparison",
} satisfies ParetoPlotProps;

describe("ParetoPlot", () => {
  test("renders an accessible interactive plot", () => {
    const markup = renderToStaticMarkup(<ParetoPlot {...props} />);

    expect(markup).toContain('role="group"');
    expect(markup).toContain("Model Comparison");
    expect(markup).toContain('role="button"');
    expect(markup).toContain("Pareto-efficient");
    expect(markup).toContain("Selected");
  });

  test("keeps keyboard focus active when pointer hover ends", () => {
    let focusedId = null as string | null;
    let hoveredId = null as string | null;
    const render = () =>
      ParetoSvg({
        ...props,
        focusedId,
        hoveredId,
        onFocusedIdChange: (id) => {
          focusedId = id;
        },
        onHoveredIdChange: (id) => {
          hoveredId = id;
        },
      });

    const firstPoint = elementsWithRole(render(), "button")[0];
    (firstPoint.props.onFocus as () => void)();
    (firstPoint.props.onMouseEnter as () => void)();
    (firstPoint.props.onMouseLeave as () => void)();

    expect(focusedId).toBe("small");
    expect(hoveredId).toBeNull();
    expect(elementsWithRole(render(), "button")[0].props.className).toContain("selected");
  });

  test("renders static SVG without interactive controls", () => {
    const markup = renderParetoPlot({ ...props, showPointLabels: "frontier" });

    expect(markup.startsWith("<svg")).toBe(true);
    expect(markup).toContain('role="img"');
    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain("tabindex");
    expect(markup).toContain("Small");
  });

  test("handles an empty plot", () => {
    const markup = renderParetoPlot({ ...props, points: [] });

    expect(markup).toContain("NO DATA");
    expect(markup).toContain("0 points");
  });

  test("rejects invalid dimensions and domains", () => {
    expect(() => renderParetoPlot({ ...props, width: 0 })).toThrow("at least 320 × 240");
    expect(() =>
      renderParetoPlot({ ...props, yAxis: { ...props.yAxis, domain: [1, 1] } }),
    ).toThrow("increasing values");
  });
});

describe("ParetoPlot options", () => {
  const hovered = (extra: Partial<ParetoPlotProps> = {}) =>
    renderToStaticMarkup(ParetoSvg({ ...props, showPointLabels: "all", hoveredId: "large", ...extra }));

  test("draws nothing new unless asked", () => {
    const markup = hovered();

    expect(markup).not.toContain("pareto-tooltip");
    expect(markup).not.toContain("dimmed");
    expect(markup).not.toContain("--pareto-point-color");
    expect(markup).toContain('font-weight="700"');
    expect(markup).toContain("Selected");
  });

  test("colors points: Pareto-efficient ones filled, dominated ones ringed", () => {
    const markup = renderParetoPlot({
      ...props,
      points: props.points.map((point) => ({ ...point, color: "#123456" })),
    });

    expect(markup).toContain("--pareto-point-color:#123456");
    expect(markup).toContain('fill="#123456"');
    expect(markup).toContain('fill="var(--pareto-background, #09100f)" r="3.5"');
    expect(markup).toContain("Dominated");
    expect(markup).not.toContain("Selected");
  });

  test("places crowded labels beside or below instead of on top of each other", () => {
    const markup = renderParetoPlot({
      ...props,
      points: [
        { id: "a", label: "Alpha", x: 0.5, y: 50 },
        { id: "b", label: "Beta", x: 0.502, y: 50 },
      ],
      xAxis: { ...props.xAxis, domain: [0, 1] },
      showPointLabels: "all",
      labelPlacement: "auto",
    });

    expect(markup).toContain(">Alpha<");
    expect(markup).toContain(">Beta<");
    expect(markup).toMatch(/text-anchor="(start|end)"[^>]*>(Alpha|Beta)</);
  });

  test("shows a card in place of the hovered point's label", () => {
    const markup = hovered({
      showTooltip: true,
      xAxis: { ...props.xAxis, format: (value) => `$${value.toFixed(2)}` },
    });

    expect(markup).toContain('class="pareto-tooltip"');
    expect(markup).toContain(">$0.03<");
    expect(markup.match(/>Large</g)).toHaveLength(1);
    expect(markup).toContain("pareto-point-label visible dimmed");
    expect(renderParetoPlot({ ...props, showTooltip: true })).not.toContain("pareto-tooltip");
  });

  test("can hide the title and scale text", () => {
    const markup = renderParetoPlot({ ...props, showTitle: false, showLegend: false, textScale: 2 });

    expect(markup).not.toContain('font-weight="700"');
    expect(markup).toContain('font-size="22"');
    expect(() => renderParetoPlot({ ...props, textScale: 0 })).toThrow("text scale");
  });

  test("with scaled text, fits the left margin so the y-axis title clears the tick labels", () => {
    const wide = { ...props.yAxis, format: (value: number) => `${value} widgets` };
    const titleX = (markup: string) => Number(markup.match(/rotate\(-90 ([\d.]+) /)?.[1]);
    const plotLeft = (markup: string) => Number(markup.match(/<line [^>]*x1="([\d.]+)"/)?.[1]);

    // Unscaled plots keep the fixed layout, however wide their labels.
    const fixed = renderParetoPlot({ ...props, yAxis: wide });
    expect(titleX(fixed)).toBe(16);
    expect(plotLeft(fixed)).toBe(54);

    const fitted = renderParetoPlot({ ...props, yAxis: wide, textScale: 1.25 });
    const labelWidth = "100 widgets".length * 10 * 1.25 * 0.62;
    const labelsStart = plotLeft(fitted) - 10 - labelWidth;
    // The title's glyphs end about 0.2 em right of its rotated baseline.
    expect(labelsStart - (titleX(fitted) + 11 * 1.25 * 0.2)).toBeGreaterThanOrEqual(10);
  });
});
