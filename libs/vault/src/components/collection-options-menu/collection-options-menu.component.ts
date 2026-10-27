import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, switchMap } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId } from "@bitwarden/common/types/guid";
import { IconButtonModule, IconModule, MenuModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import { BULK_DELETE_DIALOG, BulkDeleteDialogRef } from "../../tokens/bulk-delete-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";

/**
 * Pin/Unpin, Edit info, Edit access, and Delete menu for one shared folder. Used by the vault's
 * breadcrumb header and the shared folders table's per-row menu.
 *
 * Edit/Delete each need a token the client supplies — {@link COLLECTION_DIALOG},
 * {@link BULK_DELETE_DIALOG}. Pin/Unpin needs neither — it's plain device-local state any client
 * can offer. A client that provides neither dialog and doesn't opt into {@link showPin} renders
 * nothing. The host element still exists even then, so a caller relying on CSS to collapse an
 * empty wrapper (e.g. a table cell's `empty:tw-hidden`) needs its own `@if` around this component.
 */
@Component({
  selector: "vault-collection-options-menu",
  templateUrl: "collection-options-menu.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonModule, IconModule, MenuModule, I18nPipe],
})
export class CollectionOptionsMenuComponent {
  private readonly collectionDialog = inject<CollectionDialogRef>(COLLECTION_DIALOG, {
    optional: true,
  });
  private readonly bulkDeleteDialog = inject<BulkDeleteDialogRef>(BULK_DELETE_DIALOG, {
    optional: true,
  });
  private readonly pinnedSharedFolders = inject(PinnedSharedFoldersService);
  private readonly accountService = inject(AccountService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  readonly collection = input.required<CollectionView>();

  /** `undefined` while the organization list is still loading. */
  readonly organization = input<Organization | undefined>(undefined);

  readonly triggerIcon = input.required<string>();

  /** Prefix for this instance's element ids, so multiple menus on one page don't collide. */
  readonly idPrefix = input.required<string>();

  /** Whether the menu offers Pin/Unpin. Off by default, since it's an opt-in capability not every
   * consumer wants. */
  readonly showPin = input<boolean>(false);

  /** Exposed so the template can name a tab by member rather than a bare string. */
  protected readonly CollectionDialogTab = CollectionDialogTab;

  /** The ids the user pinned. */
  private readonly pinnedIds = toSignal(
    this.userId$.pipe(switchMap((userId) => this.pinnedSharedFolders.pinnedIds$(userId))),
    { initialValue: [] as CollectionId[] },
  );

  protected readonly showEditActions = computed(
    () => this.collectionDialog != null && this.collection().canEdit(this.organization()),
  );

  protected readonly showDeleteAction = computed(
    () => this.bulkDeleteDialog != null && this.collection().canDelete(this.organization()),
  );

  /** Pin isn't permission-gated like Edit/Delete, so the default collection needs excluding here. */
  protected readonly showPinAction = computed(
    () => this.showPin() && !this.collection().isDefaultCollection,
  );

  protected readonly showMenu = computed(
    () => this.showEditActions() || this.showDeleteAction() || this.showPinAction(),
  );

  /** Whether the viewed folder is pinned, for the Pin/Unpin item's label and icon. */
  protected readonly isPinned = computed(() => this.pinnedIds().includes(this.collection().id));

  /** Toasts only after the pin/unpin write resolves, so it never reports a change that didn't land. */
  protected async togglePin(): Promise<void> {
    const collection = this.collection();
    const userId = await firstValueFrom(this.userId$);
    // Checked against the snapshotted `collection`, not a live re-read of `this.collection()` —
    // the input can change mid-await (e.g. CDK virtual-scroll row recycling), which would otherwise
    // decide pin-vs-unpin for a different folder than the one this call is about to mutate.
    const pinned = this.pinnedIds().includes(collection.id);
    if (pinned) {
      await this.pinnedSharedFolders.unpin(userId, collection.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("folderUnpinnedFromSidebar", collection.name),
      });
    } else {
      await this.pinnedSharedFolders.pin(userId, collection.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("folderPinnedToSidebar", collection.name),
      });
    }
  }

  protected async editCollection(initialTab: CollectionDialogTab): Promise<void> {
    const collection = this.collection();
    await this.collectionDialog?.open({
      organizationId: collection.organizationId,
      collectionId: collection.id,
      initialTab,
    });
  }

  protected async delete(): Promise<void> {
    const organization = this.organization();
    const collection = this.collection();
    if (organization == null) {
      return;
    }
    await this.bulkDeleteDialog?.open({ organization, collections: [collection] });
  }
}
