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

  protected readonly lineChartConfiguration: ChartConfig = {
    xAxisType: "datetime",
  };

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
      [this.i18nService.t("date")]: new Date(point.timestamp).toISOString().split("T")[0],
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
