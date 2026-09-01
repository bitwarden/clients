import { Injectable, inject } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import {
  CollectionData,
  CollectionDetailsResponse,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";
import {
  CollectionDialogOpenParams,
  CollectionDialogOutcome,
  CollectionDialogRef,
  CollectionDialogTab,
} from "@bitwarden/vault";

import { openCollectionDialog } from "./collection-dialog.component";
import { CollectionDialogAction, CollectionDialogTabType } from "./collection-dialog.models";

/** The dialog's own tab enum, keyed by the token's client-independent one. */
const TABS: Readonly<Record<CollectionDialogTab, CollectionDialogTabType>> = Object.freeze({
  [CollectionDialogTab.Info]: CollectionDialogTabType.Info,
  [CollectionDialogTab.Access]: CollectionDialogTabType.Access,
});

@Injectable()
export class CollectionWebDialogAdapter implements CollectionDialogRef {
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly dialogService = inject(DialogService);

  async open(params: CollectionDialogOpenParams): Promise<CollectionDialogOutcome> {
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: params.organizationId,
        collectionId: params.collectionId,
        initialTab: params.initialTab == null ? undefined : TABS[params.initialTab],
        limitNestedCollections: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);

    if (result?.action === CollectionDialogAction.Saved && result.collection != null) {
      await this.upsert(result.collection);
      return CollectionDialogOutcome.Saved;
    }

    if (result?.action === CollectionDialogAction.Deleted && result.collection != null) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.collectionService.delete([result.collection.id as CollectionView["id"]], userId);
      return CollectionDialogOutcome.Deleted;
    }

    return CollectionDialogOutcome.Canceled;
  }

  /** Writes a saved collection back to `CollectionService`, so any stream over it re-emits. */
  private async upsert(collection: unknown): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.collectionService.upsert(
      new CollectionData(collection as CollectionDetailsResponse),
      userId,
    );
  }
}
