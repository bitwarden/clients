import {
  ChangeDetectionStrategy,
  OnDestroy,
  Component,
  input,
  viewChild,
  ElementRef,
  effect,
  signal,
  afterNextRender,
  untracked,
} from "@angular/core";
import {
  Chart,
  ChartConfiguration,
  ChartDataset,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
  Title,
} from "chart.js";
import "chartjs-adapter-date-fns";

// Register only the Chart.js components we need
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
  Title,
);

// Empirical merge ratio for afterBuildTicks: when xMin/xMax lands within this
// fraction of the natural tick interval, replace the edge tick rather than
// appending — avoids cramped pairs like "May 7  May 8". Tuned against Past
// Month (17% gap → merge) and Past Year (50% gap → merge). Bump if a future
// period needs different sensitivity.
const TICK_BOUNDARY_MERGE_RATIO = 0.6;

type PointData = {
  x: number | Date;
  y: number;
};

export type LineData = {
  label: string;
  pointData: PointData[];
  color: string;
  fillColor?: string;
};

export type ChartConfig = {
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisType: "datetime" | "default";
  timeUnit?: "day" | "month" | "year";
  timeDisplayFormat?: string;
  timeStepSize?: number;
  autoSkip?: boolean;
  xMin?: Date | number;
  xMax?: Date | number;
};

@Component({
  selector: "line-chart",
  templateUrl: "./line-chart.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements OnDestroy {
  readonly chart = signal<Chart | null>(null);
  readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");

  readonly lines = input<LineData[]>([]);
  readonly configuration = input<ChartConfig>({
    xAxisType: "default",
  });

  constructor() {
    afterNextRender(() => {
      this.initChart(this.lines(), this.configuration());
    });

    effect(() => {
      const configuration = this.configuration();
      const chart = untracked(() => this.chart());
      if (!chart) {
        return;
      }
      chart.options = this.buildOptions(configuration);
      chart.update();
    });

    effect(() => {
      const lineData = this.lines();
      const chart = untracked(() => this.chart());
      if (!chart) {
        return;
      }
      chart.data.datasets = this.mapLinesToDatasetObjects(lineData);
      chart.update();
    });
  }

  ngOnDestroy(): void {
    this.chart()?.destroy();
  }

  private initChart(lineData: LineData[], configuration: ChartConfig): void {
    const canvas = this.chartCanvas().nativeElement;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        datasets: this.mapLinesToDatasetObjects(lineData),
      },
      options: this.buildOptions(configuration),
    };

    this.chart.set(new Chart(ctx, config));
  }

  private buildOptions(
    configuration: ChartConfig,
  ): NonNullable<ChartConfiguration<"line">["options"]> {
    const options: NonNullable<ChartConfiguration<"line">["options"]> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          align: "end",
          labels: {
            padding: 16,
            usePointStyle: true,
          },
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          type: configuration.xAxisType === "datetime" ? "time" : "linear",
          min:
            configuration.xMin instanceof Date ? configuration.xMin.getTime() : configuration.xMin,
          max:
            configuration.xMax instanceof Date ? configuration.xMax.getTime() : configuration.xMax,
          title: {
            display: !!configuration.xAxisLabel,
            text: configuration.xAxisLabel,
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: !!configuration.yAxisLabel,
            text: configuration.yAxisLabel,
          },
        },
      },
    };

    if (options?.scales?.x?.type === "time") {
      options.scales.x.time = {
        unit: configuration.timeUnit ?? "day",
        displayFormats: {
          day: configuration.timeDisplayFormat ?? "MMM d yyyy",
          month: configuration.timeDisplayFormat ?? "MMM yyyy",
          year: configuration.timeDisplayFormat ?? "yyyy",
        },
        tooltipFormat: "MMM d yyyy",
      };
      // Boundary-label rule (gated on timeUnit so other LineChartComponent
      // consumers are unaffected): pin first/last ticks to xMin/xMax, and
      // replace rather than append when the boundary lands within 60% of the
      // natural tick spacing — prevents cramped pairs like "May 7  May 8".
      if (configuration.timeUnit !== undefined) {
        options.scales.x.bounds = "ticks";
        options.scales.x.afterBuildTicks = (axis) => {
          const ticks = axis.ticks;
          if (ticks.length === 0) {
            return;
          }
          const avgInterval =
            ticks.length > 1
              ? (ticks[ticks.length - 1].value - ticks[0].value) / (ticks.length - 1)
              : 0;
          const mergeThreshold = avgInterval * TICK_BOUNDARY_MERGE_RATIO;
          if (axis.min !== undefined && ticks[0].value > axis.min) {
            if (ticks[0].value - axis.min < mergeThreshold) {
              ticks[0] = { value: axis.min, major: ticks[0].major ?? false };
            } else {
              ticks.unshift({ value: axis.min, major: false });
            }
          }
          if (axis.max !== undefined && ticks[ticks.length - 1].value < axis.max) {
            const lastIdx = ticks.length - 1;
            if (axis.max - ticks[lastIdx].value < mergeThreshold) {
              ticks[lastIdx] = { value: axis.max, major: ticks[lastIdx].major ?? false };
            } else {
              ticks.push({ value: axis.max, major: false });
            }
          }
        };
      }
      if (configuration.timeStepSize !== undefined || configuration.autoSkip !== undefined) {
        options.scales.x.ticks = {
          ...(configuration.timeStepSize !== undefined && {
            stepSize: configuration.timeStepSize,
          }),
          ...(configuration.autoSkip !== undefined && { autoSkip: configuration.autoSkip }),
        };
      }
    }

    return options;
  }

  private mapLinesToDatasetObjects(lines: LineData[]): ChartDataset<"line">[] {
    return lines.map((line) => ({
      label: line.label,
      data: line.pointData.map((point) => ({
        x: point.x instanceof Date ? point.x.getTime() : point.x,
        y: point.y,
      })),
      borderColor: line.color,
      backgroundColor: line?.fillColor,
      fill: !!line.fillColor,
      borderWidth: 2,
    }));
  }
}
