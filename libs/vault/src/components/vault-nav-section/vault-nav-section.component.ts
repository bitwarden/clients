import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions } from "@angular/router";
import { switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { IconTileComponent, IconTileOptions, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { navIconTile } from "../../models/vault-icon-tile";
import { VaultNavItemType, VaultNavItemViewModel } from "../../models/vault-nav-view-model";
import {
  ALL_ITEMS_SCOPE,
  isPersonalOnly,
  MY_ITEMS_ROUTE,
  sharedFoldersCommands,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

/**
 * Matches the route itself and nothing nested beneath it, ignoring every dimension a vault route
 * never varies in so the path is the only thing compared.
 */
const EXACT_PATH: IsActiveMatchOptions = {
  paths: "exact",
  queryParams: "ignored",
  fragment: "ignored",
  matrixParams: "ignored",
};

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
   * The match for the two entries naming a whole vault — All items and an organization's All vault
   * items. Every deeper destination nests under the route each links to, so `routerLinkActive`'s
   * default subset match would leave them lit alongside the page the user actually picked.
   *
   * Shared folders and My items stay on that default: the first stands in for its drill-ins, and
   * nothing nests under the second.
   */
  protected readonly exactRouteOptions: IsActiveMatchOptions = EXACT_PATH;

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

  /**
   * Each organization vault's shared folders route, by vault id. Precomputed for the same reason
   * {@link vaultRoutes} is. Personal vaults have no shared folders, so they get no entry.
   */
  private readonly sharedFolderRoutes = computed(
    () =>
      new Map(
        this.vaultNav()
          ?.vaults.filter((vault) => vault.type !== VaultNavItemType.Personal)
          .map((vault) => [vault.id, sharedFoldersCommands(vault.id as OrganizationId)]) ?? [],
      ),
  );

  /** "My items" route commands for each organization holding one, by vault id. */
  private readonly myItemsRoutes = computed(
    () =>
      new Map(
        this.vaultNav()
          ?.vaults.filter((vault) => vault.defaultUserCollectionId != null)
          .map((vault) => [
            vault.id,
            vaultScopeCommands({
              type: VaultScopeType.Organization,
              organizationId: vault.id as OrganizationId,
              collectionId: MY_ITEMS_ROUTE,
            }),
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

  protected sharedFoldersRoute(vault: VaultNavItemViewModel): string[] | undefined {
    return this.sharedFolderRoutes().get(vault.id);
  }

  protected myItemsRoute(vault: VaultNavItemViewModel): string[] | undefined {
    return this.myItemsRoutes().get(vault.id);
  }

  /**
   * The nav entry's icon tile. Organization entries resolve through the themed decorative variants;
   * the personal entry keeps its avatar-matched hex. See `vault-icon-tile.ts` for why they differ.
   */
  protected tile(vault: VaultNavItemViewModel): IconTileOptions {
    return navIconTile(vault);
  }
}
