import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { BreadcrumbsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { folderCommands, foldersListCommands } from "../../models/vault-scope";

import { injectMyFolderTrail } from "./inject-my-folder-trail";

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
  readonly folderId = input.required<string>();

  protected readonly trail = injectMyFolderTrail(this.folderId);

  protected readonly foldersListCommands = foldersListCommands;
  protected readonly folderCommands = folderCommands;
}
