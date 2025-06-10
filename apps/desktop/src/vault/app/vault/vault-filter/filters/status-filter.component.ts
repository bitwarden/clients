import { Component } from "@angular/core";

import { StatusFilterComponent as BaseStatusFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/status-filter.component";

@Component({
  selector: "app-status-filter",
  templateUrl: "status-filter.component.html",
  standalone: false,
})
export class StatusFilterComponent extends BaseStatusFilterComponent {}
