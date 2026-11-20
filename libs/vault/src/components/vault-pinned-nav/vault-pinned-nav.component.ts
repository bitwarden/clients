import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { isActive, Router } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  sharedFoldersCommands,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";
import { EXACT_PATH } from "../../routing/exact-path";
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
  private readonly organizationService = inject(OrganizationService);
  private readonly pinnedSharedFolders = inject(PinnedSharedFoldersService);
  private readonly router = inject(Router);

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

  protected readonly organization = toSignal(
    combineLatest([this.userId$, toObservable(this.organizationId)]).pipe(
      switchMap(([userId, organizationId]) =>
        this.organizationService
          .organizations$(userId)
          .pipe(map((organizations) => organizations.find((org) => org.id === organizationId))),
      ),
    ),
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

  /** Each folder's `isActive` signal. Rebuilt only when the pinned folders change. */
  private readonly folderActive = computed(() =>
    [...this.routes()].map(([id, route]) => ({
      id,
      active: isActive(this.router.createUrlTree(route), this.router, EXACT_PATH),
    })),
  );

  private readonly folderInView = computed(() => this.folderActive().some((f) => f.active()));

  private readonly activeFolderId = computed(() => this.folderActive().find((f) => f.active())?.id);

  private readonly previousActiveFolderId = signal<CollectionId | undefined>(undefined);

  /**
   * Whether the page in view is one of this section's folders, at any depth. The Shared folders
   * entry listens to this to give way to the folder, which has an entry of its own here.
   */
  readonly folderInViewChange = output<boolean>();

  constructor() {
    effect(() => this.folderInViewChange.emit(this.folderInView()));

    effect(() => {
      const previous = untracked(this.previousActiveFolderId);
      this.previousActiveFolderId.set(this.activeFolderId());
      if (previous != null && !this.collections().some((c) => c.id === previous)) {
        void this.router.navigate(sharedFoldersCommands(this.organizationId()), {
          replaceUrl: true,
        });
      }
    });
  }

  protected async dismissEmptyState(): Promise<void> {
    const userId = this.userId();
    if (userId != null) {
      await this.pinnedSharedFolders.dismissEmptyState(userId);
    }
  }
}
