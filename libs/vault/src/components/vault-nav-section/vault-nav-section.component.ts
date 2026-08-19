import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import {
  defaultAvatarColors,
  IconTileComponent,
  isAvatarColor,
  NavigationModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultNavItemViewModel } from "../../models/vault-nav-view-model";
import { VaultNavService } from "../../services/vault-nav.service";

/**
 * Renders the Password Manager side-nav Vaults section from the shared {@link VaultNavService}
 * view-model. Selection is client-specific — web routes, desktop opens dialogs — so the host wires
 * these outputs to its own navigation rather than the component navigating itself.
 */
@Component({
  selector: "vault-nav-section",
  templateUrl: "./vault-nav-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, I18nPipe, NavigationModule, IconTileComponent],
})
export class VaultNavSectionComponent {
  private readonly vaultNavService = inject(VaultNavService);

  protected readonly vaultNav = toSignal(this.vaultNavService.viewModel$);

  readonly allItemsSelected = output<void>();
  readonly vaultSelected = output<VaultNavItemViewModel>();

  protected vaultTileColor(vault: VaultNavItemViewModel): string {
    return isAvatarColor(vault.color) ? defaultAvatarColors[vault.color] : vault.color;
  }
}
