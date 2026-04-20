<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

## @superset-ui/plugin-chart-pivot-table-v2

Pivot Table V2 for this Superset fork: extended **Customize** controls (per-field formatting, subtotals, metrics layout), **global table** options, and **Data** controls for the metrics axis label (font, color, alignment).

### Fork-specific behavior (see root [PRD.md](../../../PRD.md))

- **Field Formatting → Alignment:** `left` | `center` | `right` for field headers and values; metric header cells use field alignment where applicable. Values flow through `buildEffectiveFieldGroupingSettings` in `src/plugin/transformProps.ts` (including `field_formatting_field{n}_alignment`).
- **Number format:** standard Superset **Adaptive formatting** uses `SMART_NUMBER`. Additional option **Adaptive formatting, empty instead 0** (`ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0`) maps to smart number formatting but renders **empty** value cells for 0 / null / undefined (not for numeric headers). Implemented via `resolveD3NumberFormat` / `isEmptyInsteadOfZeroFormat` in `src/types.ts` and consumers `PivotTableV2Chart.tsx` / `TableRenderers.jsx`.
- **Formula subtotal:** for `Per-Metric Subtotal Overrides -> Aggregation = Formula`, subtotal values are recomputed from the SQL formula at the group level instead of summing child percentages. Base metric lookup is built in `src/plugin/transformProps.ts`, and subtotal evaluation happens in `src/react-pivottable/TableRenderers.jsx`.
- **Failure mode:** if formula subtotal recomputation cannot resolve all base terms, the chart renders an empty subtotal cell and emits a warning to the browser console.
- If you change aggregation or display logic, keep [superset/charts/post_processing.py](../../../superset/charts/post_processing.py) in mind for any related backend post-processing.

### Package version

Version in `package.json` is bumped when shipping plugin changes in this fork; the chart metadata string in `src/plugin/index.ts` should stay in sync for support/debugging. Current plugin version after the formula subtotal fix: `0.0.100`.

### Links

- [Apache Superset](https://superset.apache.org)
- Dev stack: [docker/README.dev.md](../../../docker/README.dev.md)
