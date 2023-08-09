import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { DialogServiceAbstraction, SimpleDialogType } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { EmergencyAccessStatusType } from "@bitwarden/common/auth/enums/emergency-access-status-type";
import { EmergencyAccessType } from "@bitwarden/common/auth/enums/emergency-access-type";
import { EmergencyAccessConfirmRequest } from "@bitwarden/common/auth/models/request/emergency-access-confirm.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
} from "@bitwarden/common/auth/models/response/emergency-access.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { EmergencyAccessAddEditComponent } from "./emergency-access-add-edit.component";
import { EmergencyAccessConfirmComponent } from "./emergency-access-confirm.component";
import { EmergencyAccessTakeoverComponent } from "./emergency-access-takeover.component";

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
  canAccessPremium: boolean;
  trustedContacts: EmergencyAccessGranteeDetailsResponse[];
  grantedContacts: EmergencyAccessGrantorDetailsResponse[];
  emergencyAccessType = EmergencyAccessType;
  emergencyAccessStatusType = EmergencyAccessStatusType;
  actionPromise: Promise<any>;
  isOrganizationOwner: boolean;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private modalService: ModalService,
    private platformUtilsService: PlatformUtilsService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    private userNamePipe: UserNamePipe,
    private logService: LogService,
    private stateService: StateService,
    private organizationService: OrganizationService,
    protected dialogService: DialogServiceAbstraction
  ) {}

  async ngOnInit() {
    this.canAccessPremium = await this.stateService.getCanAccessPremium();
    const orgs = await this.organizationService.getAll();
    this.isOrganizationOwner = orgs.some((o) => o.isOwner);
    this.load();
  }

  async load() {
    this.trustedContacts = (await this.apiService.getEmergencyAccessTrusted()).data;
    this.grantedContacts = (await this.apiService.getEmergencyAccessGranted()).data;
    this.loaded = true;
  }

  async premiumRequired() {
    if (!this.canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    }
  }

  async edit(details: EmergencyAccessGranteeDetailsResponse) {
    const [modal] = await this.modalService.openViewRef(
      EmergencyAccessAddEditComponent,
      this.addEditModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(details);
        comp.emergencyAccessId = details?.id;
        comp.readOnly = !this.canAccessPremium;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onSaved.subscribe(() => {
          modal.close();
          this.load();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onDeleted.subscribe(() => {
          modal.close();
          this.remove(details);
        });
      }
    );
  }

  invite() {
    this.edit(null);
  }

  async reinvite(contact: EmergencyAccessGranteeDetailsResponse) {
    if (this.actionPromise != null) {
      return;
    }
    this.actionPromise = this.apiService.postEmergencyAccessReinvite(contact.id);
    await this.actionPromise;
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("hasBeenReinvited", contact.email)
    );
    this.actionPromise = null;
  }

  async confirm(contact: EmergencyAccessGranteeDetailsResponse) {
    function updateUser() {
      contact.status = EmergencyAccessStatusType.Confirmed;
    }

    if (this.actionPromise != null) {
      return;
    }

    const autoConfirm = await this.stateService.getAutoConfirmFingerPrints();
    if (autoConfirm == null || !autoConfirm) {
      const [modal] = await this.modalService.openViewRef(
        EmergencyAccessConfirmComponent,
        this.confirmModalRef,
        (comp) => {
          comp.name = this.userNamePipe.transform(contact);
          comp.emergencyAccessId = contact.id;
          comp.userId = contact?.granteeId;
          // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
          comp.onConfirmed.subscribe(async () => {
            modal.close();

            comp.formPromise = this.doConfirmation(contact);
            await comp.formPromise;

            updateUser();
            this.platformUtilsService.showToast(
              "success",
              null,
              this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact))
            );
          });
        }
      );
      return;
    }

    this.actionPromise = this.doConfirmation(contact);
    await this.actionPromise;
    updateUser();

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("hasBeenConfirmed", this.userNamePipe.transform(contact))
    );
    this.actionPromise = null;
  }

  async remove(
    details: EmergencyAccessGranteeDetailsResponse | EmergencyAccessGrantorDetailsResponse
  ) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: { key: "removeUserConfirmation" },
      type: SimpleDialogType.WARNING,
    });

    if (!confirmed) {
      return false;
    }

    try {
      await this.apiService.deleteEmergencyAccess(details.id);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("removedUserId", this.userNamePipe.transform(details))
      );

      if (details instanceof EmergencyAccessGranteeDetailsResponse) {
        this.removeGrantee(details);
      } else {
        this.removeGrantor(details);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  async requestAccess(details: EmergencyAccessGrantorDetailsResponse) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: {
        key: "requestAccessConfirmation",
        placeholders: [details.waitTimeDays.toString()],
      },
      acceptButtonText: { key: "requestAccess" },
      type: SimpleDialogType.WARNING,
    });

    if (!confirmed) {
      return false;
    }

    await this.apiService.postEmergencyAccessInitiate(details.id);

    details.status = EmergencyAccessStatusType.RecoveryInitiated;
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("requestSent", this.userNamePipe.transform(details))
    );
  }

  async approve(details: EmergencyAccessGranteeDetailsResponse) {
    const type = this.i18nService.t(
      details.type === EmergencyAccessType.View ? "view" : "takeover"
    );

    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.userNamePipe.transform(details),
      content: {
        key: "approveAccessConfirmation",
        placeholders: [this.userNamePipe.transform(details), type],
      },
      acceptButtonText: { key: "approve" },
      type: SimpleDialogType.WARNING,
    });

    if (!confirmed) {
      return false;
    }

    await this.apiService.postEmergencyAccessApprove(details.id);
    details.status = EmergencyAccessStatusType.RecoveryApproved;

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("emergencyApproved", this.userNamePipe.transform(details))
    );
  }

  async reject(details: EmergencyAccessGranteeDetailsResponse) {
    await this.apiService.postEmergencyAccessReject(details.id);
    details.status = EmergencyAccessStatusType.Confirmed;

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("emergencyRejected", this.userNamePipe.transform(details))
    );
  }

  async takeover(details: EmergencyAccessGrantorDetailsResponse) {
    const [modal] = await this.modalService.openViewRef(
      EmergencyAccessTakeoverComponent,
      this.takeoverModalRef,
      (comp) => {
        comp.name = this.userNamePipe.transform(details);
        comp.email = details.email;
        comp.emergencyAccessId = details != null ? details.id : null;

        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onDone.subscribe(() => {
          modal.close();
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("passwordResetFor", this.userNamePipe.transform(details))
          );
        });
      }
    );
  }

  private removeGrantee(details: EmergencyAccessGranteeDetailsResponse) {
    const index = this.trustedContacts.indexOf(details);
    if (index > -1) {
      this.trustedContacts.splice(index, 1);
    }
  }

  private removeGrantor(details: EmergencyAccessGrantorDetailsResponse) {
    const index = this.grantedContacts.indexOf(details);
    if (index > -1) {
      this.grantedContacts.splice(index, 1);
    }
  }

  // Encrypt the master password hash using the grantees public key, and send it to bitwarden for escrow.
  private async doConfirmation(details: EmergencyAccessGranteeDetailsResponse) {
    const encKey = await this.cryptoService.getEncKey();
    const publicKeyResponse = await this.apiService.getUserPublicKey(details.granteeId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    try {
      this.logService.debug(
        "User's fingerprint: " +
          (await this.cryptoService.getFingerprint(details.granteeId, publicKey)).join("-")
      );
    } catch {
      // Ignore errors since it's just a debug message
    }

    const encryptedKey = await this.cryptoService.rsaEncrypt(encKey.key, publicKey);
    const request = new EmergencyAccessConfirmRequest();
    request.key = encryptedKey.encryptedString;
    await this.apiService.postEmergencyAccessConfirm(details.id, request);
  }
}
