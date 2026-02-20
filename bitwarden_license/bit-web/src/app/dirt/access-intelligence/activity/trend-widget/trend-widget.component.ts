import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Inject,
  input,
  output,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  ButtonModule,
  IconButtonModule,
  MenuModule,
  ToggleGroupModule,
  IconModule,
} from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { ChartConfig, LineChartComponent, LineData } from "../../../shared/line-chart.component";

export const TrendWidgetViewType = Object.freeze({
  Applications: "applications",
  Passwords: "passwords",
  Members: "members",
} as const);
export type TrendWidgetViewType = (typeof TrendWidgetViewType)[keyof typeof TrendWidgetViewType];

export const TrendWidgetTimespan = Object.freeze({
  PastMonth: "past-month",
  Past3Months: "past-3-months",
  Past6Months: "past-6-months",
  PastYear: "past-year",
  AllTime: "all-time",
} as const);
export type TrendWidgetTimespan = (typeof TrendWidgetTimespan)[keyof typeof TrendWidgetTimespan];

export interface TrendWidgetData {
  timeframe: TrendWidgetTimespan;
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
  ],
})
export class TrendWidgetComponent {
  protected readonly ViewType = TrendWidgetViewType;
  protected readonly Timespan = TrendWidgetTimespan;

  readonly data = input.required<TrendWidgetData>();
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly selectedView = signal<TrendWidgetViewType>(TrendWidgetViewType.Applications);
  readonly selectedTimespan = signal<TrendWidgetTimespan>(TrendWidgetTimespan.PastMonth);

  readonly viewChanged = output<TrendWidgetViewType>();
  readonly timespanChanged = output<TrendWidgetTimespan>();

  private readonly isDarkMode = toSignal(
    combineLatest([this.themeStateService.selectedTheme$, this.systemTheme$]).pipe(
      map(([theme, systemTheme]) => {
        const effectiveTheme = theme === ThemeType.System ? systemTheme : theme;
        return effectiveTheme === ThemeType.Dark;
      }),
    ),
    { initialValue: false },
  );

  constructor(
    private themeStateService: ThemeStateService,
    @Inject(SYSTEM_THEME_OBSERVABLE) private systemTheme$: Observable<ThemeType>,
    private i18nService: I18nService,
  ) {}

  protected onViewChange(view: TrendWidgetViewType) {
    this.selectedView.set(view);
    this.viewChanged.emit(view);
  }

  protected onTimespanChange(timespan: TrendWidgetTimespan) {
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

    return [
      {
        label: atRiskLabel,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.atRisk,
        })),
        color: isDark ? "#6d9eff" : "#175DDC",
        fillColor: isDark ? "rgba(109,158,255,0.2)" : "rgba(23,93,220,0.15)",
      },
      {
        label: allLabel,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.total,
        })),
        color: isDark ? "#4b5069" : "#E5E7EB",
        fillColor: isDark ? "rgba(75,80,105,0.3)" : "rgba(209,213,220,0.2)",
      },
    ];
  });

  private getAtRiskLabel(view: TrendWidgetViewType): string {
    switch (view) {
      case TrendWidgetViewType.Applications:
        return this.i18nService.t("applicationsAtRisk");
      case TrendWidgetViewType.Passwords:
        return this.i18nService.t("passwordsAtRisk");
      case TrendWidgetViewType.Members:
        return this.i18nService.t("membersAtRisk");
    }
  }

  private getAllLabel(view: TrendWidgetViewType): string {
    switch (view) {
      case TrendWidgetViewType.Applications:
        return this.i18nService.t("allApplications");
      case TrendWidgetViewType.Passwords:
        return this.i18nService.t("allPasswords");
      case TrendWidgetViewType.Members:
        return this.i18nService.t("allMembers");
    }
  }

  protected readonly lineChartConfiguration: ChartConfig = {
    xAxisType: "datetime",
  };
}
