import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, switchMap } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { IconButtonModule, IconModule, MenuModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import {
  BULK_DELETE_DIALOG,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
} from "../../tokens/bulk-delete-dialog.token";
import {
  COLLECTION_DIALOG,
  CollectionDialogOutcome,
  CollectionDialogRef,
  CollectionDialogTab,
} from "../../tokens/collection-dialog.token";

/** What `editCollection()`/`delete()` did, and which folder it targeted. */
export type CollectionActionResult = {
  deleted: boolean;
  organizationId: OrganizationId;
  collectionId: CollectionId;
};

/**
 * Pin/Unpin, Edit info, Edit access, and Delete menu for one shared folder.
 *
 * Edit/Delete each need a token the client supplies — {@link COLLECTION_DIALOG},
 * {@link BULK_DELETE_DIALOG}. Pin needs neither. A caller collapsing this component's wrapper via
 * CSS (e.g. `empty:tw-hidden`) must gate it with its own `@if`, not rely on this component — see
 * `showMenu`.
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

  /** The folder the menu acts on. */
  readonly collection = input.required<CollectionView>();

  /** `undefined` while the organization list is still loading. */
  readonly organization = input<Organization | undefined>(undefined);

  readonly triggerIcon = input.required<string>();

  /** Prefix for this instance's element ids, so multiple menus on one page don't collide. */
  readonly idPrefix = input.required<string>();

  readonly showPin = input<boolean>(false);

  /** Whether Delete may appear, independent of `BULK_DELETE_DIALOG`'s presence. Desktop's header
   * menu sets this `false` since it already provides that token for an unrelated bulk-select bar. */
  readonly showDelete = input<boolean>(true);

  readonly actionResult = output<CollectionActionResult>();

  /** Exposed so the template can name a tab by member rather than a bare string. */
  protected readonly CollectionDialogTab = CollectionDialogTab;

  /** The ids the user pinned — see `SharedFoldersComponent`'s own copy. */
  private readonly pinnedIds = toSignal(
    this.userId$.pipe(switchMap((userId) => this.pinnedSharedFolders.pinnedIds$(userId))),
    { initialValue: [] as CollectionId[] },
  );

  protected readonly showEditActions = computed(
    () => this.collectionDialog != null && this.collection().canEdit(this.organization()),
  );

  protected readonly showDeleteAction = computed(
    () =>
      this.showDelete() &&
      this.bulkDeleteDialog != null &&
      this.collection().canDelete(this.organization()),
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
    if (this.isPinned()) {
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
    const organizationId = collection.organizationId;
    const collectionId = collection.id;
    const outcome = await this.collectionDialog?.open({ organizationId, collectionId, initialTab });
    if (outcome != null) {
      this.actionResult.emit({
        deleted: outcome === CollectionDialogOutcome.Deleted,
        organizationId,
        collectionId,
      });
    }
  }

  protected async delete(): Promise<void> {
    const organization = this.organization();
    const collection = this.collection();
    if (organization == null) {
      return;
    }
    const result = await this.bulkDeleteDialog?.open({ organization, collections: [collection] });
    if (result != null) {
      this.actionResult.emit({
        deleted: result === BulkDeleteDialogResult.Deleted,
        organizationId: organization.id,
        collectionId: collection.id,
      });
    }
  }
}
