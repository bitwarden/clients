import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import * as papa from "papaparse";
import { combineLatest, map, Observable } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  ButtonModule,
  IconButtonModule,
  MenuModule,
  ToggleGroupModule,
  IconModule,
  ToastService,
} from "@bitwarden/components";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ChartExportService } from "../../../shared/chart-export.service";
import { ChartConfig, LineChartComponent, LineData } from "../../../shared/line-chart.component";
import { PeriodSelectorComponent } from "../period-selector/period-selector.component";
import { DEFAULT_TIME_PERIOD, TimePeriod } from "../period-selector/period-selector.types";

export const TrendWidgetViewType = Object.freeze({
  Applications: "applications",
  Passwords: "passwords",
  Members: "members",
} as const);
export type TrendWidgetViewType = (typeof TrendWidgetViewType)[keyof typeof TrendWidgetViewType];

export interface TrendWidgetData {
  timeframe: TimePeriod;
  dataView: TrendWidgetViewType;
  dataPoints: Array<{
    timestamp: string;
    atRisk: number;
    total: number;
  }>;
}

@Component({
  selector: "trend-widget",
  templateUrl: "./trend-widget.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconButtonModule,
    ButtonModule,
    ToggleGroupModule,
    LineChartComponent,
    MenuModule,
    IconModule,
    SharedModule,
    PeriodSelectorComponent,
  ],
})
export class TrendWidgetComponent {
  protected readonly ViewType = TrendWidgetViewType;

  readonly data = input.required<TrendWidgetData>();
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly selectedView = signal<TrendWidgetViewType>(TrendWidgetViewType.Applications);
  readonly selectedTimespan = signal<TimePeriod>(DEFAULT_TIME_PERIOD);

  readonly viewChanged = output<TrendWidgetViewType>();
  readonly timespanChanged = output<TimePeriod>();

