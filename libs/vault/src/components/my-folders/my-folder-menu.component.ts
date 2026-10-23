import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { Router } from "@angular/router";

import { IconButtonModule, IconModule, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { foldersListCommands } from "../../models/vault-scope";
import { MyFolderActionsService } from "../../services/my-folder-actions.service";

import { injectMyFolderTrail } from "./inject-my-folder-trail";

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
  private readonly folderActions = inject(MyFolderActionsService);
  private readonly router = inject(Router);

  readonly folderId = input.required<string>();

  private readonly trail = injectMyFolderTrail(this.folderId);

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

    if (deleted) {
      await this.router.navigate(foldersListCommands());
    }
  }
}
