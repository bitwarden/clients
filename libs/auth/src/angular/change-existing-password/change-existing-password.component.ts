import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

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

  handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    // TODO-rr-bw: Full Sync if Rotate User Key is true (see setupSubmitActions)
  }
}
