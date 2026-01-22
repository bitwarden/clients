import { Component, OnInit } from "@angular/core";

import { IntegrationGridComponent } from "../integration-grid/integration-grid.component";
import { FilterIntegrationsPipe } from "../integrations.pipe";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "single-sign-on",
  templateUrl: "single-sign-on.component.html",
  imports: [IntegrationGridComponent, FilterIntegrationsPipe],
})
export class SingleSignOnComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
