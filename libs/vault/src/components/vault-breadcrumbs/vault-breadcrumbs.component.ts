import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { QueryParamsHandling } from "@angular/router";
import { switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils/collection-utils";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import {
  BitwardenIcon,
  BreadcrumbsModule,
  IconTileComponent,
  IconTileOptions,
} from "@bitwarden/components";

import { navIconTile } from "../../models/vault-icon-tile";
import {
  defaultUserCollectionId,
  MY_ITEMS_ROUTE,
  sharedFoldersCommands,
  vaultScopeCommands,
  VaultScope,
  VaultScopeType,
} from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

type TrailCrumb = {
  key: string;
  icon: BitwardenIcon;
  label: string;
  route: string[];
  queryParamsHandling?: QueryParamsHandling;
};

@Component({
  selector: "vault-breadcrumbs",
  templateUrl: "./vault-breadcrumbs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, IconTileComponent],
  host: {
    // `bit-breadcrumbs` sizes itself to its container, so this wrapper has to be one.
    class: "tw-flex tw-w-full tw-min-w-0",
  },
})
export class VaultBreadcrumbsComponent {
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly vaultNavService = inject(VaultNavService);
  private readonly i18nService = inject(I18nService);

  readonly scope = input.required<VaultScope>();

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly organizationId = computed(() => {
    const s = this.scope();
    return s.type === VaultScopeType.Organization ? s.organizationId : undefined;
  });

  private readonly collectionId = computed(() => {
    const s = this.scope();
    return s.type === VaultScopeType.Organization ? s.collectionId : undefined;
  });

  private readonly vaultNav = toSignal(
    this.userId$.pipe(switchMap((userId) => this.vaultNavService.viewModel$(userId))),
  );

  /** True for the org's "My items", by URL sentinel or resolved id, so either scope form matches. */
  private readonly myItems = computed(() => {
    const collectionId = this.collectionId();
    if (collectionId === MY_ITEMS_ROUTE) {
      return true;
    }
    const orgId = this.organizationId();
    return orgId != null && collectionId === defaultUserCollectionId(orgId, this.vaultNav());
  });

  protected readonly orgNavItem = computed(() => {
    const orgId = this.organizationId();
    if (orgId == null) {
      return undefined;
    }
    return this.vaultNav()?.vaults.find((v) => v.id === orgId);
  });

  protected readonly orgTile = computed((): IconTileOptions | undefined => {
    const item = this.orgNavItem();
    return item == null ? undefined : navIconTile(item);
  });

  private readonly sharedFoldersRoute = computed((): string[] => {
    const orgId = this.organizationId();
    return orgId == null ? [] : sharedFoldersCommands(orgId);
  });

  private readonly orgRootRoute = computed((): string[] => {
    const orgId = this.organizationId();
    if (orgId == null) {
      return [];
    }
    return vaultScopeCommands({ type: VaultScopeType.Organization, organizationId: orgId });
  });

  /** Unset on the all-vault-items page, where a link to the org root would point at the current URL. */
  protected readonly orgRootCrumbRoute = computed((): string[] | undefined =>
    this.collectionId() == null ? undefined : this.orgRootRoute(),
  );

  private readonly collections = toSignal(
    this.userId$.pipe(switchMap((userId) => this.collectionService.decryptedCollections$(userId))),
    { initialValue: [] as CollectionView[] },
  );

  private readonly scopedCollections = computed(() => {
    const orgId = this.organizationId();
    if (orgId == null) {
      return this.collections();
    }
    return this.collections().filter((c) => String(c.organizationId) === orgId);
  });

  private readonly collectionTree = computed(() =>
    getNestedCollectionTree(this.scopedCollections()),
  );

  private readonly sharedFolderNode = computed(() => {
    const collectionId = this.collectionId();
    if (collectionId == null) {
      return undefined;
    }
    // Predates strict null checks: a miss comes back as `null` despite the signature.
    return ServiceUtils.getTreeNodeObjectFromList(this.collectionTree(), collectionId) ?? undefined;
  });

  private readonly sharedFolderName = computed(() => this.sharedFolderNode()?.node.name ?? "");

  /** Ancestors of the selected folder, from org root to immediate parent. Current folder excluded. */
  private readonly collectionBreadcrumbs = computed((): CollectionView[] => {
    const node = this.sharedFolderNode();
    if (node == null) {
      return [];
    }
    const chain = [node];
    while (chain[chain.length - 1].parent != null) {
      chain.push(chain[chain.length - 1].parent);
    }
    return chain
      .slice(1)
      .reverse()
      .map((n) => n.node);
  });

  protected readonly trailCrumbs = computed((): TrailCrumb[] => {
    if (this.collectionId() == null) {
      return [
        this.currentCrumb("all-vault-items", "bwi-list-alt", this.i18nService.t("allVaultItems")),
      ];
    }

    if (this.myItems()) {
      return [this.currentCrumb("my-items", "bwi-user", this.i18nService.t("myItemsV2"))];
    }

    return [
      {
        key: "shared-folders",
        icon: "bwi-shared-folder",
        label: this.i18nService.t("sharedFolders"),
        route: this.sharedFoldersRoute(),
      },
      ...this.collectionBreadcrumbs().map((folder): TrailCrumb => ({
        key: folder.id,
        icon: "bwi-shared-folder",
        label: folder.name,
        route: this.sharedFolderRoute(folder),
      })),
      this.currentCrumb("shared-folder", "bwi-shared-folder", this.sharedFolderName()),
    ];
  });

  private currentCrumb(key: string, icon: BitwardenIcon, label: string): TrailCrumb {
    return { key, icon, label, route: [], queryParamsHandling: "preserve" };
  }

  private sharedFolderRoute(folder: CollectionView): string[] {
    const orgId = this.organizationId();
    if (orgId == null) {
      return [];
    }
    return vaultScopeCommands({
      type: VaultScopeType.Organization,
      organizationId: orgId,
      collectionId: folder.id,
    });
  }
}
