import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  IconButtonModule,
  IconModule,
  IconTileComponent,
  IconTileOptions,
  MenuModule,
  PopoverModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  ALL_ITEMS_SCOPE,
  CoachmarkComponent,
  CoachmarkService,
  MY_ITEMS_ROUTE,
  MY_VAULT_ROUTE,
  navIconTile,
  offersVaultChoice,
  organizationVaultPage,
  OrganizationVaultPage,
  VAULT_BASE_ROUTE,
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultNavService,
  type VaultScope,
  VaultScopeType,
  vaultScopeCommands,
} from "@bitwarden/vault";

import { VaultPopupListTableFiltersService } from "../../../services/vault-popup-list-table-filters.service";
import { VaultPopupScrollPositionService } from "../../../services/vault-popup-scroll-position.service";

/** A menu entry: All items, one of the account's vaults, or an organization's "My items". */
interface VaultSwitcherEntry {
  /** Matches {@link VaultSwitcherComponent.selectedId}; `null` for All items. */
  id: string | null;
  scope: VaultScope;
  label: string;
  /** The owning organization's name, telling one "My items" from another. */
  subtitle?: string;
  tile: IconTileOptions;
}

/**
 * Vault switcher for the popup's title bar. Navigates to the scoped route rather than holding a
 * selection, so the router cache restores the vault on reopen.
 */
@Component({
  selector: "app-vault-switcher",
  templateUrl: "vault-switcher.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CoachmarkComponent,
    I18nPipe,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    MenuModule,
    PopoverModule,
    TypographyModule,
  ],
})
export class VaultSwitcherComponent {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly vaultNavService = inject(VaultNavService);
  private readonly basePath = inject(VAULT_BASE_ROUTE);
  private readonly i18nService = inject(I18nService);
  private readonly listFiltersService = inject(VaultPopupListTableFiltersService);
  private readonly scrollPositionService = inject(VaultPopupScrollPositionService);
  protected readonly coachmark = inject(CoachmarkService);

  /** The scope the page resolved from the route. */
  readonly scope = input<VaultScope | null>(ALL_ITEMS_SCOPE);

  private readonly nav = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.vaultNavService.viewModel$(userId)),
    ),
  );

  /**
   * The vaults to switch between, led by All items, each organization followed by its "My items".
   * Empty when there is nothing to switch between — see `offersVaultChoice`.
   */
  protected readonly entries = computed((): VaultSwitcherEntry[] => {
    const nav = this.nav();
    if (nav == null || !offersVaultChoice(nav)) {
      return [];
    }

    return [
      {
        id: null,
        scope: ALL_ITEMS_SCOPE,
        label: this.i18nService.t("allItems"),
        tile: { icon: "bwi-list", variant: "brand", emphasis: "bold" },
      },
      ...nav.vaults.flatMap((vault) => this.entriesFor(vault)),
    ];
  });

  protected readonly coachmarkActive = computed(() => this.coachmark.isStepActive("switchVaults"));

  /** The selected entry's id, or `null` for All items. */
  protected readonly selectedId = computed((): string | null => {
    const scope = this.scope();
    return scope == null ? null : this.idFor(scope);
  });

  /** The trigger's entry — the selected vault, or All items. */
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return this.entries().find((entry) => entry.id === id) ?? null;
  });

  protected select(entry: VaultSwitcherEntry): void {
    // The entry in view is clickable too, and the route would reload rather than no-op.
    if (entry.id === this.selectedId()) {
      return;
    }

    // Cleared from the user's action, not the scope publish — that also fires on popup open.
    if (entry.id != null) {
      this.listFiltersService.clearVaultScopedFilters();
    }

    // The offset names nothing in a different list, and the rebuilt page would restore it.
    this.scrollPositionService.stop(true);

    void this.router.navigate(vaultScopeCommands(entry.scope, this.basePath), {
      // The scoped vault is the same page narrowed, not a step to return from.
      replaceUrl: true,
    });
  }

  /** A vault's entry, followed by its "My items" when the organization has one. */
  private entriesFor(vault: VaultNavItemViewModel): VaultSwitcherEntry[] {
    const tile = navIconTile(vault);

    if (vault.type === VaultNavItemType.Personal) {
      const scope: VaultScope = { type: VaultScopeType.MyVault };
      return [{ id: this.idFor(scope), scope, label: vault.label, tile }];
    }

    const organizationId = vault.id as OrganizationId;
    const scope: VaultScope = { type: VaultScopeType.Organization, organizationId };
    const entries: VaultSwitcherEntry[] = [
      { id: this.idFor(scope), scope, label: vault.label, tile },
    ];

    if (vault.defaultUserCollectionId != null) {
      const myItems: VaultScope = { ...scope, collectionId: MY_ITEMS_ROUTE };
      entries.push({
        id: this.idFor(myItems),
        scope: myItems,
        label: this.i18nService.t("myItemsV2"),
        subtitle: vault.label,
        tile,
      });
    }

    return entries;
  }

  /** The entry id naming a scope; Trash, Archive, and folders fall back to All items. */
  private idFor(scope: VaultScope): string | null {
    switch (scope.type) {
      case VaultScopeType.MyVault:
        return MY_VAULT_ROUTE;
      case VaultScopeType.Organization:
        return organizationVaultPage(scope, this.nav()) === OrganizationVaultPage.MyItems
          ? `${scope.organizationId}/${MY_ITEMS_ROUTE}`
          : scope.organizationId;
      default:
        return null;
    }
  }
}
