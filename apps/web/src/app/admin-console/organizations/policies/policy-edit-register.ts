import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import {
  AutoConfirmPolicy,
  DesktopAutotypeDefaultSettingPolicy,
  DisableSendPolicy,
  MasterPasswordPolicy,
  MasterPasswordPolicyV2,
  OrganizationDataOwnershipPolicy,
  OrganizationDataOwnershipPolicyV2,
  OrganizationUserNotificationPolicy,
  PasswordGeneratorPolicy,
  PasswordGeneratorPolicyV2,
  RemoveUnlockWithPinPolicy,
  RequireSsoPolicy,
  ResetPasswordPolicy,
  ResetPasswordPolicyV2,
  RestrictedItemTypesPolicy,
  SendControlsPolicy,
  SendOptionsPolicy,
  SingleOrgPolicy,
  TwoFactorAuthenticationPolicy,
  UriMatchDefaultPolicy,
} from "./policy-edit-definitions";

/**
 * The policy register for OSS policies.
 * Add your policy definition here if it is under the OSS license.
 */
export const ossPolicyEditRegister: BasePolicyEditDefinition[] = [
  new TwoFactorAuthenticationPolicy(),
  new MasterPasswordPolicy(),
  new MasterPasswordPolicyV2(),
  new RemoveUnlockWithPinPolicy(),
  new ResetPasswordPolicy(),
  new ResetPasswordPolicyV2(),
  new PasswordGeneratorPolicy(),
  new PasswordGeneratorPolicyV2(),
  new SingleOrgPolicy(),
  new RequireSsoPolicy(),
  new OrganizationDataOwnershipPolicy(),
  new OrganizationDataOwnershipPolicyV2(),
  new DisableSendPolicy(),
  new SendOptionsPolicy(),
  new SendControlsPolicy(),
  new RestrictedItemTypesPolicy(),
  new DesktopAutotypeDefaultSettingPolicy(),
  new UriMatchDefaultPolicy(),
  new AutoConfirmPolicy(),
  new OrganizationUserNotificationPolicy(),
];
