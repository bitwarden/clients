import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import {
  defaultAvatarColors,
  IconTileComponent,
  isAvatarColor,
  NavigationModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultNavItemType, VaultNavItemViewModel } from "../../models/vault-nav-view-model";
import { VaultNavService } from "../../services/vault-nav.service";
import { MY_VAULT } from "../vault-items-table/vault-items-table.component";

/**
 * Renders the Password Manager side-nav Vaults section from the shared {@link VaultNavService}
 * view-model, navigating to the vault the user picks.
 */
@Component({
  selector: "vault-nav-section",
  templateUrl: "./vault-nav-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, I18nPipe, NavigationModule, IconTileComponent],
})
export class VaultNavSectionComponent {
  private readonly vaultNavService = inject(VaultNavService);
  private readonly router = inject(Router);

  protected readonly vaultNav = toSignal(this.vaultNavService.viewModel$);

  protected async selectAllItems() {
    await this.router.navigate(["/vault"]);
  }

  protected async selectVault(vault: VaultNavItemViewModel) {
    const segment = vault.type === VaultNavItemType.Personal ? MY_VAULT : vault.id;
    await this.router.navigate(["/vault", segment]);
  }

  protected vaultTileColor(vault: VaultNavItemViewModel): string {
    return isAvatarColor(vault.color) ? defaultAvatarColors[vault.color] : vault.color;
  }
}
