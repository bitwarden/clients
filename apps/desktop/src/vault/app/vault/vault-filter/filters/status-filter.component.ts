import { Component } from "@angular/core";

import { StatusFilterComponent as BaseStatusFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/status-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-status-filter",
  templateUrl: "status-filter.component.html",
  standalone: false,
})
export class StatusFilterComponent extends BaseStatusFilterComponent {}
