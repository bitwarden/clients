// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  input,
} from "@angular/core";

import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { MenuTriggerForDirective } from "@bitwarden/components";

import {
  convertToPermission,
  getPermissionList,
} from "./../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
  standalone: false,
})
export class VaultCipherRowComponent<C extends CipherViewLike> implements OnInit {
  protected RowHeightClass = RowHeightClass;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(MenuTriggerForDirective, { static: false }) menuTrigger: MenuTriggerForDirective;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipher: C;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showOwner: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showCollections: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showGroups: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showPremiumFeatures: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() useEvents: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cloneable: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizations: Organization[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() collections: CollectionView[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() viewingOrgVault: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canEditCipher: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canAssignCollections: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canManageCollection: boolean;
  /**
   * uses new permission delete logic from PM-15493
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canDeleteCipher: boolean;
  /**
   * uses new permission restore logic from PM-15493
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canRestoreCipher: boolean;
  /**
   * user has archive permissions
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() userCanArchive: boolean;
  /** Archive feature is enabled */
  readonly archiveEnabled = input.required<boolean>();
  /**
   * Enforce Org Data Ownership Policy Status
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() enforceOrgDataOwnershipPolicy: boolean;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() checked: boolean;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() checkedToggled = new EventEmitter<void>();

  protected CipherType = CipherType;
  private permissionList = getPermissionList();
  private permissionPriority = [
    "manageCollection",
    "editItems",
    "editItemsHidePass",
    "viewItems",
    "viewItemsHidePass",
  ];
  protected organization?: Organization;

  constructor(private i18nService: I18nService) {}

  /**
   * Lifecycle hook for component initialization.
   */
  async ngOnInit(): Promise<void> {
    if (this.cipher.organizationId != null) {
      this.organization = this.organizations.find((o) => o.id === this.cipher.organizationId);
    }
  }

  protected get showArchiveButton() {
    if (!this.archiveEnabled()) {
      return false;
    }

    return (
      !CipherViewLikeUtils.isArchived(this.cipher) &&
      !CipherViewLikeUtils.isDeleted(this.cipher) &&
      !this.cipher.organizationId
    );
  }

  // If item is archived always show unarchive button, even if user is not premium
  protected get showUnArchiveButton() {
    if (!this.archiveEnabled()) {
      return false;
    }

    return CipherViewLikeUtils.isArchived(this.cipher);
  }

  protected get clickAction() {
    if (this.decryptionFailure) {
      return "showFailedToDecrypt";
    }

    return "view";
  }

  protected get showTotpCopyButton() {
    const login = CipherViewLikeUtils.getLogin(this.cipher);

    const hasTotp = login?.totp ?? false;

    return hasTotp && (this.cipher.organizationUseTotp || this.showPremiumFeatures);
  }

  protected get showFixOldAttachments() {
    return this.cipher.hasOldAttachments && this.cipher.organizationId == null;
  }

  protected get hasAttachments() {
    return CipherViewLikeUtils.hasAttachments(this.cipher);
  }

  // Do not show attachments button if:
  // item is archived AND user is not premium user
  protected get showAttachments() {
    if (CipherViewLikeUtils.isArchived(this.cipher) && !this.userCanArchive) {
      return false;
    }
    return this.canEditCipher || this.hasAttachments;
  }

  protected get canLaunch() {
    return CipherViewLikeUtils.canLaunch(this.cipher);
  }

  protected get launchUri() {
    return CipherViewLikeUtils.getLaunchUri(this.cipher);
  }

  protected get subtitle() {
    return CipherViewLikeUtils.subtitle(this.cipher);
  }

  protected get isDeleted() {
    return CipherViewLikeUtils.isDeleted(this.cipher);
  }

  protected get decryptionFailure() {
    return CipherViewLikeUtils.decryptionFailure(this.cipher);
  }

  // Do Not show Assign to Collections option if item is archived
  protected get showAssignToCollections() {
    if (CipherViewLikeUtils.isArchived(this.cipher)) {
      return false;
    }
    return (
      this.organizations?.length &&
      this.canAssignCollections &&
      !CipherViewLikeUtils.isDeleted(this.cipher)
    );
  }

  // Do NOT show clone option if:
  // item is archived AND user is not premium user
  // item is archived AND enforce org data ownership policy is on
  protected get showClone() {
    if (
      CipherViewLikeUtils.isArchived(this.cipher) &&
      (!this.userCanArchive || this.enforceOrgDataOwnershipPolicy)
    ) {
      return false;
    }
    return this.cloneable && !CipherViewLikeUtils.isDeleted(this.cipher);
  }

  protected get showEventLogs() {
    return this.useEvents && this.cipher.organizationId;
  }

  protected get isLoginCipher() {
    return (
      CipherViewLikeUtils.getType(this.cipher) === this.CipherType.Login &&
      !CipherViewLikeUtils.isDeleted(this.cipher) &&
      !CipherViewLikeUtils.isArchived(this.cipher)
    );
  }

  protected get hasPasswordToCopy() {
    return CipherViewLikeUtils.hasCopyableValue(this.cipher, "password");
  }

  protected get hasUsernameToCopy() {
    return CipherViewLikeUtils.hasCopyableValue(this.cipher, "username");
  }

  protected get permissionText() {
    if (!this.cipher.organizationId || this.cipher.collectionIds.length === 0) {
      return this.i18nService.t("manageCollection");
    }

    const filteredCollections = this.collections.filter((collection) => {
      if (collection.assigned) {
        return this.cipher.collectionIds.find((id) => {
          if (collection.id === id) {
            return collection;
          }
        });
      }
    });

    if (filteredCollections?.length === 1) {
      return this.i18nService.t(
        this.permissionList.find((p) => p.perm === convertToPermission(filteredCollections[0]))
          ?.labelId,
      );
    }

    if (filteredCollections?.length > 1) {
      const labels = filteredCollections.map((collection) => {
        return this.permissionList.find((p) => p.perm === convertToPermission(collection))?.labelId;
      });

      const highestPerm = this.permissionPriority.find((perm) => labels.includes(perm));
      return this.i18nService.t(highestPerm);
    }

    return this.i18nService.t("noAccess");
  }

  protected get hasVisibleLoginOptions() {
    return (
      this.isLoginCipher &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher, "username") ||
        (this.cipher.viewPassword &&
          CipherViewLikeUtils.hasCopyableValue(this.cipher, "password")) ||
        this.showTotpCopyButton ||
        this.canLaunch)
    );
  }

