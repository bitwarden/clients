import { inject, Injectable } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, shareReplay, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

import { VaultItemsTableRowAction } from "../components/vault-items-table/vault-items-table-row-action";

import { CipherActionService } from "./cipher-action.service";

export type CipherRowMenuHandlers<C extends CipherViewLike> = {
  edit: (item: C) => void | Promise<void>;
  clone: (item: C) => void | Promise<void>;
  assignToCollections: (item: C) => void | Promise<void>;
};

/** Centralises row overflow menu action definitions for vault cipher rows across clients. */
@Injectable({ providedIn: "root" })
export class CipherRowMenuService {
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly organizationService = inject(OrganizationService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly cipherActionService = inject(CipherActionService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filterOutNullish(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Whether the active user has premium and can archive ciphers. */
  readonly userCanArchive = toSignal(
    this.userId$.pipe(switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId))),
    { initialValue: false },
  );

  private readonly restrictedTypes = toSignal(this.restrictedItemTypesService.restricted$, {
    initialValue: [] as RestrictedCipherType[],
  });

  /**
   * The organizations the active user belongs to — whether they have anywhere to move a personal
   * item to. See {@link showAssignToCollections}.
   */
  private readonly organizations = toSignal(
    this.userId$.pipe(switchMap((userId) => this.organizationService.organizations$(userId))),
    { initialValue: [] as Organization[] },
  );

  /** Returns the full row action definitions for the cipher overflow menu. */
  getRowActions<C extends CipherViewLike>(
    collections: CollectionView[] = [],
    handlers: CipherRowMenuHandlers<C>,
  ): VaultItemsTableRowAction<C>[] {
    return [
      {
        id: "addFavorite",
        label: this.i18nService.t("favorite"),
        icon: "bwi-star",
        run: (item) => void this.cipherActionService.toggleFavorite(item),
        show: (item) => !item.favorite && this.showFavorite(item),
      },
      {
        id: "removeFavorite",
        label: this.i18nService.t("unfavorite"),
        icon: "bwi-star-f",
        run: (item) => void this.cipherActionService.toggleFavorite(item),
        show: (item) => !!item.favorite && this.showFavorite(item),
      },
      {
        id: "edit",
        label: this.i18nService.t("edit"),
        icon: "bwi-pencil-square",
        run: (item) => void handlers.edit(item),
        show: (item) => this.showEdit(item),
      },
      {
        id: "attachments",
        label: this.i18nService.t("attachments"),
        icon: "bwi-paperclip",
        run: (item) => void this.cipherActionService.viewAttachments(item),
        show: (item) => this.showAttachments(item),
      },
      {
        id: "clone",
        label: this.i18nService.t("clone"),
        icon: "bwi-copy",
        run: (item) => void handlers.clone(item),
        show: (item) => this.showClone(item, collections),
      },
      {
        id: "addToSharedFolder",
        label: this.i18nService.t("addToSharedFolder"),
        icon: "bwi-shared-folder",
        run: (item) => void handlers.assignToCollections(item),
        show: (item) => this.showAssignToCollections(item, collections),
      },
      {
        id: "archive",
        label: this.i18nService.t("archiveVerb"),
        icon: "bwi-archive",
        run: (item) => void this.cipherActionService.archive(item),
        premiumGated: () => !this.userCanArchive(),
        show: (item) => this.showArchive(item),
      },
      {
        id: "unarchive",
        label: this.i18nService.t("unArchive"),
        icon: "bwi-undo",
        run: (item) => void this.cipherActionService.unarchive(item),
        show: (item) => this.showUnarchive(item),
      },
      {
        id: "restore",
        label: this.i18nService.t("restore"),
        icon: "bwi-undo",
        run: (item) => void this.cipherActionService.restore(item),
        show: (item) => this.showRestore(item),
      },
      {
        id: "delete",
        label: this.i18nService.t("delete"),
        icon: "bwi-trash",
        run: (item) => void this.cipherActionService.delete(item),
        show: (item) => this.canDelete(item) && !CipherViewLikeUtils.isDeleted(item),
        variant: "danger",
      },
      {
        id: "permanentlyDelete",
        label: this.i18nService.t("permanentlyDelete"),
        icon: "bwi-trash",
        run: (item) => void this.cipherActionService.delete(item),
        show: (item) => this.canDelete(item) && CipherViewLikeUtils.isDeleted(item),
        variant: "danger",
      },
    ];
  }

  private showFavorite(cipher: CipherViewLike): boolean {
    if (
      (CipherViewLikeUtils.isArchived(cipher) && !this.userCanArchive()) ||
      CipherViewLikeUtils.isDeleted(cipher)
    ) {
      return false;
    }
    return true;
  }

  private showEdit(cipher: CipherViewLike): boolean {
    return !CipherViewLikeUtils.isDeleted(cipher) && cipher.edit;
  }

  private showAttachments(cipher: CipherViewLike): boolean {
    if (
      (CipherViewLikeUtils.isArchived(cipher) && !this.userCanArchive()) ||
      CipherViewLikeUtils.isDeleted(cipher)
    ) {
      return false;
    }
    return cipher.edit || CipherViewLikeUtils.hasAttachments(cipher);
  }

  private showClone(cipher: CipherViewLike, collections: CollectionView[]): boolean {
    if (CipherViewLikeUtils.isArchived(cipher) && !this.userCanArchive()) {
      return false;
    }
    return this.canClone(cipher, collections) && !CipherViewLikeUtils.isDeleted(cipher);
  }

  /**
   * Assignment covers personal items as well as organization ones — moving a personal item into an
   * organization is what the dialog is for — so the gate is whether the user has somewhere to put
   * it: an organization to move it into, and a collection they can write to.
   */
  private showAssignToCollections(cipher: CipherViewLike, collections: CollectionView[]): boolean {
    if (
      CipherViewLikeUtils.isDeleted(cipher) ||
      !CipherViewLikeUtils.canAssignToCollections(cipher)
    ) {
      return false;
    }

    const assignable = cipher.organizationId
      ? collections.filter((c) => c.organizationId === cipher.organizationId && !c.readOnly)
      : collections.filter((c) => !c.readOnly);

    return this.organizations().length > 0 && assignable.length > 0;
  }

  private showArchive(cipher: CipherViewLike): boolean {
    return !CipherViewLikeUtils.isArchived(cipher) && !CipherViewLikeUtils.isDeleted(cipher);
  }

  private showUnarchive(cipher: CipherViewLike): boolean {
    return CipherViewLikeUtils.isArchived(cipher) && !CipherViewLikeUtils.isDeleted(cipher);
  }

  private showRestore(cipher: CipherViewLike): boolean {
    return CipherViewLikeUtils.isDeleted(cipher) && this.canRestore(cipher);
  }

  private canDelete(cipher: CipherViewLike): boolean {
    return !cipher.organizationId || !!cipher.permissions?.delete;
  }

  private canRestore(cipher: CipherViewLike): boolean {
    return !cipher.organizationId || !!cipher.permissions?.restore;
  }

  private canClone(cipher: CipherViewLike, collections: CollectionView[]): boolean {
    const isRestricted = this.restrictedTypes().some(
      (rt) => rt.cipherType === CipherViewLikeUtils.getType(cipher),
    );
    if (isRestricted) {
      return false;
    }
    if (!cipher.organizationId) {
      return true;
    }
    return collections
      .filter((c) => cipher.collectionIds.includes(c.id as any))
      .some((c) => c.manage);
  }
}
