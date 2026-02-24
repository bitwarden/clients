import {
  ChangeDetectionStrategy,
  OnDestroy,
  Component,
  input,
  viewChild,
  ElementRef,
  effect,
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
};

@Component({
  selector: "line-chart",
  templateUrl: "./line-chart.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements OnDestroy {
  private chart: Chart | null = null;
  readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");

  // Input signals for chart data
  readonly lines = input<LineData[]>([]);
  readonly configuration = input<ChartConfig>({
    xAxisType: "default",
  });

  constructor() {
    // Update chart when inputs change
    effect(() => {
      const lineData = this.lines();
      const configuration = this.configuration();
      const canvas = this.chartCanvas();

      if (!canvas) {
        return;
      }

      this.updateChart(lineData, configuration);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private updateChart(lineData: LineData[], configuration: ChartConfig): void {
    const canvas = this.chartCanvas().nativeElement;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    if (this.chart) {
      // Destroy existing chart before creating new one
      this.chart.destroy();
    }

    // Initialize new chart
    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        datasets: this.mapLinesToDatasetObjects(lineData),
      },
      options: {
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
      },
    };

    if (config.options?.scales?.x?.type === "time") {
      config.options.scales.x.time = {
        unit: "day",
        displayFormats: {
          day: configuration.timeDisplayFormat ?? "MMM d yyyy",
        },
      };
    }

    this.chart = new Chart(ctx, config);
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
