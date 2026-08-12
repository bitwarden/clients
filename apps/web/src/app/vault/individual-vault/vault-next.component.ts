import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ButtonModule } from "@bitwarden/components";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";
import {
  DefaultCipherFormConfigService,
  VaultItemEvent,
  VaultItemsTableComponent,
  VaultItemsTableRowAction,
  VaultOrganizationUserNotificationsComponent,
  Vfo1TerminologyService,
} from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";
import { WebVaultItemActionsService } from "../services/vault-item-actions.service";

/**
 * The table's name column and the `edit` row action both need to open the item dialog, but in
 * different modes, so the shared {@link VaultItemEvent} union is widened with a view event rather
 * than overloading `editCipher` for both.
 */
type WebVaultItemEvent =
  VaultItemEvent<CipherViewLike> | { type: "viewCipher"; item: CipherViewLike };

/**
 * The web individual vault built on the shared {@link VaultItemsTableComponent}, which owns its own
 * search, filter chips, and sorting — so this page has no filter sidebar.
 *
 * Route-swapped in for {@link apps/web/src/app/vault/individual-vault/vault.component.ts} behind
 * `FeatureFlag.VFO1Foundation`; see `vault-routing.module.ts`.
 *
 * Not yet wired (arriving with the filter work in
 * {@link https://bitwarden.atlassian.net/browse/PM-40318}): the typed filter adapter that syncs the
 * table's chips to the URL, the redirect that rewrites legacy filter query params, and the
 * `?itemId=&action=` deep link that opens an item on load. Until the chips are wired there is no
 * route to trash or the archive from this page, so both are excluded from the list.
 */
