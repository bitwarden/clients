import { ChangeDetectionStrategy, Component } from "@angular/core";

import {
  SharedFoldersBreadcrumbsComponent,
  SharedFoldersComponent as VaultSharedFoldersComponent,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header";

/**
 * The desktop client's shared folders page: the shared {@link VaultSharedFoldersComponent} with the
 * desktop header projected into it.
 *
 * Read-only for now. Every Add, row, and bulk action opens a collection dialog desktop doesn't
 * have, so no dialog token is provided and the page lists the folders without offering an action it
 * can't carry out.
 */
@Component({
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Desktop pages own their page padding; matches the vault page's spacing.
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0 tw-px-8 tw-py-6",
  },
  imports: [DesktopHeaderComponent, SharedFoldersBreadcrumbsComponent, VaultSharedFoldersComponent],
})
export class SharedFoldersComponent {}
