import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonType,
  IconButtonModule,
  IconModule,
  MenuModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import { BULK_DELETE_DIALOG, BulkDeleteDialogRef } from "../../tokens/bulk-delete-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";

/**
 * Pin/Unpin, Edit info, Edit access, and Delete menu for one shared folder.
 *
 * A client providing neither {@link COLLECTION_DIALOG} nor {@link BULK_DELETE_DIALOG}, with
 * {@link showPin} off, renders an empty host element — a caller relying on CSS to collapse an
 * empty wrapper (e.g. `empty:tw-hidden`) needs its own `@if` around this component.
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

  private readonly userId$ = this.accountService.activeAccount$.pipe(getOptionalUserId);

  readonly collection = input.required<CollectionView>();

  readonly organization = input<Organization | undefined>(undefined);

  readonly triggerIcon = input.required<string>();

  readonly triggerSize = input<"default" | "xsmall" | "small" | "large">("small");

  readonly triggerButtonType = input<ButtonType>("primaryGhost");

  readonly idPrefix = input.required<string>();

  readonly showPin = input<boolean>(false);

  readonly showDelete = input<boolean>(true);

  protected readonly CollectionDialogTab = CollectionDialogTab;

  private readonly pinnedIds = this.pinnedSharedFolders.activePinnedIds;

  protected readonly showEditActions = computed(
    () => this.collectionDialog != null && this.collection().canEdit(this.organization()),
  );

  /** `canDelete(undefined)` doesn't honor `limitCollectionDeletion`, which would let this render
   * enabled right before `delete()`'s own `organization() == null` guard no-ops the click. */
  protected readonly showDeleteAction = computed(
    () =>
      this.showDelete() &&
      this.bulkDeleteDialog != null &&
      this.organization() != null &&
      this.collection().canDelete(this.organization()),
  );

  protected readonly showPinAction = computed(
    () => this.showPin() && !this.collection().isDefaultCollection,
  );

  protected readonly showMenu = computed(
    () => this.showEditActions() || this.showDeleteAction() || this.showPinAction(),
  );

  protected readonly isPinned = computed(() => this.pinnedIds().includes(this.collection().id));

  protected async togglePin(): Promise<void> {
    const collection = this.collection();
    const userId = await firstValueFrom(this.userId$);
    if (userId == null) {
      return;
    }
    // Snapshotted `collection`, not a live re-read: the input can change mid-await.
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
