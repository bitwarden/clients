# Line Chart: Min/Max Date Labels on X-Axis

**Date:** 2026-04-07
**Branch:** dirt/pm-34677/chart-label-date

## Problem

The `LineChartComponent` x-axis uses Chart.js's automatic tick generation (`maxTicksLimit: 6`). Chart.js picks "nice" round dates (e.g. start of week/month) — there is no guarantee the actual first or last data point dates appear as tick labels. Users cannot tell at a glance what the full date range of the chart covers.

## Solution

Opt-in feature via `ChartConfig` that uses Chart.js's `afterBuildTicks` scale hook to inject the data's actual min and max dates as tick labels, while preserving Chart.js's auto-selected ticks in between. Auto-ticks that fall within 10% of either endpoint are removed to prevent label crowding.

## Changes

### `ChartConfig` type (`line-chart.component.ts`)

Add one optional field:

```typescript
export type ChartConfig = {
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisType: "datetime" | "default";
  timeDisplayFormat?: string;
  showMinMaxDates?: boolean; // new
};
```

### New helper: `getDateRange`

```typescript
private getDateRange(lines: LineData[]): { min: number; max: number } | null {
  const timestamps = lines.flatMap(l =>
    l.pointData.map(p => (p.x instanceof Date ? p.x.getTime() : (p.x as number)))
  );
  if (!timestamps.length) return null;
  return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
}
```

### `buildOptions` signature

```typescript
private buildOptions(
  configuration: ChartConfig,
  dateRange?: { min: number; max: number },
): NonNullable<ChartConfiguration<"line">["options"]>
```

### `afterBuildTicks` logic (added to x scale when `showMinMaxDates && dateRange`)

```typescript
afterBuildTicks: (scale) => {
  const { min, max } = dateRange!;
  const threshold = (max - min) * 0.10;

  // Remove auto-ticks too close to either endpoint
  scale.ticks = scale.ticks.filter(
    t => t.value > min + threshold && t.value < max - threshold
  );

  // Pin actual data min/max
  scale.ticks.unshift({ value: min, label: "" });
  scale.ticks.push({ value: max, label: "" });
},
```

Labels are formatted automatically by the time scale using the existing `displayFormats.day` setting (default: `"MMM d yyyy"`).

### Effect updates (`LineChartComponent`)

**Configuration effect** — pass dateRange when rebuilding options:

```typescript
effect(() => {
  const configuration = this.configuration();
  const chart = untracked(() => this.chart());
  if (!chart) return;

  const dateRange = configuration.showMinMaxDates
    ? this.getDateRange(untracked(() => this.lines()))
    : undefined;

  chart.options = this.buildOptions(configuration, dateRange);
  chart.update();
});
```

**Lines effect** — when `showMinMaxDates` is true, also rebuild options so min/max stay in sync with new data:

```typescript
effect(() => {
  const lineData = this.lines();
  const chart = untracked(() => this.chart());
  if (!chart) return;

  chart.data.datasets = this.mapLinesToDatasetObjects(lineData);

  const configuration = untracked(() => this.configuration());
  if (configuration.showMinMaxDates) {
    const dateRange = this.getDateRange(lineData);
    chart.options = this.buildOptions(configuration, dateRange);
  }

  chart.update();
});
```

**`initChart`** — pass dateRange on first render:

```typescript
const dateRange = configuration.showMinMaxDates
  ? this.getDateRange(lineData)
  : undefined;
const config: ChartConfiguration<"line"> = {
  ...
  options: this.buildOptions(configuration, dateRange),
};
```

### `TrendWidgetComponent` opt-in

```typescript
protected readonly lineChartConfiguration: ChartConfig = {
  xAxisType: "datetime",
  showMinMaxDates: true,
};
```

## Constraints / Non-goals

- Only applies when `xAxisType === "datetime"`. No change to linear-scale charts.
- Min/max labels use the same `timeDisplayFormat` as other ticks (no separate format option).
- No visual differentiation (bold, color) for min/max labels — they look identical to other ticks.
- The 10% crowding threshold is hardcoded; not configurable via `ChartConfig`.
