import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PersonalVaultAlertService } from "../../services/personal-vault-alert.service";

@Component({
  selector: "app-reports",
  template: "<router-outlet></router-outlet>",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  providers: [PersonalVaultAlertService],
})
export class ReportsComponent {}
