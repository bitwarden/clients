import { BasePolicy } from "./base-policy.component";
import { DisableSendPolicy } from "./disable-send.component";
import { MasterPasswordPolicy } from "./master-password.component";
import { OrganizationDataOwnershipPolicy } from "./organization-data-ownership.component";
import { PasswordGeneratorPolicy } from "./password-generator.component";
import { RemoveUnlockWithPinPolicy } from "./remove-unlock-with-pin.component";
import { RequireSsoPolicy } from "./require-sso.component";
import { ResetPasswordPolicy } from "./reset-password.component";
import { RestrictedItemTypesPolicy } from "./restricted-item-types.component";
import { SendOptionsPolicy } from "./send-options.component";
import { SingleOrgPolicy } from "./single-org.component";
import { TwoFactorAuthenticationPolicy } from "./two-factor-authentication.component";
import { vNextOrganizationDataOwnershipPolicy } from "./vnext-organization-data-ownership.component";

/**
 * The policy register for OSS policies.
 * Add your policy definition here if it is under the OSS license.
 */
export const policyRegister: BasePolicy[] = [
  new TwoFactorAuthenticationPolicy(),
  new MasterPasswordPolicy(),
  new RemoveUnlockWithPinPolicy(),
  new ResetPasswordPolicy(),
  new PasswordGeneratorPolicy(),
  new SingleOrgPolicy(),
  new RequireSsoPolicy(),
  new OrganizationDataOwnershipPolicy(),
  new vNextOrganizationDataOwnershipPolicy(),
  new DisableSendPolicy(),
  new SendOptionsPolicy(),
  new RestrictedItemTypesPolicy(),
];
