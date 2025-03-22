import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeyService } from "@bitwarden/key-management";

import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

@Component({
  standalone: true,
  selector: "auth-change-existing-password",
  templateUrl: "change-existing-password.component.html",
  imports: [InputPasswordComponent],
})
export class ChangeExistingPasswordComponent implements OnInit {
  protected InputPasswordFlow = InputPasswordFlow;

  protected email?: string;
  protected masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;

  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
    private masterPasswordApiService: MasterPasswordApiService,
    private masterPasswordService: MasterPasswordServiceAbstraction,
    private policyService: PolicyService,
  ) {}

  async ngOnInit() {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(),
    );
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    // TODO-rr-bw: Full Sync if Rotate User Key is true (see setupSubmitActions)
    // const request = new PasswordRequest();
    // // request.masterPasswordHash = await this.keyService.hashMasterKey(passwordInputResult.currentPassword)
    // request.masterPasswordHash = passwordInputResult.hint;
    // request.newMasterPasswordHash = passwordInputResult.masterKeyHash;
    // // request.key =
    // await this.masterPasswordApiService.postPassword(request);
    // if (passwordInputResult.rotateAccountEncryptionKey) {
    //   // We need to save this for local masterkey verification during rotation
    //   await this.masterPasswordService.setMasterKeyHash(newLocalKeyHash, userId as UserId);
    //   await this.masterPasswordService.setMasterKey(newMasterKey, userId as UserId);
    //   return this.updateKey();
    // }
  }

  // private async updateKey() {
  //   const user = await firstValueFrom(this.accountService.activeAccount$);
  //   await this.userKeyRotationService.rotateUserKeyAndEncryptedData(this.masterPassword, user);
  // }
}