@Component({
  selector: "app-vault-next",
  templateUrl: "./vault-next.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    HeaderModule,
    I18nPipe,
    VaultItemsTableComponent,
    VaultOrganizationUserNotificationsComponent,
  ],
  providers: [
    safeProvider({ provide: DefaultCipherFormConfigService, useAngularDecorators: true }),
    safeProvider({ provide: WebVaultItemActionsService, useAngularDecorators: true }),
  ],
})
export class VaultNextComponent {
  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly cipherService = inject(CipherService);
  private readonly collectionService = inject(CollectionService);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly itemActions = inject(WebVaultItemActionsService);
  private readonly organizationService = inject(OrganizationService);
  private readonly policyService = inject(PolicyService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly ciphers$ = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        // Emits null until the first decrypt completes.
        this.cipherService.cipherListViews$(userId).pipe(filterOutNullish()),
        this.restrictedItemTypesService.restricted$,
      ]),
    ),
    map(([ciphers, restricted]) =>
      ciphers.filter(
        (cipher) =>
          !CipherViewLikeUtils.isDeleted(cipher) &&
          !CipherViewLikeUtils.isArchived(cipher) &&
          !this.restrictedItemTypesService.isCipherRestricted(cipher, restricted),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** `undefined` until the ciphers stream first emits, which is what drives {@link loading}. */
  private readonly loadedCiphers = toSignal(this.ciphers$);

  protected readonly ciphers = computed<CipherViewLike[]>(() => this.loadedCiphers() ?? []);
  protected readonly loading = computed(() => this.loadedCiphers() === undefined);

  protected readonly folders = toSignal(
    this.userId$.pipe(
      switchMap((userId) => this.folderService.folderViews$(userId)),
      // `folderViews$` appends a "no folder" pseudo-folder with an empty id. The table has its own
      // NO_FOLDER sentinel for that option, so passing it through would duplicate it and defeat the
      // table's own "user has no folders" check.
      map((folders) => folders.filter((folder) => folder.id != null && folder.id !== "")),
    ),
    { initialValue: [] },
  );

  protected readonly collections = toSignal(
    this.userId$.pipe(switchMap((userId) => this.collectionService.decryptedCollections$(userId))),
    { initialValue: [] },
  );

  protected readonly organizations = toSignal(
    this.userId$.pipe(switchMap((userId) => this.organizationService.organizations$(userId))),
    { initialValue: [] },
  );

  private readonly userCanArchive = toSignal(
    this.userId$.pipe(switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId))),
    { initialValue: false },
  );

  private readonly canAccessPremium = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
      ),
    ),
    { initialValue: false },
  );

  private readonly enforceOrgDataOwnershipPolicy = toSignal(
    this.userId$.pipe(
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
      ),
    ),
    { initialValue: false },
  );

  /**
   * The per-row menu, mirroring the legacy vault's cipher row (`vault-cipher-row.component.html`).
   *
   * Copy and Launch are absent by design — the table's actions column provides them itself. Event
   * logs are absent because the individual vault does not offer them (the legacy page binds
   * `[useEvents]="false"`).
   *
   * `unarchive`, `restore`, and the permanent-delete label are unreachable while archived and
   * deleted items are excluded from the list, but their predicates are written honestly so they
   * start working the moment the filter chips land.
   */
  protected readonly rowActions = computed<
    VaultItemsTableRowAction<CipherViewLike, WebVaultItemEvent>[]
  >(() => {
    const userCanArchive = this.userCanArchive();
    const enforceOrgDataOwnership = this.enforceOrgDataOwnershipPolicy();
    const hasOrganizations = this.organizations().length > 0;

    // An archived item's actions are read-only for a user who has lost archive access.
    const archivedWithoutAccess = (item: CipherViewLike) =>
      CipherViewLikeUtils.isArchived(item) && !userCanArchive;

    return [
      // `label` is fixed per action, so favoriting and unfavoriting are two entries discriminated by
      // the item's current state rather than one entry with a conditional label.
      {
        id: "favorite",
        label: this.i18nService.t("favorite"),
        icon: "bwi-star",
        event: (item) => ({ type: "toggleFavorite", item }),
        show: (item) =>
          !item.favorite && !archivedWithoutAccess(item) && !CipherViewLikeUtils.isDeleted(item),
      },
      {
        id: "unfavorite",
        label: this.i18nService.t("unfavorite"),
        icon: "bwi-star-f",
        event: (item) => ({ type: "toggleFavorite", item }),
        show: (item) =>
          item.favorite && !archivedWithoutAccess(item) && !CipherViewLikeUtils.isDeleted(item),
      },
      {
        id: "edit",
        label: this.i18nService.t("edit"),
        icon: "bwi-pencil-square",
        event: (item) => ({ type: "editCipher", item }),
        show: (item) => !CipherViewLikeUtils.isDeleted(item) && item.edit,
      },
      {
        id: "attachments",
        label: this.i18nService.t("attachments"),
        icon: "bwi-paperclip",
        event: (item) => ({ type: "viewAttachments", item }),
        show: (item) =>
          !archivedWithoutAccess(item) &&
          !CipherViewLikeUtils.isDeleted(item) &&
          (item.edit || CipherViewLikeUtils.hasAttachments(item)),
      },
      {
        id: "clone",
        label: this.i18nService.t("clone"),
        icon: "bwi-clone",
        event: (item) => ({ type: "clone", item }),
        show: (item) => {
          if (
            CipherViewLikeUtils.isArchived(item) &&
            (!userCanArchive || enforceOrgDataOwnership)
          ) {
            return false;
          }
          return item.edit && !CipherViewLikeUtils.isDeleted(item);
        },
      },
      {
        id: "assignToCollections",
        label: this.i18nService.t(
          this.vfo1TerminologyService.enabled() ? "addToSharedFolder" : "assignToCollections",
        ),
        icon: this.vfo1TerminologyService.iconClass("bwi-collection-shared"),
        event: (item) => ({ type: "assignToCollections", items: [item] }),
        show: (item) => hasOrganizations && item.edit && !CipherViewLikeUtils.isDeleted(item),
      },
      {
        id: "archive",
        label: this.i18nService.t("archiveVerb"),
        icon: "bwi-archive",
        event: (item) => ({ type: "archive", items: [item] }),
        show: (item) =>
          !CipherViewLikeUtils.isArchived(item) && !CipherViewLikeUtils.isDeleted(item),
        premiumGated: () => !userCanArchive,
      },
      {
        id: "unarchive",
        label: this.i18nService.t("unArchive"),
        icon: "bwi-unarchive",
        event: (item) => ({ type: "unarchive", items: [item] }),
        show: (item) =>
          CipherViewLikeUtils.isArchived(item) && !CipherViewLikeUtils.isDeleted(item),
      },
      {
        id: "restore",
        label: this.i18nService.t("restore"),
        icon: "bwi-refresh",
        event: (item) => ({ type: "restore", items: [item] }),
        show: (item) => CipherViewLikeUtils.isDeleted(item) && item.edit,
      },
      {
        id: "delete",
        label: this.i18nService.t("delete"),
        icon: "bwi-trash",
        event: (item) => ({ type: "delete", items: [{ cipher: item }] }),
        show: (item) => item.edit,
        variant: "danger",
      },
    ];
  });

  /**
   * Clicking an item's name opens the read-only view, matching the legacy vault — the dialog offers
   * its own Edit toggle from there, while the `edit` row action goes straight to the form.
   *
   * Bound as an input, so it must be a stable reference rather than a method: a new function on each
   * change detection pass would churn the table's name column.
   */
  protected readonly itemAction = (item: CipherViewLike): WebVaultItemEvent => ({
    type: "viewCipher",
    item,
  });

  protected async onAction(event: WebVaultItemEvent): Promise<void> {
    switch (event.type) {
      case "viewCipher":
        await this.itemActions.view(event.item);
        break;
      case "editCipher":
        await this.itemActions.edit(event.item);
        break;
      case "viewAttachments":
        await this.itemActions.viewAttachments(
          event.item,
          this.canAccessPremium(),
          this.organizations(),
        );
        break;
      case "clone":
        await this.itemActions.clone(event.item);
        break;
      case "toggleFavorite":
        await this.itemActions.toggleFavorite(event.item);
        break;
      case "assignToCollections":
        await this.itemActions.assignToCollections(event.items[0], this.collections());
        break;
      case "archive":
        await this.itemActions.archive(event.items[0]);
        break;
      case "unarchive":
        await this.itemActions.unarchive(event.items[0]);
        break;
      case "restore":
        await this.itemActions.restore(event.items[0]);
        break;
      case "delete": {
        // `VaultItem` also models collection rows, which this cipher-only table never emits.
        const cipher = event.items[0]?.cipher;
        if (cipher != null) {
          await this.itemActions.delete(cipher);
        }
        break;
      }
    }
  }

  protected async addItem(): Promise<void> {
    await this.itemActions.add();
  }
}
