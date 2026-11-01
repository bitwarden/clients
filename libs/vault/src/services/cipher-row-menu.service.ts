import { inject, Injectable, isDevMode } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, shareReplay, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  RestrictedCipherAction,
  RestrictedCipherPolicy,
} from "@bitwarden/common/vault/utils/restricted-cipher-policy";

import { VaultItemsTableRowAction } from "../components/vault-items-table/vault-items-table-row-action";
import { VAULT_ROW_ACTIONS } from "../tokens/vault-row-actions.token";

import { CipherActionService } from "./cipher-action.service";

/**
 * The only actions offered for an item that failed to decrypt. Every other action reads or
 * re-encrypts fields the client could not decrypt, so it would fail.
 */
const DECRYPTION_FAILURE_ACTION_IDS = new Set(["delete", "permanentlyDelete"]);

/** The Delete group. Contributed actions go before it. */
const DANGER_ACTION_IDS = new Set(["delete", "permanentlyDelete"]);

/** IDs of the actions {@link CipherRowMenuService.getRowActions} builds. Contributed IDs must differ. */
const BUILT_IN_ACTION_IDS: ReadonlySet<string> = new Set([
  "addFavorite",
  "removeFavorite",
  "edit",
  "attachments",
  "clone",
  "addToSharedFolder",
  "archive",
  "unarchive",
  "restore",
  ...DANGER_ACTION_IDS,
]);

/**
 * Drops each contributed action whose ID matches a built-in ID or an earlier contributed ID.
 * Throws in dev mode instead.
 */
function uniqueContributedActions(
  actions: readonly VaultItemsTableRowAction<CipherViewLike>[],
): readonly VaultItemsTableRowAction<CipherViewLike>[] {
  const seen = new Set(BUILT_IN_ACTION_IDS);
  return actions.filter((action) => {
    if (seen.has(action.id)) {
      if (isDevMode()) {
        throw new Error(`VAULT_ROW_ACTIONS action ID "${action.id}" is already in use.`);
      }
      return false;
    }
    seen.add(action.id);
    return true;
  });
}

export type CipherRowMenuHandlers<C extends CipherViewLike> = {
  edit: (item: C) => void | Promise<void>;
  clone: (item: C) => void | Promise<void>;
  assignToCollections: (item: C) => void | Promise<void>;
};

/**
 * Centralises row overflow menu action definitions for vault cipher rows across clients.
 * Built-in actions, then contributed actions (`VAULT_ROW_ACTIONS`), then the Delete group.
 */
@Injectable({ providedIn: "root" })
export class CipherRowMenuService {
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly organizationService = inject(OrganizationService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly cipherActionService = inject(CipherActionService);
  private readonly revealedCipherService = inject(RevealedCipherService);
  private readonly contributedActions = uniqueContributedActions(
    inject(VAULT_ROW_ACTIONS, { optional: true }) ?? [],
  );

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

  /** The active user's revealed ciphers. A revealed row offers edit and attachments. */
  private readonly revealed = toSignal(
    this.userId$.pipe(switchMap((userId) => this.revealedCipherService.revealed$(userId))),
    { initialValue: new Map() as ReadonlyMap<CipherId, CipherView> },
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
    const builtIn: VaultItemsTableRowAction<C>[] = [
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
        show: (item) =>
          this.canDelete(item) &&
          !CipherViewLikeUtils.isDeleted(item) &&
          this.allows(item, RestrictedCipherAction.Delete),
        variant: "danger",
      },
      {
        id: "permanentlyDelete",
        label: this.i18nService.t("permanentlyDelete"),
        icon: "bwi-trash",
        run: (item) => void this.cipherActionService.delete(item),
        show: (item) =>
          this.canDelete(item) &&
          CipherViewLikeUtils.isDeleted(item) &&
          this.allows(item, RestrictedCipherAction.Delete),
        variant: "danger",
      },
    ];

    const actions: VaultItemsTableRowAction<C>[] = [
      ...builtIn.filter((action) => !DANGER_ACTION_IDS.has(action.id)),
      ...this.contributedActions,
      ...builtIn.filter((action) => DANGER_ACTION_IDS.has(action.id)),
    ];

    return actions.map((action) => ({
      ...action,
      show: (item: C) =>
        (DECRYPTION_FAILURE_ACTION_IDS.has(action.id) ||
          !CipherViewLikeUtils.decryptionFailure(item)) &&
        (action.show?.(item) ?? true),
    }));
  }

  private allows(cipher: CipherViewLike, action: RestrictedCipherAction): boolean {
    const revealedView = cipher.id == null ? undefined : this.revealed().get(cipher.id as CipherId);
    return RestrictedCipherPolicy.allows(cipher, action, revealedView);
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
    return (
      !CipherViewLikeUtils.isDeleted(cipher) &&
      cipher.edit &&
      this.allows(cipher, RestrictedCipherAction.Edit)
    );
  }

  private showAttachments(cipher: CipherViewLike): boolean {
    if (
      (CipherViewLikeUtils.isArchived(cipher) && !this.userCanArchive()) ||
      CipherViewLikeUtils.isDeleted(cipher) ||
      !this.allows(cipher, RestrictedCipherAction.Attachments)
    ) {
      return false;
    }
    return cipher.edit || CipherViewLikeUtils.hasAttachments(cipher);
  }

  private showClone(cipher: CipherViewLike, collections: CollectionView[]): boolean {
    if (
      (CipherViewLikeUtils.isArchived(cipher) && !this.userCanArchive()) ||
      !this.allows(cipher, RestrictedCipherAction.Clone)
    ) {
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
      !CipherViewLikeUtils.canAssignToCollections(cipher) ||
      !this.allows(cipher, RestrictedCipherAction.AssignCollections)
    ) {
      return false;
    }

    const assignable = cipher.organizationId
      ? collections.filter((c) => c.organizationId === cipher.organizationId && !c.readOnly)
      : collections.filter((c) => !c.readOnly);

    return this.organizations().length > 0 && assignable.length > 0;
  }

  private showArchive(cipher: CipherViewLike): boolean {
    return (
      !CipherViewLikeUtils.isArchived(cipher) &&
      !CipherViewLikeUtils.isDeleted(cipher) &&
      this.allows(cipher, RestrictedCipherAction.UserFields)
    );
  }

  private showUnarchive(cipher: CipherViewLike): boolean {
    return (
      CipherViewLikeUtils.isArchived(cipher) &&
      !CipherViewLikeUtils.isDeleted(cipher) &&
      this.allows(cipher, RestrictedCipherAction.UserFields)
    );
  }

  private showRestore(cipher: CipherViewLike): boolean {
    return (
      CipherViewLikeUtils.isDeleted(cipher) &&
      this.canRestore(cipher) &&
      this.allows(cipher, RestrictedCipherAction.Restore)
    );
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
