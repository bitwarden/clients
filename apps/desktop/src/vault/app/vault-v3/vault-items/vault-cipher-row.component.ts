// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, HostListener, ViewChild, computed, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge/premium-badge.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  AriaDisableDirective,
  BitIconButtonComponent,
  ButtonLinkDirective,
  MenuModule,
  MenuTriggerForDirective,
  TooltipDirective,
  TableModule,
} from "@bitwarden/components";
import {
  CopyCipherFieldDirective,
  GetOrgNameFromIdPipe,
  OrganizationNameBadgeComponent,
  VaultItemEvent,
} from "@bitwarden/vault";

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
    ButtonLinkDirective,
    RouterLink,
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
  protected readonly showGroups = input<boolean>();
  protected readonly showPremiumFeatures = input<boolean>();
  protected readonly useEvents = input<boolean>();
  protected readonly cloneable = input<boolean>();
  protected readonly organizations = input<Organization[]>();
  protected readonly viewingOrgVault = input<boolean>();
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

  private i18nService = inject(I18nService);

  // Archive button will not show in Admin Console
  protected readonly showArchiveButton = computed(() => {
    if (!this.archiveEnabled() || this.viewingOrgVault()) {
      return false;
    }

    return (
      !CipherViewLikeUtils.isArchived(this.cipher()) &&
      !CipherViewLikeUtils.isDeleted(this.cipher())
    );
  });

  // If item is archived always show unarchive button, even if user is not premium
  protected readonly showUnArchiveButton = computed(() => {
    if (!this.archiveEnabled()) {
      return false;
    }

    return CipherViewLikeUtils.isArchived(this.cipher());
  });

  protected readonly clickAction = computed(() => {
    if (this.decryptionFailure()) {
      return "showFailedToDecrypt";
    }

    return "view";
  });

  protected readonly showTotpCopyButton = computed(() => {
    const login = CipherViewLikeUtils.getLogin(this.cipher());

    const hasTotp = login?.totp ?? false;

    return hasTotp && (this.cipher().organizationUseTotp || this.showPremiumFeatures());
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

  protected readonly launchUri = computed(() => {
    return CipherViewLikeUtils.getLaunchUri(this.cipher());
  });

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

  protected readonly showEventLogs = computed(() => {
    return this.useEvents() && this.cipher().organizationId;
  });

  protected readonly isLoginCipher = computed(() => {
    return (
      CipherViewLikeUtils.getType(this.cipher()) === this.CipherType.Login &&
      !CipherViewLikeUtils.isDeleted(this.cipher()) &&
      !CipherViewLikeUtils.isArchived(this.cipher())
    );
  });

  protected readonly permissionText = computed(() => {
    if (!this.cipher().organizationId || this.cipher().collectionIds.length === 0) {
      return this.i18nService.t("manageCollection");
    }

    return this.i18nService.t("noAccess");
  });

  protected readonly hasVisibleLoginOptions = computed(() => {
    return (
      this.isLoginCipher() &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher(), "username") ||
        (this.cipher().viewPassword &&
          CipherViewLikeUtils.hasCopyableValue(this.cipher(), "password")) ||
        this.showTotpCopyButton() ||
        this.canLaunch())
    );
  });

  protected readonly isCardCipher = computed(() => {
    return CipherViewLikeUtils.getType(this.cipher()) === this.CipherType.Card && !this.isDeleted();
  });

  protected readonly hasVisibleCardOptions = computed(() => {
    return (
      this.isCardCipher() &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher(), "cardNumber") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher(), "securityCode"))
    );
  });

  protected readonly isIdentityCipher = computed(() => {
    if (CipherViewLikeUtils.isArchived(this.cipher()) && !this.userCanArchive()) {
      return false;
    }
    return (
      CipherViewLikeUtils.getType(this.cipher()) === this.CipherType.Identity && !this.isDeleted()
    );
  });

  protected readonly hasVisibleIdentityOptions = computed(() => {
    return (
      this.isIdentityCipher() &&
      (CipherViewLikeUtils.hasCopyableValue(this.cipher(), "address") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher(), "email") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher(), "username") ||
        CipherViewLikeUtils.hasCopyableValue(this.cipher(), "phone"))
    );
  });

  protected readonly isSecureNoteCipher = computed(() => {
    return (
      CipherViewLikeUtils.getType(this.cipher()) === this.CipherType.SecureNote &&
      !(this.isDeleted() && this.canRestoreCipher())
    );
  });

  protected readonly hasVisibleSecureNoteOptions = computed(() => {
    return (
      this.isSecureNoteCipher() && CipherViewLikeUtils.hasCopyableValue(this.cipher(), "secureNote")
    );
  });

  protected readonly showMenuDivider = computed(() => {
    return (
      this.hasVisibleLoginOptions() ||
      this.hasVisibleCardOptions() ||
      this.hasVisibleIdentityOptions() ||
      this.hasVisibleSecureNoteOptions()
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
