import { NgModule } from "@angular/core";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { DisableSendPolicyComponent } from "./disable-send.component";
import { MasterPasswordPolicyComponent } from "./master-password.component";
import { OrganizationDataOwnershipPolicyComponent } from "./organization-data-ownership.component";
import { PasswordGeneratorPolicyComponent } from "./password-generator.component";
import { PoliciesComponent } from "./policies.component";
import { PolicyEditComponent } from "./policy-edit.component";
import { RemoveUnlockWithPinPolicyComponent } from "./remove-unlock-with-pin.component";
import { RequireSsoPolicyComponent } from "./require-sso.component";
import { ResetPasswordPolicyComponent } from "./reset-password.component";
import { RestrictedItemTypesPolicyComponent } from "./restricted-item-types.component";
import { SendOptionsPolicyComponent } from "./send-options.component";
import { SingleOrgPolicyComponent } from "./single-org.component";
import { TwoFactorAuthenticationPolicyComponent } from "./two-factor-authentication.component";

@NgModule({
  imports: [SharedModule, HeaderModule],
  declarations: [
    DisableSendPolicyComponent,
    MasterPasswordPolicyComponent,
    PasswordGeneratorPolicyComponent,
    OrganizationDataOwnershipPolicyComponent,
    RequireSsoPolicyComponent,
    ResetPasswordPolicyComponent,
    SendOptionsPolicyComponent,
    SingleOrgPolicyComponent,
    TwoFactorAuthenticationPolicyComponent,
    PoliciesComponent,
    PolicyEditComponent,
    RemoveUnlockWithPinPolicyComponent,
    RestrictedItemTypesPolicyComponent,
  ],
  exports: [
    DisableSendPolicyComponent,
    MasterPasswordPolicyComponent,
    PasswordGeneratorPolicyComponent,
    OrganizationDataOwnershipPolicyComponent,
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
