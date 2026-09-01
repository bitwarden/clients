import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions, NavigationEnd, Router } from "@angular/router";
import { filter, map, switchMap } from "rxjs";

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
  sharedFoldersCommands,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

/**
 * Route matching that ignores every dimension a vault route never varies in, leaving the path as
 * the only thing compared.
 */
const pathMatch = (paths: "exact" | "subset"): IsActiveMatchOptions => ({
  paths,
  queryParams: "ignored",
  fragment: "ignored",
  matrixParams: "ignored",
});

/** The route itself and nothing nested beneath it. */
const EXACT_PATH = pathMatch("exact");

/** The route or anything nested beneath it — `routerLinkActive`'s own default. */
const NESTED_PATH = pathMatch("subset");

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
  private readonly router = inject(Router);

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
  protected readonly allItemsActiveOptions: IsActiveMatchOptions = EXACT_PATH;

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

  /** Whether to render one unscoped entry rather than All items and a list. */
  protected readonly personalOnly = computed(() => {
    const nav = this.vaultNav();
    return nav != null && isPersonalOnly(nav);
  });

  /**
   * `router.isActive` reads router state rather than a signal, so reading this is what ties
   * {@link sharedFoldersVaultId} to navigation — without it the answer would be computed once.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The vault whose shared folders are the page in view, if any — either the list itself or the
   * drill-in to one of them.
   *
   * Both nest under the vault's own route, so the test is a match deeper than that route rather
   * than a match on either page's own path: the drill-in's `:collectionId` segment can't be told
   * apart from anything else that might nest there, and it has no nav entry of its own to light.
   * The vault route matching as a subset but not exactly says the page is one of the two.
   */
  private readonly sharedFoldersVaultId = computed(() => {
    this.currentUrl();

    return Array.from(this.sharedFolderRoutes().keys()).find((id) => {
      const commands = this.vaultRoutes().get(id);
      if (commands == null) {
        return false;
      }

      const vaultRoute = this.router.createUrlTree(commands);
      return (
        this.router.isActive(vaultRoute, NESTED_PATH) &&
        !this.router.isActive(vaultRoute, EXACT_PATH)
      );
    });
  });

  protected vaultRoute(vault: VaultNavItemViewModel): string[] | undefined {
    return this.vaultRoutes().get(vault.id);
  }

  protected sharedFoldersRoute(vault: VaultNavItemViewModel): string[] | undefined {
    return this.sharedFolderRoutes().get(vault.id);
  }

  /** Whether the page in view is this vault's shared folders list or a folder within it. */
  protected sharedFoldersActive(vault: VaultNavItemViewModel): boolean {
    return this.sharedFoldersVaultId() === vault.id;
  }

  protected vaultTileColor(vault: VaultNavItemViewModel): string {
    return isAvatarColor(vault.color) ? defaultAvatarColors[vault.color] : vault.color;
  }
}
