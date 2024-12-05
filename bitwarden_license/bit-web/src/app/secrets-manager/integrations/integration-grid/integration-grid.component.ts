// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums";

import { Integration } from "../models/integration";

@Component({
  selector: "sm-integration-grid",
  templateUrl: "./integration-grid.component.html",
})
export class IntegrationGridComponent {
  @Input() integrations: Integration[];

  protected IntegrationType = IntegrationType;
}
