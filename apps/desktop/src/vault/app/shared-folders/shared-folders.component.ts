import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  parseVaultScope,
  SharedFolderCollectionRow,
  sharedFolderRows,
  SharedFoldersTableComponent,
  VaultScopeType,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header";

/**
 * The shared folders of one organization vault, listed in the shared
 * {@link SharedFoldersTableComponent} — the desktop counterpart of the web page of the same name,
 * reached from the same side nav entry.
 *
 * Read-only for now: the table's Add button, row actions, and bulk actions are all client-supplied,
 * and each of them opens a collection dialog desktop does not have. Listing the folders is what the
 * nav entry promises, so the page delivers that and offers no action it cannot carry out.
 *
 * Reached at `/vault/:vaultId/shared-folders`, guarded to organization vaults by
 * `organizationVaultGuard` — see the route in `AppRoutingModule`, which must stay declared above
 * `:vaultId/:collectionId`.
 */
@Component({
  templateUrl: "./shared-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Desktop pages own their page padding; matches the vault page's spacing.
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0 tw-px-8 tw-py-6",
  },
  imports: [DesktopHeaderComponent, SharedFoldersTableComponent],
})
export class SharedFoldersComponent {
  private readonly accountService = inject(AccountService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly organizationService = inject(OrganizationService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly routeParams = toSignal(this.activatedRoute.paramMap);

  /**
   * The organization whose folders this page lists. `organizationVaultGuard` has already turned
   * away any segment that names something other than an organization vault, so `undefined` here
   * means the guard was bypassed — the page then lists nothing rather than falling back to a vault
   * the URL did not ask for.
   */
  private readonly organizationId = computed<OrganizationId | undefined>(() => {
    const scope = parseVaultScope(this.routeParams()?.get("vaultId"));
    return scope?.type === VaultScopeType.Organization ? scope.organizationId : undefined;
  });

  /** `undefined` until each stream first emits, which is what drives {@link loading}. */
  private readonly loaded = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        combineLatest([
          this.collectionService.decryptedCollections$(userId),
          // Emits null until the first decrypt completes.
          this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
          this.organizationService.organizations$(userId),
        ]),
      ),
      map(([collections, ciphers, organizations]) => ({ collections, ciphers, organizations })),
    ),
  );

  protected readonly loading = computed(() => this.loaded() === undefined);

  private readonly organization = computed<Organization | undefined>(() =>
    this.loaded()?.organizations.find((organization) => organization.id === this.organizationId()),
  );

  /**
   * The organization's name as the page heading, leaving the route's own `pageTitle` in place while
   * the organization list loads — matching the web page, whose breadcrumbs will replace both.
   */
  protected readonly title = computed(() => this.organization()?.name);

  /**
   * The organization's shared folders, with each folder's permission and item count resolved by
   * the library's own row builder — see {@link sharedFolderRows}, which the web page lists from
   * too, so the two clients cannot disagree on what a member may do with a folder.
   */
  protected readonly sharedFolders = computed<SharedFolderCollectionRow[]>(() => {
    const organizationId = this.organizationId();
    const data = this.loaded();
    if (organizationId == null || data == null) {
      return [];
    }

    return sharedFolderRows({
      organizationId,
      organization: this.organization(),
      collections: data.collections,
      ciphers: data.ciphers,
    });
  });
}
