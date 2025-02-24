import { NgModule } from "@angular/core";

import { LooseComponentsModule, SharedModule } from "../../../shared";

import { DisableSendPolicyComponent } from "./disable-send.component";
import { MasterPasswordPolicyComponent } from "./master-password.component";
import { PasswordGeneratorPolicyComponent } from "./password-generator.component";
import { PersonalOwnershipPolicyComponent } from "./personal-ownership.component";
import { PoliciesComponent } from "./policies.component";
import { PolicyEditComponent } from "./policy-edit.component";
import { RemoveUnlockWithPinPolicyComponent } from "./remove-unlock-with-pin.component";
import { RequireSsoPolicyComponent } from "./require-sso.component";
import { ResetPasswordPolicyComponent } from "./reset-password.component";
import { SendOptionsPolicyComponent } from "./send-options.component";
import { SingleOrgPolicyComponent } from "./single-org.component";
import { TwoFactorAuthenticationPolicyComponent } from "./two-factor-authentication.component";

@NgModule({
  imports: [SharedModule, LooseComponentsModule],
  declarations: [
    DisableSendPolicyComponent,
    MasterPasswordPolicyComponent,
    PasswordGeneratorPolicyComponent,
    PersonalOwnershipPolicyComponent,
    RequireSsoPolicyComponent,
    ResetPasswordPolicyComponent,
    SendOptionsPolicyComponent,
    SingleOrgPolicyComponent,
    TwoFactorAuthenticationPolicyComponent,
    PoliciesComponent,
    PolicyEditComponent,
    RemoveUnlockWithPinPolicyComponent,
  ],
  exports: [
    DisableSendPolicyComponent,
    MasterPasswordPolicyComponent,
    PasswordGeneratorPolicyComponent,
    PersonalOwnershipPolicyComponent,
    RequireSsoPolicyComponent,
    ResetPasswordPolicyComponent,
    SendOptionsPolicyComponent,
    SingleOrgPolicyComponent,
    TwoFactorAuthenticationPolicyComponent,
    PoliciesComponent,
    PolicyEditComponent,
    RemoveUnlockWithPinPolicyComponent,
  ],
})
export class PoliciesModule {}
