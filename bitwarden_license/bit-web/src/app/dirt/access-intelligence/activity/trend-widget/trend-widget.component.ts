import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";

import { ButtonModule, IconButtonModule, ToggleGroupModule } from "@bitwarden/components";

import { LineChartComponent, LineData } from "./line-chart/line-chart.component";

@Component({
  selector: "trend-widget",
  templateUrl: "./trend-widget.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonModule, ButtonModule, ToggleGroupModule, LineChartComponent],
})
export class TrendWidgetComponent {
  readonly selectedView = signal<"applications" | "passwords" | "members">("applications");
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
  readonly lineChartData = computed(() => {
    const view = this.selectedView();

    switch (view) {
      case "applications":
        return this.inputData();
      case "passwords":
        return this.inputData();
      case "members":
        return this.inputData();
    }

    return this.inputData();
  });
}
