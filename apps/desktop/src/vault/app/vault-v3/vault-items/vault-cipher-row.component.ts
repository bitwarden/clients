// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, HostListener, ViewChild, computed, inject, input, output } from "@angular/core";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge/premium-badge.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  AriaDisableDirective,
  BitIconButtonComponent,
  MenuModule,
  MenuTriggerForDirective,
  TooltipDirective,
  TableModule,
} from "@bitwarden/components";
import {
  CopyAction,
  CopyCipherFieldDirective,
  GetOrgNameFromIdPipe,
  OrganizationNameBadgeComponent,
} from "@bitwarden/vault";

import { VaultItemEvent } from "./vault-item-event";

/** Configuration for a copyable field */
interface CopyFieldConfig {
  field: CopyAction;
  title: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
  imports: [
    NgClass,
    JslibModule,
    TableModule,
    AriaDisableDirective,
    OrganizationNameBadgeComponent,
    TooltipDirective,
    BitIconButtonComponent,
    MenuModule,
    CopyCipherFieldDirective,
    PremiumBadgeComponent,
    GetOrgNameFromIdPipe,
  ],
})
export class VaultCipherRowComponent<C extends CipherViewLike> {
  protected RowHeightClass = `tw-h-[75px]`;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(MenuTriggerForDirective, { static: false }) menuTrigger: MenuTriggerForDirective;

  protected readonly disabled = input<boolean>();
  protected readonly cipher = input<C>();
  protected readonly showOwner = input<boolean>();
  protected readonly showPremiumFeatures = input<boolean>();
  protected readonly useEvents = input<boolean>();
  protected readonly cloneable = input<boolean>();
  protected readonly organizations = input<Organization[]>();
  protected readonly canEditCipher = input<boolean>();
  protected readonly canAssignCollections = input<boolean>();
  protected readonly canManageCollection = input<boolean>();
  /**
   * uses new permission delete logic from PM-15493
   */
  protected readonly canDeleteCipher = input<boolean>();
  /**
   * uses new permission restore logic from PM-15493
   */
  protected readonly canRestoreCipher = input<boolean>();
  /**
   * user has archive permissions
   */
  protected readonly userCanArchive = input<boolean>();
  /** Archive feature is enabled */
  readonly archiveEnabled = input.required<boolean>();
  /**
   * Enforce Org Data Ownership Policy Status
   */
  protected readonly enforceOrgDataOwnershipPolicy = input<boolean>();
  protected readonly onEvent = output<VaultItemEvent<C>>();

  protected CipherType = CipherType;

  private platformUtilsService = inject(PlatformUtilsService);

  protected readonly showArchiveButton = computed(() => {
    return (
      this.archiveEnabled() &&
      !this.cipher().organizationId &&
      !CipherViewLikeUtils.isArchived(this.cipher()) &&
      !CipherViewLikeUtils.isDeleted(this.cipher())
    );
  });

  // If item is archived always show unarchive button, even if user is not premium
  protected readonly showUnArchiveButton = computed(() => {
    return (
      CipherViewLikeUtils.isArchived(this.cipher()) && !CipherViewLikeUtils.isDeleted(this.cipher())
    );
  });

  protected readonly showFixOldAttachments = computed(() => {
    return this.cipher().hasOldAttachments && this.cipher().organizationId == null;
  });

  protected readonly hasAttachments = computed(() => {
    return CipherViewLikeUtils.hasAttachments(this.cipher());
  });

  // Do not show attachments button if:
  // item is archived AND user is not premium user
  protected readonly showAttachments = computed(() => {
    if (CipherViewLikeUtils.isArchived(this.cipher()) && !this.userCanArchive()) {
      return false;
    }
    return this.canEditCipher() || this.hasAttachments();
  });

  protected readonly canLaunch = computed(() => {
    return CipherViewLikeUtils.canLaunch(this.cipher());
  });

  protected handleLaunch() {
    const launchUri = CipherViewLikeUtils.getLaunchUri(this.cipher());
    this.platformUtilsService.launchUri(launchUri);
  }

  protected readonly subtitle = computed(() => {
    return CipherViewLikeUtils.subtitle(this.cipher());
  });

  protected readonly isDeleted = computed(() => {
    return CipherViewLikeUtils.isDeleted(this.cipher());
  });

  protected readonly decryptionFailure = computed(() => {
    return CipherViewLikeUtils.decryptionFailure(this.cipher());
  });

