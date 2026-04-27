import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-reports",
  template: "<router-outlet></router-outlet>",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
})
export class ReportsComponent {}
