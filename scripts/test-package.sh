#!/usr/bin/env bash
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT

cd "$package_root"
bun run build
package_archive="$(npm pack --silent --pack-destination "$temporary_dir")"

mkdir "$temporary_dir/consumer"
cd "$temporary_dir/consumer"
npm init --yes >/dev/null
npm install --ignore-scripts react@18 react-dom@18 "$temporary_dir/$package_archive" >/dev/null

node --input-type=module <<'EOF'
import { paretoFrontier } from "@mupt-ai/dari-pareto";
import { renderParetoPlot } from "@mupt-ai/dari-pareto/static";

const points = [
  { id: "a", label: "A", x: 1, y: 2 },
  { id: "b", label: "B", x: 2, y: 1 },
];
if (paretoFrontier(points).length !== 1) {
  throw new Error("Unexpected frontier from packed package");
}
const svg = renderParetoPlot({
  points,
  xAxis: { label: "Cost", objective: "minimize" },
  yAxis: { label: "Score", objective: "maximize" },
});
if (!svg.startsWith("<svg")) {
  throw new Error("Static renderer did not return SVG");
}
EOF
