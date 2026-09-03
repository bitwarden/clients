import { ChangeDetectionStrategy, Component, computed } from "@angular/core";

import {
  injectVaultOrganization,
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
  imports: [DesktopHeaderComponent, VaultSharedFoldersComponent],
})
export class SharedFoldersComponent {
  private readonly organization = injectVaultOrganization();

  /**
   * The organization's name as the page heading. `undefined` leaves the route's own `pageTitle` in
   * place while the organization list loads. Breadcrumbs will replace both.
   */
  protected readonly title = computed(() => this.organization()?.name);
}