  protected get isCardCipher(): boolean {
    return CipherViewLikeUtils.getType(this.cipher) === this.CipherType.Card && !this.isDeleted;
  }

  protected get hasVisibleCardOptions(): boolean {
    return (
      this.isCardCipher &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher, "cardNumber") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher, "securityCode"))
    );
  }

  protected get isIdentityCipher() {
    return CipherViewLikeUtils.getType(this.cipher) === this.CipherType.Identity && !this.isDeleted;
  }

  protected get hasVisibleIdentityOptions(): boolean {
    return (
      this.isIdentityCipher &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher, "address") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher, "email") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher, "username") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher, "phone"))
    );
  }

  protected get isSecureNoteCipher() {
    return (
      CipherViewLikeUtils.getType(this.cipher) === this.CipherType.SecureNote &&
      !(this.isDeleted && this.canRestoreCipher)
    );
  }

  protected get hasVisibleSecureNoteOptions(): boolean {
    return (
      this.isSecureNoteCipher && CipherViewLikeUtils.hasCopyableValue(this.cipher, "secureNote")
    );
  }

  protected get showMenuDivider() {
    return (
      this.hasVisibleLoginOptions ||
      this.hasVisibleCardOptions ||
      this.hasVisibleIdentityOptions ||
      this.hasVisibleSecureNoteOptions
    );
  }

  protected clone() {
    this.onEvent.emit({ type: "clone", item: this.cipher });
  }

  protected events() {
    this.onEvent.emit({ type: "viewEvents", item: this.cipher });
  }

  protected archive() {
    this.onEvent.emit({ type: "archive", items: [this.cipher] });
  }

  protected unarchive() {
    this.onEvent.emit({ type: "unarchive", items: [this.cipher] });
  }

  protected restore() {
    this.onEvent.emit({ type: "restore", items: [this.cipher] });
  }

  protected deleteCipher() {
    this.onEvent.emit({ type: "delete", items: [{ cipher: this.cipher }] });
  }

  protected attachments() {
    this.onEvent.emit({ type: "viewAttachments", item: this.cipher });
  }

  protected assignToCollections() {
    this.onEvent.emit({ type: "assignToCollections", items: [this.cipher] });
  }

  protected get showCheckbox() {
    if (!this.viewingOrgVault || !this.organization) {
      return true; // Always show checkbox in individual vault or for non-org items
    }

    return this.organization.canEditAllCiphers || (this.cipher.edit && this.cipher.viewPassword);
  }

  protected toggleFavorite() {
    this.onEvent.emit({
      type: "toggleFavorite",
      item: this.cipher,
    });
  }

  protected editCipher() {
    this.onEvent.emit({ type: "editCipher", item: this.cipher });
  }

  @HostListener("contextmenu", ["$event"])
  protected onRightClick(event: MouseEvent) {
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    if (!this.disabled && this.menuTrigger) {
      this.menuTrigger.toggleMenuOnRightClick(event);
    }
  }
}
