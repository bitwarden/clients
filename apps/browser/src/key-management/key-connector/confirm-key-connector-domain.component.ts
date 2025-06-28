// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { CommonModule } from "@angular/common";
// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { Component } from "@angular/core";
// FIXME (PM-22628): angular imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
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
