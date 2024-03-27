import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { lastValueFrom, Observable, firstValueFrom } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

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
  EmergencyAccessTakeoverComponent,
  EmergencyAccessTakeoverResultType,
} from "./takeover/emergency-access-takeover.component";

@Component({
  selector: "emergency-access",
  templateUrl: "emergency-access.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class EmergencyAccessComponent implements OnInit {
  @ViewChild("addEdit", { read: ViewContainerRef, static: true }) addEditModalRef: ViewContainerRef;
  @ViewChild("takeoverTemplate", { read: ViewContainerRef, static: true })
  takeoverModalRef: ViewContainerRef;
  @ViewChild("confirmTemplate", { read: ViewContainerRef, static: true })
  confirmModalRef: ViewContainerRef;

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
  ) {
    this.canAccessPremium$ = billingAccountProfileStateService.hasPremiumFromAnySource$;
  }

  async ngOnInit() {
    const orgs = await this.organizationService.getAll();
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

  async premiumRequired() {
    const canAccessPremium = await firstValueFrom(this.canAccessPremium$);

    if (!canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    }
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
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("hasBeenReinvited", contact.email),
    );
    this.actionPromise = null;
  }

  async confirm(contact: GranteeEmergencyAccess) {
    function updateUser() {
      contact.status = EmergencyAccessStatusType.Confirmed;
    }

    if (this.actionPromise != null) {
      return;
    }

    const autoConfirm = await firstValueFrom(
      this.organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
    );
    if (autoConfirm == null || !autoConfirm) {
      const dialogRef = EmergencyAccessConfirmComponent.open(this.dialogService, {
        data: {
          name: this.userNamePipe.transform(contact),
          emergencyAccessId: contact.id,
          userId: contact?.granteeId,
        },
      });
      const result = await lastValueFrom(dialogRef.closed);
      if (result === EmergencyAccessConfirmDialogResult.Confirmed) {
        await this.emergencyAccessService.confirm(contact.id, contact.granteeId);
        updateUser();
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact)),
        );
      }
      return;
    }

    this.actionPromise = this.emergencyAccessService.confirm(contact.id, contact.granteeId);
    await this.actionPromise;
    updateUser();

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact)),
    );
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
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("removedUserId", this.userNamePipe.transform(details)),
      );

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
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("requestSent", this.userNamePipe.transform(details)),
    );
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

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("emergencyApproved", this.userNamePipe.transform(details)),
    );
  }

  async reject(details: GranteeEmergencyAccess) {
    await this.emergencyAccessService.reject(details.id);
    details.status = EmergencyAccessStatusType.Confirmed;

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("emergencyRejected", this.userNamePipe.transform(details)),
    );
  }

  takeover = async (details: GrantorEmergencyAccess) => {
    const dialogRef = EmergencyAccessTakeoverComponent.open(this.dialogService, {
      data: {
        name: this.userNamePipe.transform(details),
        email: details.email,
        emergencyAccessId: details.id ?? null,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (result === EmergencyAccessTakeoverResultType.Done) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("passwordResetFor", this.userNamePipe.transform(details)),
      );
    }
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
