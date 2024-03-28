import { Component, ViewChild, ViewContainerRef } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { PurgeVaultComponent } from "../../../vault/settings/purge-vault.component";

import { DeauthorizeSessionsComponent } from "./deauthorize-sessions.component";
import { DeleteAccountComponent } from "./delete-account.component";

@Component({
  selector: "app-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  @ViewChild("deauthorizeSessionsTemplate", { read: ViewContainerRef, static: true })
  deauthModalRef: ViewContainerRef;
  @ViewChild("purgeVaultTemplate", { read: ViewContainerRef, static: true })
  purgeModalRef: ViewContainerRef;

  showChangeEmail = true;

  constructor(
    private modalService: ModalService,
    private dialogService: DialogService,
    private userVerificationService: UserVerificationService,
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

  deleteAccount = async () => {
    const dialogRef = DeleteAccountComponent.openDeleteAccountDialog(this.dialogService);
    await lastValueFrom(dialogRef.closed);
  };
}
