import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AsyncActionsModule, ButtonModule } from "@bitwarden/components";
import { ConfirmKeyConnectorDomainComponent as BaseConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";

@Component({
  selector: "app-confirm-key-connector-domain",
  templateUrl: "confirm-key-connector-domain.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, ButtonModule, AsyncActionsModule, RouterModule],
})
export class ConfirmKeyConnectorDomainComponent extends BaseConfirmKeyConnectorDomainComponent {}
