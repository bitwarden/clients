import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { vaultScopeCommands, VaultScopeType } from "../../models/vault-scope";
import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";

import { PinnedFolderNode, resolvePinnedFolderNodes } from "./pinned-shared-folder-nodes";
import { VaultPinnedNavNodeComponent } from "./vault-pinned-nav-node.component";

/**
 * The "Pinned" section of one organization's side-nav group: the shared folders the user pinned,
 * each expandable to the folders nested beneath it.
 *
 * With nothing pinned it offers a dismissible hint at how to pin, until the hint is dismissed or a
 * folder is pinned. After that an empty section renders nothing at all.
 */
@Component({
  selector: "vault-pinned-nav",
  templateUrl: "./vault-pinned-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigationModule, I18nPipe, VaultPinnedNavNodeComponent],
})
export class VaultPinnedNavComponent {
  readonly organizationId = input.required<OrganizationId>();

  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly pinnedSharedFolders = inject(PinnedSharedFoldersService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly userId = toSignal(this.userId$);

  private readonly pinnedIds = toSignal(
    this.userId$.pipe(switchMap((userId) => this.pinnedSharedFolders.pinnedIds$(userId))),
    { initialValue: [] },
  );

  protected readonly emptyStateDismissed = toSignal(
    this.userId$.pipe(switchMap((userId) => this.pinnedSharedFolders.emptyStateDismissed$(userId))),
    // Unknown until the state loads; assuming dismissed keeps the hint from flashing in.
    { initialValue: true },
  );

  private readonly collections = toSignal(
    this.userId$.pipe(switchMap((userId) => this.collectionService.decryptedCollections$(userId))),
    { initialValue: [] },
  );

  /** The pinned folders that resolve in this organization. Stale ids never reach the nav. */
  protected readonly nodes = computed<PinnedFolderNode[]>(() =>
    resolvePinnedFolderNodes({
      organizationId: this.organizationId(),
      collections: this.collections(),
      pinnedIds: this.pinnedIds(),
    }),
  );

  /**
   * Each folder's route commands, by id. Precomputed rather than built per render so the template
   * hands `routerLink` a stable array — see `VaultNavSectionComponent`.
   */
  protected readonly routes = computed(() => {
    const routes = new Map<CollectionId, string[]>();
    const add = (nodes: PinnedFolderNode[]) => {
      for (const node of nodes) {
        routes.set(
          node.id,
          vaultScopeCommands({
            type: VaultScopeType.Organization,
            organizationId: this.organizationId(),
            collectionId: node.id,
          }),
        );
        add(node.children);
      }
    };
    add(this.nodes());
    return routes;
  });

  protected async dismissEmptyState(): Promise<void> {
    const userId = this.userId();
    if (userId != null) {
      await this.pinnedSharedFolders.dismissEmptyState(userId);
    }
  }
}