  protected readonly showFavorite = computed(() => {
    if (CipherViewLikeUtils.isArchived(this.cipher()) && !this.userCanArchive()) {
      return false;
    }
    return true;
  });

  // Do Not show Assign to Collections option if item is archived
  protected readonly showAssignToCollections = computed(() => {
    if (CipherViewLikeUtils.isArchived(this.cipher())) {
      return false;
    }
    return (
      this.organizations()?.length &&
      this.canAssignCollections() &&
      !CipherViewLikeUtils.isDeleted(this.cipher())
    );
  });

  // Do NOT show clone option if:
  // item is archived AND user is not premium user
  // item is archived AND enforce org data ownership policy is on
  protected readonly showClone = computed(() => {
    if (
      CipherViewLikeUtils.isArchived(this.cipher()) &&
      (!this.userCanArchive() || this.enforceOrgDataOwnershipPolicy())
    ) {
      return false;
    }
    return this.cloneable() && !CipherViewLikeUtils.isDeleted(this.cipher());
  });

  protected readonly showMenuDivider = computed(() => this.showCopyButton() || this.canLaunch());

  /**
   * Returns the list of copyable fields based on cipher type.
   * Used to render copy menu items dynamically.
   */
  protected readonly copyFields = computed((): CopyFieldConfig[] => {
    const cipher = this.cipher();

    // No copy options for deleted or archived items
    if (this.isDeleted() || CipherViewLikeUtils.isArchived(cipher)) {
      return [];
    }

    const cipherType = CipherViewLikeUtils.getType(cipher);

    switch (cipherType) {
      case CipherType.Login: {
        const fields: CopyFieldConfig[] = [{ field: "username", title: "copyUsername" }];
        if (cipher.viewPassword) {
          fields.push({ field: "password", title: "copyPassword" });
        }
        if (
          CipherViewLikeUtils.getLogin(cipher).totp &&
          (cipher.organizationUseTotp || this.showPremiumFeatures())
        ) {
          fields.push({ field: "totp", title: "copyVerificationCode" });
        }
        return fields;
      }
      case CipherType.Card:
        return [
          { field: "cardNumber", title: "copyNumber" },
          { field: "securityCode", title: "copySecurityCode" },
        ];
      case CipherType.Identity:
        return [
          { field: "username", title: "copyUsername" },
          { field: "email", title: "copyEmail" },
          { field: "phone", title: "copyPhone" },
          { field: "address", title: "copyAddress" },
        ];
      case CipherType.SecureNote:
        return [{ field: "secureNote", title: "copyNote" }];
      default:
        return [];
    }
  });

  /**
   * Determines if the copy button should be shown.
   * Returns true only if at least one field has a copyable value.
   */
  protected readonly showCopyButton = computed(() => {
    const cipher = this.cipher();
    return this.copyFields().some(({ field }) =>
      CipherViewLikeUtils.hasCopyableValue(cipher, field),
    );
  });

  protected clone() {
    this.onEvent.emit({ type: "clone", item: this.cipher() });
  }

  protected events() {
    this.onEvent.emit({ type: "viewEvents", item: this.cipher() });
  }

  protected archive() {
    this.onEvent.emit({ type: "archive", items: [this.cipher()] });
  }

  protected unarchive() {
    this.onEvent.emit({ type: "unarchive", items: [this.cipher()] });
  }

  protected restore() {
    this.onEvent.emit({ type: "restore", items: [this.cipher()] });
  }

  protected deleteCipher() {
    this.onEvent.emit({ type: "delete", items: [{ cipher: this.cipher() }] });
  }

  protected attachments() {
    this.onEvent.emit({ type: "viewAttachments", item: this.cipher() });
  }

  protected assignToCollections() {
    this.onEvent.emit({ type: "assignToCollections", items: [this.cipher()] });
  }

  protected toggleFavorite() {
    this.onEvent.emit({
      type: "toggleFavorite",
      item: this.cipher(),
    });
  }

  protected editCipher() {
    this.onEvent.emit({ type: "editCipher", item: this.cipher() });
  }

  protected viewCipher() {
    this.onEvent.emit({ type: "viewCipher", item: this.cipher() });
  }

  @HostListener("contextmenu", ["$event"])
  protected onRightClick(event: MouseEvent) {
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    if (!this.disabled() && this.menuTrigger) {
      this.menuTrigger.toggleMenuOnRightClick(event);
    }
  }
}
