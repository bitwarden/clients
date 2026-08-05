import { ChangeDetectionStrategy, Component, computed, inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest } from "rxjs";
import { filter, map, switchMap } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  VaultItemEvent,
  VaultItemsTableComponent,
  VaultItemsTableRowAction,
} from "@bitwarden/vault";

import { VaultBannersComponent } from "./vault-banners/vault-banners.component";
import { VaultComponent } from "./vault.component";

/**
 * The vault page behind the `vfo1-foundation` flag: the same individual vault, rendered on the
 * shared {@link VaultItemsTableComponent} instead of `app-vault-items` + `app-vault-filter`.
 *
 * It extends {@link VaultComponent} rather than reimplementing it. Every action a row can take —
 * edit, clone, attachments, archive, delete, collection assignment — routes through dialogs and
 * reprompt checks that already live on the base class, so this subclass supplies only what the new
 * table needs: the row-action set, and the folders/collections/organizations its columns and
 * filter chips resolve names from. Behavior stays in one place, and the two pages can't drift.
 *
 * The table owns search, filtering, and sorting internally, so this page renders no
 * `app-vault-filter` sidebar — the reason the flag swaps the whole page rather than just the list.
 */
@Component({
  selector: "app-vault-next",
  templateUrl: "vault-next.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, VaultBannersComponent, VaultItemsTableComponent],
})
export class VaultNextComponent<C extends CipherViewLike> extends VaultComponent<C> {
  private readonly i18nStrings = inject(I18nService);
  private readonly accountsStore = inject(AccountService);
  private readonly cipherStore = inject(CipherService);
  private readonly folderStore = inject(FolderService);
  private readonly collectionStore = inject(CollectionService);
  private readonly archiveStore = inject(CipherArchiveService);
  private readonly restrictedTypes = inject(RestrictedItemTypesService);

  private readonly activeUserId$ = this.accountsStore.activeAccount$.pipe(getUserId);

  /**
   * The rows.
   *
   * Built here rather than read off the base class's `ciphers` field: that field is assigned from
   * a subscription inside the base `ngOnInit`, so it is neither a signal nor an observable and
   * can't drive an OnPush template. This is the same stream the base class composes — the user's
   * ciphers minus the types policy restricts — without the routed-filter and search stages, which
   * the table now owns.
   *
   * The cast mirrors the base class's own: `cipherListViews$` is typed
   * `CipherListView[] | CipherView[]`, and which of the two arrives is a runtime concern the `C`
   * parameter can't express.
   */
  protected readonly rows: Signal<C[]> = toSignal(
    combineLatest([
      this.activeUserId$.pipe(
        switchMap((userId) => this.cipherStore.cipherListViews$(userId)),
        filter((ciphers) => ciphers != null),
      ),
      this.restrictedTypes.restricted$,
    ]).pipe(
      map(
        ([ciphers, restricted]) =>
          ciphers.filter(
            (cipher) => !this.restrictedTypes.isCipherRestricted(cipher, restricted),
          ) as C[],
      ),
    ),
    { initialValue: [] as C[] },
  );

  protected readonly folders = toSignal(
    this.activeUserId$.pipe(switchMap((userId) => this.folderStore.folderViews$(userId))),
    { initialValue: [] },
  );

  protected readonly collectionOptions = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.collectionStore.decryptedCollections$(userId)),
    ),
    { initialValue: [] },
  );

  protected readonly organizationOptions = toSignal(this.organizations$, { initialValue: [] });

  private readonly userCanArchive = toSignal(
    this.activeUserId$.pipe(switchMap((userId) => this.archiveStore.userCanArchive$(userId))),
    { initialValue: false },
  );

  /**
   * The overflow-menu actions, as event factories the table invokes on selection — it builds no
   * domain events itself. Each resulting event goes back through
   * {@link VaultComponent.onVaultItemsEvent}, the same dispatcher the current page uses.
   */
  protected readonly rowActions = computed<VaultItemsTableRowAction<C, VaultItemEvent<C>>[]>(() => {
    const actions: VaultItemsTableRowAction<C, VaultItemEvent<C>>[] = [
      {
        id: "favorite",
        label: this.i18nStrings.t("favorite"),
        icon: "bwi-star",
        show: (item) => !item.favorite,
        event: (item) => ({ type: "toggleFavorite", item }),
      },
      {
        id: "unfavorite",
        label: this.i18nStrings.t("unfavorite"),
        icon: "bwi-star",
        show: (item) => item.favorite,
        event: (item) => ({ type: "toggleFavorite", item }),
      },
      {
        id: "edit",
        label: this.i18nStrings.t("edit"),
        icon: "bwi-pencil-square",
        event: (item) => ({ type: "editCipher", item }),
      },
      {
        id: "attachments",
        label: this.i18nStrings.t("attachments"),
        icon: "bwi-paperclip",
        event: (item) => ({ type: "viewAttachments", item }),
      },
      {
        id: "clone",
        label: this.i18nStrings.t("clone"),
        icon: "bwi-files",
        event: (item) => ({ type: "clone", item }),
      },
      {
        id: "assignToCollections",
        label: this.i18nStrings.t("assignToCollections"),
        icon: "bwi-collection-shared",
        event: (item) => ({ type: "assignToCollections", items: [item] }),
      },
    ];

    if (this.userCanArchive()) {
      actions.push({
        id: "archive",
        label: this.i18nStrings.t("archiveVerb"),
        icon: "bwi-archive",
        event: (item) => ({ type: "archive", items: [item] }),
      });
    }

    actions.push({
      id: "delete",
      label: this.i18nStrings.t("delete"),
      icon: "bwi-trash",
      variant: "danger",
      event: (item) => ({ type: "delete", items: [{ cipher: item }] }),
    });

    return actions;
  });

  /** Opens a row's item dialog when its name is activated. */
  protected readonly itemAction = (item: C): VaultItemEvent<C> => ({ type: "editCipher", item });
}
