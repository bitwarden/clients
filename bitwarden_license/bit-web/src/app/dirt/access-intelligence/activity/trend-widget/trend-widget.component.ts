import { ChangeDetectionStrategy, Component, computed, output, signal } from "@angular/core";

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

  readonly selectedView = signal<TrendWidgetViewType>(TrendWidgetViewType.Applications);
  readonly selectedTimespan = signal<TrendWidgetTimespan>(TrendWidgetTimespan.PastMonth);

  readonly viewChanged = output<TrendWidgetViewType>();
  readonly timespanChanged = output<TrendWidgetTimespan>();

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
  readonly inputData = signal<LineData[]>([
    {
      label: "Primary",
      pointData: [
        { x: new Date(2026, 1, 2), y: 50 },
        { x: new Date(2026, 1, 4), y: 60 },
      ],
      color: "#175DDC",
      fillColor: "#DBE5F6",
    },
    {
      label: "Secondary",
      pointData: [
        { x: new Date(2026, 1, 2), y: 100 },
        { x: new Date(2026, 1, 4), y: 150 },
      ],
      color: "#E5E7EB",
      fillColor: "#F3F6F9",
    },
  ]);
  readonly lineChartData = computed<LineData[]>(() => {
    const view = this.selectedView();

    switch (view) {
      case TrendWidgetViewType.Applications:
        return this.inputData();
      case TrendWidgetViewType.Passwords:
        return this.inputData();
      case TrendWidgetViewType.Members:
        return this.inputData();
    }

    return this.inputData();
  });
}
