import { Injectable } from "@angular/core";
import {
  Chart,
  ChartConfiguration,
  ChartType,
  LegendOptions,
  LinearScaleOptions,
  TimeScaleOptions,
  TimeUnit,
} from "chart.js";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";

@Injectable({ providedIn: "root" })
export class ChartExportService {
  constructor(private fileDownloadService: FileDownloadService) {}

  downloadAsPNG(
    chartType: ChartType,
    sourceChart: Chart,
    fileName: string,
    exportLabels?: { title?: string; xAxisLabel?: string; yAxisLabel?: string },
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { options } = sourceChart;
    const legend = options.plugins?.legend as Partial<LegendOptions<ChartType>>;
    const xScale = options.scales?.["x"] as Partial<TimeScaleOptions> & { type?: string };
    const yScale = options.scales?.["y"] as Partial<LinearScaleOptions>;

    const title: string | string[] | undefined =
      exportLabels?.title ?? (options.plugins?.title?.text as string | string[] | undefined);
    const xAxisLabel: string | string[] | undefined =
      exportLabels?.xAxisLabel ?? xScale.title?.text;
    const yAxisLabel: string | string[] | undefined =
      exportLabels?.yAxisLabel ?? yScale.title?.text;

    // time.unit can be `false` (let Chart.js auto-pick) — treat that as "not configured".
    const rawUnit = xScale.time?.unit;
    const xTimeUnit: TimeUnit | undefined = rawUnit !== false ? rawUnit : undefined;
    const xTimeDisplayFormat: string | undefined = xTimeUnit
      ? xScale.time?.displayFormats?.[xTimeUnit]
      : undefined;

    const exportChart = new Chart(ctx, {
      type: chartType,
      data: { datasets: sourceChart.data.datasets },
      options: {
        animation: false,
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: legend.display,
            position: legend.position,
            align: legend.align,
            labels: {
              padding: legend.labels?.padding,
              usePointStyle: legend.labels?.usePointStyle,
            },
          },
          tooltip: { enabled: false },
          title: {
            display: title != null,
            text: title,
            padding: { top: 16, bottom: 16 },
          },
        },
        scales: {
          x: {
            type: xScale.type,
            ...(xTimeUnit != null && {
              time: {
                unit: xTimeUnit,
                ...(xTimeDisplayFormat != null && {
                  displayFormats: { [xTimeUnit]: xTimeDisplayFormat },
                }),
              },
            }),
            grid: { display: xScale.grid?.display },
            ticks: { maxTicksLimit: xScale.ticks?.maxTicksLimit },
            title: { display: xAxisLabel != null, text: xAxisLabel },
          },
          y: {
            beginAtZero: yScale.beginAtZero,
            title: { display: yAxisLabel != null, text: yAxisLabel },
          },
        },
      },
    } as ChartConfiguration<ChartType>);

    // Paint a white background behind the rendered chart pixels.
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    canvas.toBlob((blob) => {
      exportChart.destroy();
      if (!blob) {
        return;
      }
      this.fileDownloadService.download({
        fileName,
        blobData: blob,
        blobOptions: { type: "image/png" },
      });
    });
  }
}
