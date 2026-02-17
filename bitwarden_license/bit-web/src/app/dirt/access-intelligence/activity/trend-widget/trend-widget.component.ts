import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ButtonModule, IconButtonModule, ToggleGroupModule } from "@bitwarden/components";

@Component({
  selector: "trend-widget",
  templateUrl: "./trend-widget.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonModule, ButtonModule, ToggleGroupModule],
})
export class TrendWidgetComponent {}
