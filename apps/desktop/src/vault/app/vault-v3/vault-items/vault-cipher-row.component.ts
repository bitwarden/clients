// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgClass } from "@angular/common";
import { Component, HostListener, computed, inject, input, output, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge/premium-badge.component";
import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BitIconButtonComponent,
  CheckboxModule,
  MenuModule,
  MenuTriggerForDirective,
  TableModule,
  LinkModule,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  GetOrgNameFromIdPipe,
  OrganizationNameBadgeComponent,
  VaultCopyButtonsService,
  VaultItemCopyActionsComponent,
  Vfo1I18nPipe,
  Vfo1IconPipe,
} from "@bitwarden/vault";

import { VaultItemEvent } from "./vault-item-event";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tr[appVaultCipherRow]",
  templateUrl: "vault-cipher-row.component.html",
  imports: [
    NgClass,
    I18nPipe,
    TableModule,
    OrganizationNameBadgeComponent,
    BitIconButtonComponent,
    MenuModule,
    VaultItemCopyActionsComponent,
    PremiumBadgeComponent,
    GetOrgNameFromIdPipe,
    IconComponent,
    LinkModule,
    IconModule,
    CheckboxModule,
    Vfo1I18nPipe,
    Vfo1IconPipe,
  ],
})
export class VaultCipherRowComponent<C extends CipherViewLike> {
  protected RowHeightClass = `tw-h-[76.5px]`;

  protected readonly menuTrigger = viewChild<MenuTriggerForDirective>("optionsMenuTrigger");

  protected readonly disabled = input<boolean>();
  protected readonly cipher = input<C>();
  protected readonly showOwner = input<boolean>();
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
  /**
   * Enforce Org Data Ownership Policy Status
   */
  protected readonly enforceOrgDataOwnershipPolicy = input<boolean>();
  protected readonly showBatchBar = input<boolean>(false);
  protected readonly selected = input<boolean>(false);
  protected readonly checkboxChange = output<void>();
  protected readonly onEvent = output<VaultItemEvent<C>>();

  private platformUtilsService = inject(PlatformUtilsService);
  private i18nService = inject(I18nService);
  private vaultCopyButtonsService = inject(VaultCopyButtonsService);
  private configService = inject(ConfigService);

  private readonly quickCopyActionsSetting = toSignal(
    this.vaultCopyButtonsService.showQuickCopyActions$,
    { initialValue: false },
  );

  private readonly quickCopyIconFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM40435_QuickCopyIconSetting),
    { initialValue: false },
  );

  /** Whether copy actions render as individual quick-copy icons rather than a single menu. */
  protected readonly showQuickCopyActions = computed(
    () => this.quickCopyIconFeatureFlag() && this.quickCopyActionsSetting(),
  );

  protected readonly showArchiveButton = computed(() => {
    return (
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
    return CipherViewLikeUtils.subtitle(this.cipher(), this.i18nService);
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

  /**
   * Determines if the copy actions should be shown. Copy actions are hidden for deleted or
   * archived items; the shared component decides which fields are copyable per cipher type.
   */
  protected readonly showCopyActions = computed(() => {
    const cipher = this.cipher();
    return !this.isDeleted() && !CipherViewLikeUtils.isArchived(cipher);
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

    if (!this.disabled() && this.menuTrigger()) {
      this.menuTrigger().toggleMenuOnRightClick(event);
    }
  }
}