  private readonly isDarkMode = toSignal(
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$]).pipe(
      map(([theme, systemTheme]) => {
        const effectiveTheme = theme === ThemeType.System ? systemTheme : theme;
        return effectiveTheme === ThemeType.Dark;
      }),
    ),
    { initialValue: false },
  );

  private readonly lineChart = viewChild<LineChartComponent>(LineChartComponent);

  constructor(
    private readonly themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE) private readonly systemTheme$: Observable<ThemeType>,
    private readonly i18nService: I18nService,
    private readonly fileDownloadService: FileDownloadService,
    private readonly chartExportService: ChartExportService,
    private readonly toastService: ToastService,
  ) {}

  protected onViewChange(view: TrendWidgetViewType) {
    this.selectedView.set(view);
    this.viewChanged.emit(view);
  }

  protected onTimespanChange(timespan: TimePeriod) {
    this.selectedTimespan.set(timespan);
    this.timespanChanged.emit(timespan);
  }

  protected readonly viewLabel = computed(() => {
    switch (this.selectedView()) {
      case TrendWidgetViewType.Applications:
        return this.i18nService.t("applications");
      case TrendWidgetViewType.Passwords:
        return this.i18nService.t("passwords");
      case TrendWidgetViewType.Members:
        return this.i18nService.t("members");
    }
  });

  protected readonly lineChartData = computed<LineData[]>(() => {
    const dataPoints = this.data().dataPoints;
    const view = this.selectedView();
    const isDark = this.isDarkMode();

    const atRiskLabel = this.getAtRiskLabel(view);
    const allLabel = this.getAllLabel(view);

    const brandColor = this.getCssVariable(isDark ? "--color-brand-400" : "--color-brand-700");
    const grayColor = this.getCssVariable(isDark ? "--color-gray-600" : "--color-gray-200");

    return [
      {
        label: atRiskLabel,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.atRisk,
        })),
        color: brandColor,
        fillColor: isDark ? "rgba(107, 174, 250, 0.2)" : "rgba(23, 93, 220, 0.15)",
      },
      {
        label: allLabel,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.total,
        })),
        color: grayColor,
        fillColor: isDark ? "rgba(74, 85, 101, 0.3)" : "rgba(229, 231, 235, 0.2)",
      },
    ];
  });

  private getFileDownloadName() {
    return `risk_over_time_${this.selectedView()}_${this.selectedTimespan()}`;
  }

  private getAtRiskLabel(view: TrendWidgetViewType): string {
    switch (view) {
      case TrendWidgetViewType.Applications:
        return this.i18nService.t("criticalAppsAtRisk");
      case TrendWidgetViewType.Passwords:
        return this.i18nService.t("passwordsAtRisk");
      case TrendWidgetViewType.Members:
        return this.i18nService.t("membersAtRisk");
    }
  }

  private getAllLabel(view: TrendWidgetViewType): string {
    switch (view) {
      case TrendWidgetViewType.Applications:
        return this.i18nService.t("allCriticalApps");
      case TrendWidgetViewType.Passwords:
        return this.i18nService.t("allPasswords");
      case TrendWidgetViewType.Members:
        return this.i18nService.t("allMembers");
    }
  }

  private getCssVariable(variable: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  }

  protected readonly lineChartConfiguration = computed<ChartConfig>(() => {
    const timespan = this.selectedTimespan();
    const dataPoints = this.data().dataPoints;

    if (timespan === TimePeriod.AllTime && dataPoints.length > 0) {
      const range = this.getAllTimeRange(dataPoints);
      return { xAxisType: "datetime", autoSkip: false, ...range };
    }

    const tickConfig = this.getTimeUnitAndFormat(timespan);
    return {
      xAxisType: "datetime",
      xMin: this.getXMinForTimespan(timespan),
      xMax: this.getXMaxForTimespan(timespan),
      ...tickConfig,
    };
  });

  private getAllTimeRange(dataPoints: TrendWidgetData["dataPoints"]): {
    xMin: Date;
    xMax: Date;
    timeUnit: "day" | "month" | "year";
    timeDisplayFormat: string;
    timeStepSize?: number;
  } {
    // Linear scan rather than `Math.min(...arr)` / `Math.max(...arr)`: argument
    // spread has an engine-specific hard cap (~120k in V8) and the server no
    // longer caps the number of data points returned for "All time".
    let oldestMs = Number.POSITIVE_INFINITY;
    let newestMs = Number.NEGATIVE_INFINITY;
    for (const point of dataPoints) {
      const ms = new Date(point.timestamp).getTime();
      if (ms < oldestMs) {
        oldestMs = ms;
      }
      if (ms > newestMs) {
        newestMs = ms;
      }
    }
    const oldest = new Date(oldestMs);
    const newest = new Date(newestMs);
    // Calendar-boundary count (not elapsed time): a Jan 31 → Apr 1 span counts as 3
    // because it crosses 3 month boundaries. Matches the adaptive-label design rule
    // (label day / month / year based on which calendar units the data spans).
    const monthsSpan =
      (newest.getFullYear() - oldest.getFullYear()) * 12 + (newest.getMonth() - oldest.getMonth());

    if (monthsSpan < 3) {
      const xMin = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() - 1);
      const xMax = new Date(newest.getFullYear(), newest.getMonth(), newest.getDate() + 1);
      const spanDays = Math.ceil((xMax.getTime() - xMin.getTime()) / 86_400_000);
      return {
        xMin,
        xMax,
        timeUnit: "day",
        timeDisplayFormat: "MMM d yyyy",
        timeStepSize: Math.max(1, Math.ceil(spanDays / 6)),
      };
    }
    if (monthsSpan < 12) {
      return {
        xMin: new Date(oldest.getFullYear(), oldest.getMonth(), 1),
        xMax: new Date(newest.getFullYear(), newest.getMonth() + 1, 1),
        timeUnit: "month",
        timeDisplayFormat: "MMM yyyy",
      };
    }
    return {
      xMin: new Date(oldest.getFullYear(), 0, 1),
      xMax: new Date(newest.getFullYear() + 1, 0, 1),
      timeUnit: "year",
      timeDisplayFormat: "yyyy",
    };
  }

  private getXMaxForTimespan(timespan: TimePeriod): Date | undefined {
    const now = new Date();
    switch (timespan) {
      case TimePeriod.PastMonth:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case TimePeriod.Past3Months:
      case TimePeriod.Past6Months:
      case TimePeriod.PastYear:
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case TimePeriod.AllTime:
        // Empty-data fallback only; AllTime with data uses getAllTimeRange.
        return now;
    }
  }

  private getXMinForTimespan(timespan: TimePeriod): Date | undefined {
    const now = new Date();
    switch (timespan) {
      case TimePeriod.PastMonth:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      case TimePeriod.Past3Months:
        return new Date(now.getFullYear(), now.getMonth() - 3, 1);
      case TimePeriod.Past6Months:
        return new Date(now.getFullYear(), now.getMonth() - 6, 1);
      case TimePeriod.PastYear:
        return new Date(now.getFullYear(), now.getMonth() - 12, 1);
      case TimePeriod.AllTime:
        return undefined;
    }
  }

  private getTimeUnitAndFormat(timespan: TimePeriod): {
    timeUnit: "day" | "month" | "year";
    timeDisplayFormat: string;
    timeStepSize?: number;
    autoSkip?: boolean;
  } {
    switch (timespan) {
      case TimePeriod.PastMonth:
        return { timeUnit: "day", timeDisplayFormat: "MMM d", timeStepSize: 6 };
      // Past 3 / 6 Months: render every month boundary (4 / 7 ticks). PastYear
      // would crowd at 13 boundaries so it thins via timeStepSize: 2 below.
      case TimePeriod.Past3Months:
      case TimePeriod.Past6Months:
        return { timeUnit: "month", timeDisplayFormat: "MMM yyyy", autoSkip: false };
      case TimePeriod.PastYear:
        return {
          timeUnit: "month",
          timeDisplayFormat: "MMM yyyy",
          timeStepSize: 2,
          autoSkip: false,
        };
      case TimePeriod.AllTime:
        // Empty-data fallback only; AllTime with data uses getAllTimeRange.
        return { timeUnit: "day", timeDisplayFormat: "MMM d yyyy" };
    }
  }

  protected downloadAsPNG(): void {
    const chart = this.lineChart()?.chart();
    if (!chart) {
      return;
    }

    try {
      this.chartExportService.downloadAsPNG(
        "line",
        chart,
        ExportHelper.getFileName(this.getFileDownloadName(), "png"),
        {
          title: this.i18nService.t("riskOverTime"),
          xAxisLabel: this.i18nService.t("date"),
          yAxisLabel: this.viewLabel(),
        },
      );
    } catch {
      this.handleDownloadError();
    }
  }

  protected downloadAsCSV(): void {
    const dataPoints = this.data().dataPoints;
    const view = this.selectedView();

    // Prepare CSV data with translated headers
    const csvData = dataPoints.map((point) => ({
      [this.i18nService.t("date")]: new Date(point.timestamp).toLocaleString(),
      [this.getAtRiskLabel(view)]: point.atRisk,
      [this.getAllLabel(view)]: point.total,
    }));

    const csv = papa.unparse(csvData);
    const fileName = ExportHelper.getFileName(this.getFileDownloadName(), "csv");

    try {
      this.fileDownloadService.download({
        fileName,
        blobData: csv,
        blobOptions: { type: "text/csv" },
      });
    } catch {
      this.handleDownloadError();
    }
  }

  private handleDownloadError() {
    this.toastService.showToast({
      message: this.i18nService.t("downloadFailed"),
      variant: "error",
      title: this.i18nService.t("error"),
    });
  }
}
