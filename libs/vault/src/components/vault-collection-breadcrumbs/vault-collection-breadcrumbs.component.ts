import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils/collection-utils";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { BreadcrumbsModule, IconTileComponent, IconTileOptions } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { navIconTile } from "../../models/vault-icon-tile";
import {
  sharedFoldersCommands,
  vaultScopeCommands,
  VaultScope,
  VaultScopeType,
} from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

@Component({
  selector: "vault-collection-breadcrumbs",
  templateUrl: "./vault-collection-breadcrumbs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, IconTileComponent, I18nPipe],
  host: {
    // `bit-breadcrumbs` sizes itself to its container, so this wrapper has to be one.
    class: "tw-flex tw-w-full tw-min-w-0",
  },
})
export class VaultCollectionBreadcrumbsComponent {
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly vaultNavService = inject(VaultNavService);

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

  protected readonly sharedFoldersRoute = computed((): string[] => {
    const orgId = this.organizationId();
    return orgId == null ? [] : sharedFoldersCommands(orgId);
  });

  protected readonly orgRootRoute = computed((): string[] => {
    const orgId = this.organizationId();
    if (orgId == null) {
      return [];
    }
    return vaultScopeCommands({ type: VaultScopeType.Organization, organizationId: orgId });
  });

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

  protected readonly sharedFolderName = computed(() => this.sharedFolderNode()?.node.name ?? "");

  /** Ancestors of the selected folder, from org root to immediate parent. Current folder excluded. */
  protected readonly collectionBreadcrumbs = computed((): CollectionView[] => {
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

  protected sharedFolderRoute(folder: CollectionView): string[] {
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
