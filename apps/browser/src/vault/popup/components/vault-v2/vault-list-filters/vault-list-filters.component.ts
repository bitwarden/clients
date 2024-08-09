import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ChipSelectComponent } from "@bitwarden/components";

import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";

@Component({
  standalone: true,
  selector: "app-vault-list-filters",
  templateUrl: "./vault-list-filters.component.html",
  imports: [CommonModule, JslibModule, ChipSelectComponent, ReactiveFormsModule],
})
export class VaultListFiltersComponent {
  protected filterForm = this.vaultPopupListFiltersService.filterForm;
  protected organizations$ = this.vaultPopupListFiltersService.organizations$;
  protected collections$ = this.vaultPopupListFiltersService.collections$;
  protected folders$ = this.vaultPopupListFiltersService.folders$;
  protected cipherTypes = this.vaultPopupListFiltersService.cipherTypes;

  constructor(private vaultPopupListFiltersService: VaultPopupListFiltersService) {}
}
