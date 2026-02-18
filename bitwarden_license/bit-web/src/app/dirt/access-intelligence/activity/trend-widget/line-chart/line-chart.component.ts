import {
  ChangeDetectionStrategy,
  OnDestroy,
  AfterViewInit,
  Component,
  input,
  viewChild,
  ElementRef,
} from "@angular/core";
import { Chart, ChartConfiguration, ChartDataset, registerables } from "chart.js";
import "chartjs-adapter-date-fns";

// Register Chart.js components
Chart.register(...registerables);

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
  xAxisType: "time" | "default";
  timeLabelFormat?: string;
};

@Component({
  selector: "line-chart",
  templateUrl: "./line-chart.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  private chart: Chart | null = null;
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");

  // Input signal for input point data
  readonly lines = input<LineData[]>([]);
  readonly configuration = input<ChartConfig>({
    xAxisType: "default",
  });

  ngAfterViewInit(): void {
    this.initializeChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private initializeChart(): void {
    const canvas = this.chartCanvas().nativeElement;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const lineData = this.lines();
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
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                day: "MMM d yyyy",
              },
            },
            title: {
              display: true,
              text: "Date",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Value",
            },
          },
        },
      },
    };

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
