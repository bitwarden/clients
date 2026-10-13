import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { BreadcrumbsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { folderCommands, foldersListCommands } from "../../models/vault-scope";
import { resolveMyFolderTrail } from "../../utils/my-folder-trail";

/**
 * The breadcrumb trail for one of the user's folders: the My folders list, the folders containing
 * this one, and this one, which stands in for the page heading.
 *
 * Renders nothing for a folder the user does not hold, leaving the header to title the page.
 */
@Component({
  selector: "vault-my-folder-breadcrumbs",
  templateUrl: "./my-folder-breadcrumbs.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BreadcrumbsModule, I18nPipe],
  host: {
    // `bit-breadcrumbs` sizes itself to its container, so this wrapper has to be one.
    class: "tw-flex tw-w-full tw-min-w-0",
  },
})
export class MyFolderBreadcrumbsComponent {
  private readonly accountService = inject(AccountService);
  private readonly folderService = inject(FolderService);

  /** The id of the folder in view. */
  readonly folderId = input.required<string>();

  private readonly folders = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.folderService.folderViews$(userId)),
      // The "No folder" entry has no id and is not a folder the user can be in.
      map((folders) => folders.filter((folder) => folder.id != null && folder.id !== "")),
    ),
    { initialValue: [] as FolderView[] },
  );

  protected readonly trail = computed(() => resolveMyFolderTrail(this.folders(), this.folderId()));

  protected readonly foldersListCommands = foldersListCommands;
  protected readonly folderCommands = folderCommands;
}
