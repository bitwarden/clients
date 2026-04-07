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
  timeDisplayFormat?: string;
  showMinMaxDates?: boolean;
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
      const dateRange = configuration.showMinMaxDates
        ? this.getDateRange(untracked(() => this.lines()))
        : undefined;
      chart.options = this.buildOptions(configuration, dateRange);
      chart.update();
    });

    effect(() => {
      const lineData = this.lines();
      const chart = untracked(() => this.chart());
      if (!chart) {
        return;
      }
      chart.data.datasets = this.mapLinesToDatasetObjects(lineData);
      const configuration = untracked(() => this.configuration());
      if (configuration.showMinMaxDates) {
        const dateRange = this.getDateRange(lineData);
        chart.options = this.buildOptions(configuration, dateRange);
      }
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

    const dateRange = configuration.showMinMaxDates ? this.getDateRange(lineData) : undefined;

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        datasets: this.mapLinesToDatasetObjects(lineData),
      },
      options: this.buildOptions(configuration, dateRange),
    };

    this.chart.set(new Chart(ctx, config));
  }

  private buildOptions(
    configuration: ChartConfig,
    dateRange?: { min: number; max: number },
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
          title: {
            display: !!configuration.xAxisLabel,
            text: configuration.xAxisLabel,
          },
          grid: {
            display: false,
          },
          ticks: {
            maxTicksLimit: 6,
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
        unit: "day",
        displayFormats: {
          day: configuration.timeDisplayFormat ?? "MMM d yyyy",
        },
      };
    }

    // if we need to show min and max dates
    // and we have a valid date range
    // and the x-axis is datetime, add the min and max as ticks
    if (
      configuration.showMinMaxDates &&
      dateRange &&
      configuration.xAxisType === "datetime" &&
      options.scales?.x
    ) {
      options.scales.x.afterBuildTicks = (scale) => {
        const { min, max } = dateRange;

        if (min === max) {
          scale.ticks = [{ value: min }];
          return;
        }

        const threshold = (max - min) * 0.1;
        scale.ticks = scale.ticks.filter(
          (t) => t.value > min + threshold && t.value < max - threshold,
        );
        scale.ticks.unshift({ value: min });
        scale.ticks.push({ value: max });
      };
    }

    if (
      configuration.showMinMaxDates &&
      configuration.xAxisType === "datetime" &&
      options.scales?.x?.ticks
    ) {
      options.scales.x.ticks.maxTicksLimit = 4;
    }

    return options;
  }

  private getDateRange(lines: LineData[]): { min: number; max: number } | undefined {
    const timestamps = lines.flatMap((l) =>
      l.pointData.map((p) => (p.x instanceof Date ? p.x.getTime() : p.x)),
    );
    if (!timestamps.length) {
      return undefined;
    }
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
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
