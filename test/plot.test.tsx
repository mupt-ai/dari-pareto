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
    expect(markup).not.toContain("pareto-group");
    expect(markup).not.toContain("pareto-settings");
    expect(markup).not.toContain("pareto-tick-mark");
    expect(markup).toContain('font-weight="700"');
    expect(markup).toContain("Selected");
  });

  test("marks each tick outside the plot's edge on the axes that ask for it", () => {
    const markup = renderParetoPlot({
      ...props,
      xAxis: { ...props.xAxis, nice: true, ticks: 4, tickMarks: true },
    });
    const attribute = (tag: string, name: string) => Number(tag.match(new RegExp(` ${name}="([^"]+)"`))?.[1]);
    const marks = [...markup.matchAll(/<line class="pareto-tick-mark"[^>]*>/g)].map((match) => match[0]);
    const tickLabels = [...markup.matchAll(/<text[^>]*font-size="9" text-anchor="middle"[^>]*>/g)].map((match) => match[0]);

    // One vertical mark per x tick label, at its x, hanging 5px below the plot; none on y.
    expect(marks.length).toBeGreaterThan(1);
    expect(marks.map((mark) => attribute(mark, "x1"))).toEqual(tickLabels.map((label) => attribute(label, "x")));
    for (const mark of marks) {
      expect(attribute(mark, "x2")).toBe(attribute(mark, "x1"));
      expect(attribute(mark, "y2") - attribute(mark, "y1")).toBe(5);
    }
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

describe("ParetoPlot layering and settings", () => {
  test("points never slide when the plot is redrawn at another size", () => {
    // In SVG a circle's cx and cy are CSS properties, so a blanket transition would animate a
    // point to its new place while the axes jump there, leaving it outside the plot meanwhile.
    const style = renderToStaticMarkup(ParetoSvg(props)).match(/\.pareto-point circle \{[^}]*\}/)?.[0] ?? "";
    expect(style).toContain("transition: r .2s, fill .2s, stroke .2s, filter .2s;");
    expect(style).not.toMatch(/transition: [^;]*\b(cx|cy|all)\b/);
    expect(style).not.toMatch(/transition: \.2s/);
  });

  const grouped = props.points.map((point) => ({ ...point, group: point.id === "large" ? "Top" : "Rest" }));

  test("paints the hover card over the group chips, which it can reach beside a top point", () => {
    const markup = renderToStaticMarkup(
      ParetoSvg({ ...props, points: grouped, showGroups: true, showTooltip: true, hoveredId: "large" }),
    );
    expect(markup.indexOf('class="pareto-tooltip"')).toBeGreaterThan(markup.indexOf('class="pareto-groups"'));
  });

  test("a press that closes the settings panel selects nothing and presses no chip", () => {
    const closed: boolean[] = [];
    const svg = ParetoSvg({
      ...props,
      hoverRadius: 30,
      showSettings: true,
      settingsOpen: true,
      onSettingsOpenChange: (open) => closed.push(open),
    }) as ReactElement<Record<string, unknown>>;
    const element = { dataset: {} as Record<string, string> };
    const press = (inPanel: boolean) => {
      let stopped = false;
      const event = {
        target: { closest: (selector: string) => (inPanel && selector.includes("pareto-settings") ? {} : null) },
        currentTarget: element,
        pointerType: "mouse",
        stopPropagation: () => {
          stopped = true;
        },
      };
      (svg.props.onPointerDown as (event: unknown) => void)(event);
      (svg.props.onClickCapture as (event: unknown) => void)(event);
      return stopped;
    };

    // Outside the panel: it closes, and the click that follows goes no further.
    expect(press(false)).toBe(true);
    expect(closed).toEqual([false]);
    expect("dismissing" in element.dataset).toBe(false);
    // Inside it: the panel's own controls get the click.
    expect(press(true)).toBe(false);
    expect(closed).toEqual([false]);
  });
});

describe("ParetoPlot on touch screens", () => {
  const grouped = props.points.map((point) => ({ ...point, group: point.id === "large" ? "Top" : "Rest" }));
  const ungated = (markup: string) =>
    markup
      .replace(/@media \(hover: hover\) \{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "")
      .match(/[^{}]*:hover[^{}]*\{/g) ?? [];

  test("keeps every hover look behind @media (hover: hover), so a tap cannot leave it on", () => {
    const markup = renderToStaticMarkup(
      ParetoSvg({
        ...props,
        points: grouped.map((point) => ({ ...point, color: "#123456" })),
        showGroups: true,
        showSettings: true,
        showTooltip: true,
      }),
    );
    expect(markup).toContain("@media (hover: hover)");
    expect(ungated(markup)).toEqual([]);
  });

  test("gives points a fingertip target only when the pointer picks by radius", () => {
    const hits = (extra: Partial<Parameters<typeof ParetoSvg>[0]>) =>
      [...renderToStaticMarkup(ParetoSvg({ ...props, ...extra })).matchAll(/class="pareto-hit"[^>]*r="([\d.]+)"/g)].map(
        (match) => Number(match[1]),
      );
    expect(hits({})).toEqual([]);
    expect(hits({ hoverRadius: 36 })).toEqual([22, 22, 22]);
    expect(hits({ hoverRadius: 10 })).toEqual([10, 10, 10]);
    expect(hits({ hoverRadius: 36, mode: "static" })).toEqual([]);
    expect(hits({ hoverRadius: 36, touchTarget: 52 })).toEqual([26, 26, 26]);
  });

  test("sizes chips and the settings button for a fingertip on touch, and only then", () => {
    const heights = (touchTarget: number) => {
      const markup = renderToStaticMarkup(
        ParetoSvg({ ...props, points: grouped, showGroups: true, showSettings: true, touchTarget }),
      );
      const chip = markup.match(/aria-label="Highlight Top"[^>]*><rect[^>]*height="([\d.]+)"/)?.[1];
      const settings = markup.match(/aria-label="Plot Settings"[^>]*><rect[^>]*height="([\d.]+)"/)?.[1];
      return [Number(chip), Number(settings)];
    };
    expect(heights(0)).toEqual([18, 22]);
    expect(heights(44)).toEqual([44, 44]);
    // A plot drawn smaller than its width asks for more of its own units.
    expect(heights(52)).toEqual([52, 52]);
  });
});

describe("ParetoPlot touch targets", () => {
  const number = (tag: string, name: string) => Number(tag.match(new RegExp(` ${name}="([^"]+)"`))?.[1]);
  const rects = (markup: string, label: string) =>
    [...markup.matchAll(new RegExp(`aria-label="${label}[^"]*"[^>]*><rect[^>]*>`, "g"))].map((match) => {
      const rect = match[0].slice(match[0].indexOf("<rect"));
      return { left: number(rect, "x"), right: number(rect, "x") + number(rect, "width"), top: number(rect, "y") };
    });

  test("keep a short chip's target and its chevron's apart", () => {
    const points = [
      { id: "a", label: "A", x: 1, y: 60, group: "AI", subgroup: "one" },
      { id: "b", label: "B", x: 2, y: 80, group: "AI", subgroup: "two" },
    ];
    const markup = renderToStaticMarkup(ParetoSvg({ ...props, points, showGroups: true, touchTarget: 44 }));
    const [chip] = rects(markup, "Highlight AI");
    const [chevron] = rects(markup, "Expand AI");
    expect(chip && chevron && chip.right - chevron.left).toBeLessThan(1e-6);
  });

  test("keep chips and the plot clear of the settings button's target", () => {
    const grouped = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      label: `P${index}`,
      x: index + 1,
      y: 50 + index,
      group: `Vendor ${index}`,
    }));
    const width = 400;
    const markup = renderToStaticMarkup(
      ParetoSvg({ ...props, points: grouped, width, showGroups: true, showSettings: true, touchTarget: 52 }),
    );
    for (const chip of rects(markup, "Highlight")) expect(chip.right).toBeLessThanOrEqual(width - 52);
    const bare = renderToStaticMarkup(
      ParetoSvg({ ...props, width, showTitle: false, showLegend: false, showSettings: true, touchTarget: 52 }),
    );
    const gridTop = Math.min(...[...bare.matchAll(/<line stroke="var\(--pareto-grid[^>]*y1="([\d.]+)"/g)].map((match) => Number(match[1])));
    expect(gridTop).toBeGreaterThanOrEqual(52);
  });
});

describe("ParetoPlot label choice", () => {
  const panel = (extra: Partial<Parameters<typeof ParetoSvg>[0]>) =>
    ParetoSvg({ ...props, showSettings: true, settingsOpen: true, ...extra }) as ReactElement<Record<string, unknown>>;
  // The settings panel element, found by the props it is given.
  const settingsOf = (node: ReactNode): ReactElement<Record<string, unknown>> | undefined => {
    let found: ReactElement<Record<string, unknown>> | undefined;
    Children.forEach(node, (child) => {
      if (found || !isValidElement(child)) return;
      const element = child as ReactElement<Record<string, unknown>>;
      found = "onSizeChange" in element.props ? element : settingsOf(element.props.children as ReactNode);
    });
    return found;
  };

  test("offers frontier or all labels in the settings panel, starting from the plot's own", () => {
    const chosen: string[] = [];
    const svg = panel({ showPointLabels: "frontier", onPointLabelsChange: (labels) => chosen.push(labels) });
    const markup = renderToStaticMarkup(svg);
    expect(markup).toContain(">Labels</text>");
    expect(markup).toMatch(/aria-label="Label Frontier Points" aria-pressed="true"/);
    expect(markup).toMatch(/aria-label="Label All Points" aria-pressed="false"/);
    (settingsOf(svg)?.props.onLabelsChange as (labels: string) => void)("all");
    expect(chosen).toEqual(["all"]);
  });

  test("leaves the choice out when the plot does not offer it", () => {
    expect(renderToStaticMarkup(panel({ showPointLabels: "frontier" }))).not.toContain(">Labels</text>");
    expect(renderToStaticMarkup(panel({ showPointLabels: "none", onPointLabelsChange: () => {} }))).not.toContain(
      ">Labels</text>",
    );
  });
});

describe("ParetoPlot hover radius", () => {
  test("inspects the nearest point within the radius, and nothing beyond it", () => {
    let hovered = null as string | null;
    const svg = ParetoSvg({
      ...props,
      width: 400,
      height: 300,
      hoverRadius: 30,
      onHoveredIdChange: (id) => {
        hovered = id;
      },
    }) as ReactElement<Record<string, unknown>>;
    const box = { left: 0, top: 0, width: 400 };
    const move = (x: number, y: number) =>
      (svg.props.onPointerMove as (event: unknown) => void)({
        pointerType: "mouse",
        clientX: x,
        clientY: y,
        currentTarget: { getBoundingClientRect: () => box },
      });
    const circles = elementsWithRole(svg, "button").map((point) => {
      const circle = Children.toArray(point.props.children as ReactNode)[0] as ReactElement<{
        cx: number;
        cy: number;
      }>;
      return { id: String(point.key), x: circle.props.cx, y: circle.props.cy };
    });
    const small = circles.find((point) => point.id === "small");
    if (!small) throw new Error("missing point");
    move(small.x + 12, small.y - 9);
    expect(hovered).toBe("small");
    move(small.x + 200, small.y + 200);
    expect(hovered).toBeNull();
  });

  test("leaves the plot as it was when unset", () => {
    const svg = ParetoSvg(props) as ReactElement<Record<string, unknown>>;
    expect(svg.props.onPointerMove).toBeUndefined();
    expect(elementsWithRole(svg, "button")[0]?.props.onMouseEnter).toBeDefined();
  });
});
