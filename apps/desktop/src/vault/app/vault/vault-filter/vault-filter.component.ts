import { Component } from "@angular/core";

import { VaultFilterComponent as BaseVaultFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/vault-filter.component";

@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
  standalone: false,
})
export class VaultFilterComponent extends BaseVaultFilterComponent {}
