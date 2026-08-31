# @mupt-ai/dari-pareto

Public Apache-2.0 React package for rendering static and interactive Pareto frontier plots.

## Rules

- Keep frontier and layout behavior independent of Dari eval storage schemas.
- Consumers must supply measured axis values. Never estimate cost from model catalog prices.
- Static and interactive modes must share the same calculation and rendering path.
- Keep output deterministic and accessible.
- Do not add a charting-library dependency.

## Validation

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
```
