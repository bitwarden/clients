import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { IconButtonModule, IconModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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

/** What `editCollection()`/`delete()` did, and which folder it targeted — not necessarily the
 * folder currently showing, if the viewer navigated away before the dialog closed. */
export type CollectionActionResult = {
  /** True for an explicit Delete, or for Access dropping the member's own assignment. */
  deleted: boolean;
  organizationId: OrganizationId;
  collectionId: CollectionId;
};

/**
 * Edit info / Edit access / Delete menu for one shared folder. Used by the vault's breadcrumb
 * header and the shared folders table's per-row menu.
 *
 * Each action needs a token the client supplies — {@link COLLECTION_DIALOG},
 * {@link BULK_DELETE_DIALOG} — so a client that provides neither renders nothing. The host element
 * still exists even then, so a caller relying on CSS to collapse an empty wrapper (e.g. a table
 * cell's `empty:tw-hidden`) needs its own `@if` around this component.
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

  readonly collection = input.required<CollectionView>();

  /** `undefined` while the organization list is still loading. */
  readonly organization = input<Organization | undefined>(undefined);

  readonly triggerIcon = input.required<string>();

  /** Prefix for this instance's element ids, so multiple menus on one page don't collide. */
  readonly idPrefix = input.required<string>();

  readonly actionResult = output<CollectionActionResult>();

  /** Exposed so the template can name a tab by member rather than a bare string. */
  protected readonly CollectionDialogTab = CollectionDialogTab;

  protected readonly showEditActions = computed(
    () => this.collectionDialog != null && this.collection().canEdit(this.organization()),
  );

  protected readonly showDeleteAction = computed(
    () => this.bulkDeleteDialog != null && this.collection().canDelete(this.organization()),
  );

  protected readonly showMenu = computed(() => this.showEditActions() || this.showDeleteAction());

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
