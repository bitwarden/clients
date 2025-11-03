import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  DestroyRef,
  inject,
  ElementRef,
  ChangeDetectionStrategy,
  signal,
  computed,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  IconButtonModule,
  SelectModule,
  TypographyModule,
  MenuModule,
  BadgeModule,
  ToggleGroupModule,
} from "@bitwarden/components";

import { RiskOverTimeDataService } from "./risk-over-time-data.service";
import { RiskMetricType, TimePeriod, RiskOverTimeData } from "./risk-over-time.models";

@Component({
  selector: "dirt-risk-over-time",
  templateUrl: "./risk-over-time.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    SelectModule,
    TypographyModule,
    MenuModule,
    BadgeModule,
    ToggleGroupModule,
  ],
  providers: [RiskOverTimeDataService],
})
export class RiskOverTimeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  protected readonly chartSvgRef = viewChild<ElementRef<SVGElement>>("chartSvg");

  // Data properties using signals
  protected readonly chartData = signal<RiskOverTimeData | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly hasError = signal<boolean>(false);
  protected readonly selectedMetric = signal<RiskMetricType>(RiskMetricType.Applications);
  protected readonly selectedPeriod = signal<TimePeriod>(TimePeriod.ThreeMonths);
  protected readonly hoveredDataPoint = signal<{ index: number; x: number } | null>(null);

  // Chart dimensions
  chartWidth = 700;
  chartHeight = 280;
  chartPadding = { top: 20, right: 20, bottom: 35, left: 20 }; // Minimal left padding

  // Dynamic Y-axis position based on label widths
  private maxYLabelWidth = 0;

  protected get yAxisX(): number {
    // Y-axis line position: left padding + max label width + gap
    return this.chartPadding.left + this.maxYLabelWidth + 10;
  }

  // Computed values
  protected readonly chartTitle = computed(() => {
    switch (this.selectedMetric()) {
      case RiskMetricType.Applications:
        return this.i18nService.t("applicationsAtRiskOverTime");
      case RiskMetricType.Items:
        return this.i18nService.t("itemsAtRiskOverTime");
      case RiskMetricType.Members:
        return this.i18nService.t("membersAtRiskOverTime");
      default:
        return this.i18nService.t("riskOverTime");
    }
  });

  protected readonly isImproving = computed(() => {
    const data = this.chartData();
    if (!data) {
      return true;
    }
    const firstValue = data.currentPeriod[0];
    const lastValue = data.currentPeriod[data.currentPeriod.length - 1];
    return lastValue < firstValue;
  });

  protected readonly currentPeriodStrokeColor = computed(() => {
    return this.isImproving() ? "#175DDC" : "#C83B3B";
  });

  protected readonly currentPeriodColor = computed(() => {
    return this.isImproving() ? "tw-text-primary-600" : "tw-text-danger";
  });

  // Enums for template
  readonly RiskMetricType = RiskMetricType;
  readonly TimePeriod = TimePeriod;

  // Period options for dropdown
  periodOptions: Array<{ value: TimePeriod; label: string }> = [];

  constructor(
    private dataService: RiskOverTimeDataService,
    private i18nService: I18nService,
  ) {
    // Initialize period options with i18n strings
    this.periodOptions = [
      { value: TimePeriod.ThreeMonths, label: this.i18nService.t("last3Months") },
      { value: TimePeriod.SixMonths, label: this.i18nService.t("last6Months") },
      { value: TimePeriod.TwelveMonths, label: this.i18nService.t("last12Months") },
    ];
  }

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.dataService
      .getRiskOverTimeData(this.selectedMetric(), this.selectedPeriod())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.chartData.set(data);
          this.isLoading.set(false);
          // Calculate max Y-axis label width after data loads
          this.calculateMaxYLabelWidth();
        },
        error: (_error: unknown) => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  private calculateMaxYLabelWidth(): void {
    const data = this.chartData();
    if (!data) {
      this.maxYLabelWidth = 30; // Default width
      return;
    }

    // Get all Y-axis label values
    const labels = this.yAxisLabels.map((l) => l.value);

    // Create a temporary canvas to measure text width
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      this.maxYLabelWidth = 30;
      return;
    }

    // Set font to match the SVG text element (12px)
    context.font = "12px system-ui, -apple-system, sans-serif";

    // Find the widest label
    this.maxYLabelWidth = Math.max(...labels.map((label) => context.measureText(label).width));
  }

  protected onMetricChange(metric: RiskMetricType | string): void {
    this.selectedMetric.set(metric as RiskMetricType);
    this.loadData();
  }

  protected onPeriodChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedPeriod.set(target.value as TimePeriod);
    this.loadData();
  }

  protected get yAxisLabels(): Array<{ value: string; y: number }> {
    const data = this.chartData();
    if (!data) {
      return [
        { value: "100%", y: this.chartPadding.top },
        {
          value: "75%",
          y:
            this.chartPadding.top +
            (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.25,
        },
        {
          value: "50%",
          y:
            this.chartPadding.top +
            (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.5,
        },
        {
          value: "25%",
          y:
            this.chartPadding.top +
            (this.chartHeight - this.chartPadding.top - this.chartPadding.bottom) * 0.75,
        },
        { value: "0", y: this.chartHeight - this.chartPadding.bottom },
      ];
    }
    const maxValue = Math.max(...data.currentPeriod, ...data.previousPeriod);
    const step = Math.ceil(maxValue / 4);
    const chartAreaHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    return [
      { value: (step * 4).toString(), y: this.chartPadding.top },
      { value: (step * 3).toString(), y: this.chartPadding.top + chartAreaHeight * 0.25 },
      { value: (step * 2).toString(), y: this.chartPadding.top + chartAreaHeight * 0.5 },
      { value: step.toString(), y: this.chartPadding.top + chartAreaHeight * 0.75 },
      { value: "0", y: this.chartHeight - this.chartPadding.bottom },
    ];
  }

  protected get xAxisLabels(): string[] {
    return this.chartData()?.labels || [];
  }

  // Calculate SVG path for area chart
  protected getAreaPath(data: number[], isPreviousPeriod = false): string {
    const chartData = this.chartData();
    if (!chartData || data.length === 0) {
      return "";
    }

    const maxValue = Math.max(...chartData.currentPeriod, ...chartData.previousPeriod);
    const chartAreaWidth = this.chartWidth - this.yAxisX - this.chartPadding.right;
    const chartAreaHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    const step = chartAreaWidth / (data.length - 1);

    // Create path
    let path = `M ${this.yAxisX},${this.chartHeight - this.chartPadding.bottom}`;

    // Add points
    data.forEach((value, index) => {
      const x = this.yAxisX + index * step;
      const y = this.chartPadding.top + chartAreaHeight - (value / maxValue) * chartAreaHeight;

      path += ` L ${x},${y}`;
    });

    // Close the path
    path += ` L ${this.yAxisX + (data.length - 1) * step},${this.chartHeight - this.chartPadding.bottom}`;
    path += " Z";

    return path;
  }

  // Calculate SVG path for line
  protected getLinePath(data: number[]): string {
    const chartData = this.chartData();
    if (!chartData || data.length === 0) {
      return "";
    }

    const maxValue = Math.max(...chartData.currentPeriod, ...chartData.previousPeriod);
    const chartAreaWidth = this.chartWidth - this.yAxisX - this.chartPadding.right;
    const chartAreaHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    const step = chartAreaWidth / (data.length - 1);

    // Create path
    let path = "";

    data.forEach((value, index) => {
      const x = this.yAxisX + index * step;
      const y = this.chartPadding.top + chartAreaHeight - (value / maxValue) * chartAreaHeight;

      if (index === 0) {
        path += `M ${x},${y}`;
      } else {
        path += ` L ${x},${y}`;
      }
    });

    return path;
  }

  // Get points for hover circles
  protected getDataPoints(data: number[]): Array<{ x: number; y: number; value: number }> {
    const chartData = this.chartData();
    if (!chartData || data.length === 0) {
      return [];
    }

    const maxValue = Math.max(...chartData.currentPeriod, ...chartData.previousPeriod);
    const chartAreaWidth = this.chartWidth - this.yAxisX - this.chartPadding.right;
    const chartAreaHeight = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    const step = chartAreaWidth / (data.length - 1);

    return data.map((value, index) => ({
      x: this.yAxisX + index * step,
      y: this.chartPadding.top + chartAreaHeight - (value / maxValue) * chartAreaHeight,
      value,
    }));
  }

  protected onChartMouseMove(event: MouseEvent): void {
    const data = this.chartData();
    if (!data) {
      return;
    }

    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Find closest data point
    const chartAreaWidth = this.chartWidth - this.yAxisX - this.chartPadding.right;
    const step = chartAreaWidth / (data.currentPeriod.length - 1);
    const relativeX = x - this.yAxisX;
    const index = Math.round(relativeX / step);

    if (index >= 0 && index < data.currentPeriod.length) {
      this.hoveredDataPoint.set({
        index,
        x: this.yAxisX + index * step,
      });
    }
  }

  protected onChartMouseLeave(): void {
    this.hoveredDataPoint.set(null);
  }

  protected getTooltipPosition(): { x: number; y: number } | null {
    const hovered = this.hoveredDataPoint();
    if (!hovered) {
      return null;
    }
    return {
      x: hovered.x,
      y: this.chartPadding.top + 10,
    };
  }

  protected getTooltipData(): {
    label: string;
    currentValue: number;
    previousValue: number;
  } | null {
    const hovered = this.hoveredDataPoint();
    const data = this.chartData();
    if (!hovered || !data) {
      return null;
    }
    return {
      label: data.labels[hovered.index],
      currentValue: data.currentPeriod[hovered.index],
      previousValue: data.previousPeriod[hovered.index],
    };
  }

  protected downloadChartAsSVG(): void {
    const svgRef = this.chartSvgRef();
    if (!svgRef) {
      return;
    }

    try {
      const svgElement = svgRef.nativeElement;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.chartTitle().replace(/\s+/g, "-").toLowerCase()}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error downloading chart - silently fail
    }
  }
}
