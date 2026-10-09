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

/**
 * What `editCollection()`/`delete()` did, plus which folder it did it to — a caller that reacts by
 * navigating needs the id the action actually targeted, not whatever it's currently showing: the
 * two can disagree if the viewer moved on before the dialog closed.
 */
export type CollectionActionResult = {
  deleted: boolean;
  organizationId: OrganizationId;
  collectionId: CollectionId;
};

/**
 * The Pin/Unpin, Edit info / Edit access / Delete menu for one shared folder, shared by every
 * place a client offers those actions on a single collection — the vault's breadcrumb header and
 * the shared folders table's per-row menu today.
 *
 * Edit info, Edit access, and Delete each go through a token the client supplies — see
 * {@link COLLECTION_DIALOG} and {@link BULK_DELETE_DIALOG}. Pin/Unpin needs no token — see
 * {@link showPin} — it's plain device-local state any client can offer. A client that provides
 * neither dialog and doesn't opt into `showPin` renders nothing at all: there is no half-working
 * menu to hide.
 *
 * Renders an empty host element even then, though: a caller relying on CSS to collapse an empty
 * wrapper around it (e.g. a table cell's `empty:tw-hidden`) needs its own `@if` around this
 * component, not just around the menu items inside it — see `showMenu` and
 * `SharedFoldersComponent.showRowMenu`.
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

  /** The trigger button's icon — callers differ: a header's current-item control reads
   * differently from a table row's generic one. */
  readonly triggerIcon = input.required<string>();

  /**
   * Distinguishes this menu's ids from another instance's on the same page — e.g. `vault-next` or
   * `shared-folders` — since every id must be unique across tables of similar menus.
   */
  readonly idPrefix = input.required<string>();

  /** Whether the menu offers Pin/Unpin. Off by default, since it's an opt-in capability not every
   * consumer wants. */
  readonly showPin = input<boolean>(false);

  /**
   * Whether Delete may appear here at all, independent of `BULK_DELETE_DIALOG`'s presence. On by
   * default. Desktop's header menu sets this `false`: it already provides that token for the
   * existing bulk-select batch bar, which has nothing to do with this single-folder menu — without
   * this override, Delete would appear there too, which isn't the intended "Pin only" behavior for
   * that specific usage.
   */
  readonly showDelete = input<boolean>(true);

  /** What `editCollection()` or `delete()` did — a single output since every caller today reacts
   * to both the same way, and it's whichever folder {@link collection} names, not which action
   * fired, that a caller needs to decide anything. */
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

  /** `canEdit`/`canDelete` already exclude the organization's default collection; Pin needs the
   * same exclusion applied explicitly, since it isn't gated by a permission check. */
  protected readonly showPinAction = computed(
    () => this.showPin() && !this.collection().isDefaultCollection,
  );

  protected readonly showMenu = computed(
    () => this.showEditActions() || this.showDeleteAction() || this.showPinAction(),
  );

  /** Whether the viewed folder is pinned, for the Pin/Unpin item's label and icon. */
  protected readonly isPinned = computed(() => this.pinnedIds().includes(this.collection().id));

  /**
   * Pins the folder to the side nav, or takes it off if it is already there, then confirms with a
   * toast. The toast waits for the state update, so it never reports a change that didn't land.
   */
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
