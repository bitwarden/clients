import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { IconButtonModule, IconModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { foldersListCommands } from "../../models/vault-scope";
import { MyFolderActionsService } from "../../services/my-folder-actions.service";
import { resolveMyFolderTrail } from "../../utils/my-folder-trail";

/**
 * The menu of what a user can do to the folder in view — the same edit and delete the My folders
 * table offers in each row, opened from the folder's own page.
 *
 * Project it into the header's `title-suffix` slot, which sits right after the breadcrumb trail's
 * current folder:
 *
 * ```html
 * <app-header><vault-my-folder-menu slot="title-suffix" [folderId]="id" /></app-header>
 * ```
 *
 * Renders nothing for a folder the user does not hold.
 */
@Component({
  selector: "vault-my-folder-menu",
  templateUrl: "./my-folder-menu.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonModule, IconModule, MenuModule, I18nPipe],
})
export class MyFolderMenuComponent {
  private readonly accountService = inject(AccountService);
  private readonly folderActions = inject(MyFolderActionsService);
  private readonly folderService = inject(FolderService);
  private readonly router = inject(Router);

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

  /** Present only for a folder the user holds, which is when there is a folder to act on. */
  private readonly trail = computed(() => resolveMyFolderTrail(this.folders(), this.folderId()));

  protected readonly folderName = computed(() => this.trail()?.current);

  protected async edit(): Promise<void> {
    await this.folderActions.edit(this.folderId());
  }

  protected async delete(): Promise<void> {
    const displayName = this.folderName();
    if (displayName == null) {
      return;
    }

    const deleted = await this.folderActions.delete({ id: this.folderId(), displayName });

    // The folder's page has nothing left to show once the folder is gone.
    if (deleted) {
      await this.router.navigate(foldersListCommands());
    }
  }
}
