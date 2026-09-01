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
