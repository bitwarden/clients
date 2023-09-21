import { Component, ViewChild, ViewContainerRef } from "@angular/core";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";

import { DeauthorizeSessionsComponent } from "../auth/settings/deauthorize-sessions.component";

import { DeleteAccountComponent } from "./delete-account.component";
import { PurgeVaultComponent } from "./purge-vault.component";

@Component({
  selector: "app-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  @ViewChild("deauthorizeSessionsTemplate", { read: ViewContainerRef, static: true })
  deauthModalRef: ViewContainerRef;
  @ViewChild("purgeVaultTemplate", { read: ViewContainerRef, static: true })
  purgeModalRef: ViewContainerRef;
  @ViewChild("deleteAccountTemplate", { read: ViewContainerRef, static: true })
  deleteModalRef: ViewContainerRef;

  showChangeEmail = true;

  constructor(
    private modalService: ModalService,
    private userVerificationService: UserVerificationService
  ) {}

  async ngOnInit() {
    this.showChangeEmail = await this.userVerificationService.hasMasterPassword();
  }

  async deauthorizeSessions() {
    await this.modalService.openViewRef(DeauthorizeSessionsComponent, this.deauthModalRef);
  }

  async purgeVault() {
    await this.modalService.openViewRef(PurgeVaultComponent, this.purgeModalRef);
  }

  async deleteAccount() {
    await this.modalService.openViewRef(DeleteAccountComponent, this.deleteModalRef);
  }
}
