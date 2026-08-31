import { writeFile } from "node:fs/promises";

import { renderParetoPlot } from "../src/static.js";

const points = [
  { id: "mini", label: "GPT-5 Mini", x: 0.006, y: 64 },
  { id: "flash", label: "Gemini Flash", x: 0.012, y: 75 },
  { id: "haiku", label: "Claude Haiku", x: 0.02, y: 70 },
  { id: "pro", label: "Gemini Pro", x: 0.038, y: 88 },
  { id: "opus", label: "Claude Opus", x: 0.071, y: 91 },
  { id: "legacy", label: "Legacy Model", x: 0.055, y: 72 },
];

const svg = renderParetoPlot({
  points,
  title: "Cost × Performance",
  xAxis: {
    label: "Cost / Task",
    objective: "minimize",
    includeZero: true,
    format: (value) => `$${Math.max(0, value).toFixed(2)}`,
  },
  yAxis: {
    label: "Score",
    objective: "maximize",
    domain: [0, 100],
    format: (value) => `${value.toFixed(0)}%`,
  },
  showPointLabels: "frontier",
});

await writeFile(new URL("../docs/pareto-example.svg", import.meta.url), svg);
