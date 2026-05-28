import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import {
  ArcElement,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Plugin,
  Tooltip,
} from "chart.js";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TypographyModule } from "@bitwarden/components";

Chart.register(ArcElement, DoughnutController, Tooltip);

const SAFE_COLOR_FALLBACK_LIGHT = "#e6ecf2";
const SAFE_COLOR_FALLBACK_DARK = "#314158";
const RISK_COLOR_FALLBACK = "#FF6467";
const HEALTHY_COLOR_FALLBACK = "#00a63e";

function withAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

@Component({
  selector: "app-password-health-gauge",
  templateUrl: "./password-health-gauge.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, JslibModule, TypographyModule],
})
export class PasswordHealthGaugeComponent implements OnDestroy {
  readonly atRisk = input.required<number>();
  readonly total = input.required<number>();

  protected readonly isHealthy = computed(() => this.atRisk() === 0);

  protected readonly percent = computed(() => {
    if (this.isHealthy()) {
      return 100;
    }
    const total = this.total();
    if (total <= 0) {
      return 0;
    }
    return Math.round((Math.min(this.atRisk(), total) / total) * 100);
  });

  private readonly chart = signal<Chart<"doughnut"> | null>(null);
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");

  constructor() {
    afterNextRender(() => {
      this.initChart();
    });

    effect(() => {
      const atRisk = this.atRisk();
      const total = this.total();
      const chart = untracked(() => this.chart());
      if (!chart) {
        return;
      }
      chart.data.datasets[0].data = this.buildData(atRisk, total);
      chart.update();
    });
  }

  ngOnDestroy(): void {
    this.chart()?.destroy();
  }

  private initChart(): void {
    const canvas = this.chartCanvas().nativeElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const config: ChartConfiguration<"doughnut"> = {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: this.buildData(this.atRisk(), this.total()),
            backgroundColor: [RISK_COLOR_FALLBACK, this.readSafeColor()],
            borderWidth: 0,
            borderRadius: [
              { outerStart: 8, outerEnd: 0, innerStart: 8, innerEnd: 0 },
              { outerStart: 0, outerEnd: 8, innerStart: 0, innerEnd: 8 },
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        circumference: 270,
        rotation: -135,
        cutout: "80%",
        layout: { padding: 0 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
      plugins: [this.gradientPlugin()],
    };

    this.chart.set(new Chart(ctx, config));
  }

  private buildData(atRisk: number, total: number): number[] {
    // Healthy state paints a full ring; the gradient plugin recolors slice 0 green.
    if (atRisk === 0) {
      return [Math.max(total, 1), 0];
    }
    const safe = Math.max(total - atRisk, 0);
    return [Math.min(atRisk, total), safe];
  }

  // Built as a chart plugin so chartArea (real pixel bounds) is available; canvas.width
  // isn't sized until after Chart.js lays out the canvas.
  private gradientPlugin(): Plugin<"doughnut"> {
    return {
      id: "vault-health-gradient",
      afterLayout: (chart) => {
        const { chartArea, ctx } = chart;
        if (!chartArea || chartArea.right <= chartArea.left) {
          return;
        }
        const healthy = this.isHealthy();
        const data = chart.data.datasets[0].data as number[];
        const risk = data[0] ?? 0;
        const safe = data[1] ?? 0;
        const sum = risk + safe;
        const ratio = sum > 0 ? Math.min(risk / sum, 1) : 0;
        const base = healthy ? this.readHealthyBase() : this.readRiskBase();
        const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        if (healthy) {
          gradient.addColorStop(0, withAlpha(base, 1));
          gradient.addColorStop(1, withAlpha(base, 1));
        } else {
          const fadeEnd = Math.max(ratio, 0.1);
          gradient.addColorStop(0, withAlpha(base, 1));
          gradient.addColorStop(fadeEnd * 0.5, withAlpha(base, 0.65));
          gradient.addColorStop(fadeEnd, withAlpha(base, 0.15));
          gradient.addColorStop(1, withAlpha(base, 0));
        }
        chart.data.datasets[0].backgroundColor = [gradient, this.readSafeColor()];
      },
    };
  }

  private readRiskBase(): string {
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--color-red-400").trim() ||
      RISK_COLOR_FALLBACK
    );
  }

  private readHealthyBase(): string {
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--color-green-600").trim() ||
      HEALTHY_COLOR_FALLBACK
    );
  }

  private readSafeColor(): string {
    const isDark = document.documentElement.classList.contains("theme_dark");
    const varName = isDark ? "--color-gray-700" : "--color-gray-100";
    const fallback = isDark ? SAFE_COLOR_FALLBACK_DARK : SAFE_COLOR_FALLBACK_LIGHT;
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
  }
}
