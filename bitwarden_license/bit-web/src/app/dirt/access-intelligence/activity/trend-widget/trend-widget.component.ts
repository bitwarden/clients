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
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  ButtonModule,
  IconButtonModule,
  MenuModule,
  ToggleGroupModule,
  IconModule,
} from "@bitwarden/components";

import { LineChartComponent, LineData } from "./line-chart/line-chart.component";

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
  ) {}

  protected onViewChange(view: TrendWidgetViewType) {
    this.selectedView.set(view);
    this.viewChanged.emit(view);
  }

  protected onTimespanChange(timespan: TrendWidgetTimespan) {
    this.selectedTimespan.set(timespan);
    this.timespanChanged.emit(timespan);
  }

  protected readonly timespanLabel = computed(() => {
    switch (this.selectedTimespan()) {
      case TrendWidgetTimespan.PastMonth:
        return "Past month";
      case TrendWidgetTimespan.Past3Months:
        return "Past 3 months";
      case TrendWidgetTimespan.Past6Months:
        return "Past 6 months";
      case TrendWidgetTimespan.PastYear:
        return "Past year";
      case TrendWidgetTimespan.AllTime:
        return "All time";
    }
  });
  protected readonly viewLabel = computed(() => {
    switch (this.selectedView()) {
      case TrendWidgetViewType.Applications:
        return "Applications";
      case TrendWidgetViewType.Passwords:
        return "Passwords";
      case TrendWidgetViewType.Members:
        return "Members";
    }
  });

  protected readonly lineChartData = computed<LineData[]>(() => {
    const dataPoints = this.data().dataPoints;
    const label = this.viewLabel();
    const isDark = this.isDarkMode();

    return [
      {
        label: `${label} at risk`,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.atRisk,
        })),
        color: isDark ? "#6d9eff" : "#175DDC",
        fillColor: isDark ? "rgba(109,158,255,0.2)" : "rgba(23,93,220,0.15)",
      },
      {
        label: `All ${label.toLowerCase()}`,
        pointData: dataPoints.map((point) => ({
          x: new Date(point.timestamp),
          y: point.total,
        })),
        color: isDark ? "#4b5069" : "#E5E7EB",
        fillColor: isDark ? "rgba(75,80,105,0.3)" : "rgba(209,213,220,0.2)",
      },
    ];
  });
}
