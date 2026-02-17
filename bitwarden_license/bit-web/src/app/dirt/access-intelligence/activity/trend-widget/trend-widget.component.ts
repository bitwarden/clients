import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  viewChild,
} from "@angular/core";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import "chartjs-adapter-date-fns";

import { ButtonModule, IconButtonModule, ToggleGroupModule } from "@bitwarden/components";

// Register Chart.js components
Chart.register(...registerables);

export type TrendDataPoint = {
  date: Date;
  value: number;
};

export type TrendDataset = {
  label: string;
  data: TrendDataPoint[];
  color: string;
};

@Component({
  selector: "trend-widget",
  templateUrl: "./trend-widget.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonModule, ButtonModule, ToggleGroupModule],
})
export class TrendWidgetComponent implements AfterViewInit, OnDestroy {
  private chart: Chart | null = null;
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");

  // Input signals for the two data series
  readonly primaryDataset = input<TrendDataset>({
    label: "Primary",
    data: [
      { date: new Date(2026, 1, 2), value: 50 },
      { date: new Date(2026, 1, 4), value: 60 },
    ],
    color: "#175DDC",
  });

  readonly secondaryDataset = input<TrendDataset>({
    label: "Secondary",
    data: [
      { date: new Date(2026, 1, 2), value: 30 },
      { date: new Date(2026, 1, 4), value: 20 },
    ],
    color: "#E5E7EB",
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

    const primaryData = this.primaryDataset();
    const secondaryData = this.secondaryDataset();

    const config: ChartConfiguration<"line"> = {
      type: "line",
      data: {
        datasets: [
          {
            label: primaryData.label,
            data: primaryData.data.map((point) => ({
              x: point.date.getTime(),
              y: point.value,
            })),
            borderColor: primaryData.color,
            backgroundColor: primaryData.color,
            borderWidth: 2,
          },
          {
            label: secondaryData.label,
            data: secondaryData.data.map((point) => ({
              x: point.date.getTime(),
              y: point.value,
            })),
            borderColor: secondaryData.color,
            backgroundColor: secondaryData.color,
            borderWidth: 2,
          },
        ],
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
              padding: 10,
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
}
