import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions } from "@angular/router";
import { switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  defaultAvatarColors,
  IconTileComponent,
  isAvatarColor,
  NavigationModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultNavItemType, VaultNavItemViewModel } from "../../models/vault-nav-view-model";
import {
  ALL_ITEMS_SCOPE,
  isPersonalOnly,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

/**
 * Renders the Password Manager side-nav Vaults section from the shared {@link VaultNavService}
 * view-model, linking each entry to the vault route that scopes the page to it.
 */
@Component({
  selector: "vault-nav-section",
  templateUrl: "./vault-nav-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, I18nPipe, NavigationModule, IconTileComponent],
})
export class VaultNavSectionComponent {
  protected readonly VaultNavItemType = VaultNavItemType;

  private readonly vaultNavService = inject(VaultNavService);
  private readonly accountService = inject(AccountService);

  protected readonly vaultNav = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.vaultNavService.viewModel$(userId)),
    ),
  );

  protected readonly allItemsRoute = vaultScopeCommands(ALL_ITEMS_SCOPE);

  /**
   * Every scoped vault route nests under the unscoped one, so a subset match would leave the item
   * pointing at `/vault` lit alongside the destination the user actually picked.
   */
  protected readonly allItemsActiveOptions: IsActiveMatchOptions = {
    paths: "exact",
    queryParams: "ignored",
    fragment: "ignored",
    matrixParams: "ignored",
  };

  /**
   * Each vault's route commands, by vault id. Precomputed rather than built per call so the
   * template hands `routerLink` a stable array — a new one on every change detection pass would
   * have it recompute each link's href continuously.
   */
  private readonly vaultRoutes = computed(
    () =>
      new Map(
        this.vaultNav()?.vaults.map((vault) => [
          vault.id,
          vaultScopeCommands(
            vault.type === VaultNavItemType.Personal
              ? { type: VaultScopeType.MyVault }
              : { type: VaultScopeType.Organization, organizationId: vault.id as OrganizationId },
          ),
        ]) ?? [],
      ),
  );

  /** Whether to render one unscoped entry rather than All items and a list. */
  protected readonly personalOnly = computed(() => {
    const nav = this.vaultNav();
    return nav != null && isPersonalOnly(nav);
  });

  protected vaultRoute(vault: VaultNavItemViewModel): string[] | undefined {
    return this.vaultRoutes().get(vault.id);
  }

  protected vaultTileColor(vault: VaultNavItemViewModel): string {
    return isAvatarColor(vault.color) ? defaultAvatarColors[vault.color] : vault.color;
  }
}
