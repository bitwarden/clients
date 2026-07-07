// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { lastValueFrom, Observable, firstValueFrom, switchMap, map } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";
import { EmergencyAccessService } from "../../emergency-access";
import { EmergencyAccessStatusType } from "../../emergency-access/enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../emergency-access/enums/emergency-access-type";
import {
  GranteeEmergencyAccess,
  GrantorEmergencyAccess,
} from "../../emergency-access/models/emergency-access";

import {
  EmergencyAccessConfirmComponent,
  EmergencyAccessConfirmDialogResult,
} from "./confirm/emergency-access-confirm.component";
import {
  EmergencyAccessAddEditComponent,
  EmergencyAccessAddEditDialogResult,
} from "./emergency-access-add-edit.component";
import {
  EmergencyAccessTakeoverDialogComponent,
  EmergencyAccessTakeoverDialogResultType,
} from "./takeover/emergency-access-takeover-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "emergency-access.component.html",
  imports: [SharedModule, HeaderModule, PremiumBadgeComponent],
})
export class EmergencyAccessComponent implements OnInit {
  loaded = false;
  canAccessPremium$: Observable<boolean>;
  trustedContacts: GranteeEmergencyAccess[];
  grantedContacts: GrantorEmergencyAccess[];
  emergencyAccessType = EmergencyAccessType;
  emergencyAccessStatusType = EmergencyAccessStatusType;
  actionPromise: Promise<any>;
  isOrganizationOwner: boolean;

  constructor(
    private emergencyAccessService: EmergencyAccessService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private messagingService: MessagingService,
    private userNamePipe: UserNamePipe,
    private logService: LogService,
    private stateService: StateService,
    private organizationService: OrganizationService,
    protected dialogService: DialogService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private toastService: ToastService,
    private apiService: ApiService,
    private accountService: AccountService,
  ) {
    this.canAccessPremium$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
    );
  }

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const orgs = await firstValueFrom(this.organizationService.organizations$(userId));
    this.isOrganizationOwner = orgs.some((o) => o.isOwner);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.load();
  }

  async load() {
    this.trustedContacts = await this.emergencyAccessService.getEmergencyAccessTrusted();
    this.grantedContacts = await this.emergencyAccessService.getEmergencyAccessGranted();
    this.loaded = true;
  }

  edit = async (details: GranteeEmergencyAccess) => {
    const canAccessPremium = await firstValueFrom(this.canAccessPremium$);
    const dialogRef = EmergencyAccessAddEditComponent.open(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(details),
        emergencyAccessId: details?.id,
        readOnly: !canAccessPremium,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);
    if (result === EmergencyAccessAddEditDialogResult.Saved) {
      await this.load();
    } else if (result === EmergencyAccessAddEditDialogResult.Deleted) {
      await this.remove(details);
    }
  };

  invite = async () => {
    await this.edit(null);
  };

  async reinvite(contact: GranteeEmergencyAccess) {
    if (this.actionPromise != null) {
      return;
    }
    this.actionPromise = this.emergencyAccessService.reinvite(contact.id);
    await this.actionPromise;
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("hasBeenReinvited", contact.email),
    });
    this.actionPromise = null;
  }

  async confirm(contact: GranteeEmergencyAccess) {
    function updateUser() {
      contact.status = EmergencyAccessStatusType.Confirmed;
    }

    if (this.actionPromise != null) {
      return;
    }

    const publicKeyResponse = await this.apiService.getUserPublicKey(contact.granteeId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    const autoConfirm = await firstValueFrom(
      this.organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
    );
    if (autoConfirm == null || !autoConfirm) {
      const dialogRef = EmergencyAccessConfirmComponent.open(this.dialogService, {
        data: {
          name: this.userNamePipe.transform(contact),
          emergencyAccessId: contact.id,
          userId: contact?.granteeId,
          publicKey,
        },
      });
      const result = await lastValueFrom(dialogRef.closed);
      if (result === EmergencyAccessConfirmDialogResult.Confirmed) {
        const activeUserId = await firstValueFrom(
          this.accountService.activeAccount$.pipe(getUserId),
        );
        await this.emergencyAccessService.confirm(
          contact.id,
          contact.granteeId,
          publicKey,
          activeUserId,
        );
        updateUser();
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact)),
        });
      }
      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    this.actionPromise = this.emergencyAccessService.confirm(
      contact.id,
      contact.granteeId,
      publicKey,
      activeUserId,
    );
    await this.actionPromise;
    updateUser();

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact)),
    });
    this.actionPromise = null;
  }

  async remove(details: GranteeEmergencyAccess | GrantorEmergencyAccess) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: { key: "removeUserConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.emergencyAccessService.delete(details.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("removedUserId", this.userNamePipe.transform(details)),
      });

      if (details instanceof GranteeEmergencyAccess) {
        this.removeGrantee(details);
      } else {
        this.removeGrantor(details);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  async requestAccess(details: GrantorEmergencyAccess) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: {
        key: "requestAccessConfirmation",
        placeholders: [details.waitTimeDays.toString()],
      },
      acceptButtonText: { key: "requestAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    await this.emergencyAccessService.requestAccess(details.id);

    details.status = EmergencyAccessStatusType.RecoveryInitiated;
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("requestSent", this.userNamePipe.transform(details)),
    });
  }

  async approve(details: GranteeEmergencyAccess) {
    const type = this.i18nService.t(
      details.type === EmergencyAccessType.View ? "view" : "takeover",
    );

    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: {
        key: "approveAccessConfirmation",
        placeholders: [this.userNamePipe.transform(details), type],
      },
      acceptButtonText: { key: "approve" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    await this.emergencyAccessService.approve(details.id);
    details.status = EmergencyAccessStatusType.RecoveryApproved;

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("emergencyApproved", this.userNamePipe.transform(details)),
    });
  }

  async reject(details: GranteeEmergencyAccess) {
    await this.emergencyAccessService.reject(details.id);
    details.status = EmergencyAccessStatusType.Confirmed;

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("emergencyRejected", this.userNamePipe.transform(details)),
    });
  }

  takeover = async (details: GrantorEmergencyAccess) => {
    if (!details || !details.email || !details.id) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("grantorDetailsNotFound"),
      });
      this.logService.error("Grantor details not found when attempting emergency access takeover");

      return;
    }

    const grantorName = this.userNamePipe.transform(details);

    const dialogRef = EmergencyAccessTakeoverDialogComponent.open(this.dialogService, {
      data: {
        grantorName,
        grantorEmail: details.email,
        emergencyAccessId: details.id,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === EmergencyAccessTakeoverDialogResultType.Done) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("passwordResetFor", grantorName),
      });
    }

    return;
  };

  private removeGrantee(details: GranteeEmergencyAccess) {
    const index = this.trustedContacts.indexOf(details);
    if (index > -1) {
      this.trustedContacts.splice(index, 1);
    }
  }

  private removeGrantor(details: GrantorEmergencyAccess) {
    const index = this.grantedContacts.indexOf(details);
    if (index > -1) {
      this.grantedContacts.splice(index, 1);
    }
  }
}
