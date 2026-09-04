import { ChangeDetectionStrategy, Component } from "@angular/core";

import { safeProvider } from "@bitwarden/ui-common";
import {
  BULK_DELETE_DIALOG,
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  COLLECTION_DIALOG,
  SharedFoldersBreadcrumbsComponent,
  SharedFoldersComponent as VaultSharedFoldersComponent,
} from "@bitwarden/vault";

import { BulkEditCollectionAccessWebDialogAdapter } from "../../../admin-console/organizations/collections/bulk-collections-dialog/bulk-edit-collection-access-web-dialog.adapter";
import { HeaderModule } from "../../../layouts/header/header.module";
import { BulkDeleteDialogWebAdapter } from "../bulk-action-dialogs/bulk-delete-dialog-web.adapter";

import { CollectionWebDialogAdapter } from "./collection-web-dialog.adapter";

/**
 * The web client's shared folders page: the shared {@link VaultSharedFoldersComponent} with the
 * web header projected into it, and the dialogs its actions open.
 */
@Component({
  selector: "app-shared-folders",
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [HeaderModule, SharedFoldersBreadcrumbsComponent, VaultSharedFoldersComponent],
  providers: [
    safeProvider({
      provide: COLLECTION_DIALOG,
      useClass: CollectionWebDialogAdapter,
      useAngularDecorators: true,
    }),
    safeProvider({
      provide: BULK_DELETE_DIALOG,
      useClass: BulkDeleteDialogWebAdapter,
      useAngularDecorators: true,
    }),
    safeProvider({
      provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG,
      useClass: BulkEditCollectionAccessWebDialogAdapter,
      useAngularDecorators: true,
    }),
  ],
})
export class SharedFoldersComponent {}
