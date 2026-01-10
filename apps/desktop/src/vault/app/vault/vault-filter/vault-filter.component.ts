import { Component } from "@angular/core";

import { VaultFilterComponent as BaseVaultFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/vault-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
  standalone: false,
})
export class VaultFilterComponent extends BaseVaultFilterComponent {}
