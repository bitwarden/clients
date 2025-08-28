import { BasePolicy } from "./base-policy.component";
import {
  DisableSendPolicy,
  MasterPasswordPolicy,
  OrganizationDataOwnershipPolicy,
  PasswordGeneratorPolicy,
  RemoveUnlockWithPinPolicy,
  RequireSsoPolicy,
  ResetPasswordPolicy,
  RestrictedItemTypesPolicy,
  SendOptionsPolicy,
  SingleOrgPolicy,
  TwoFactorAuthenticationPolicy,
  vNextOrganizationDataOwnershipPolicy,
} from "./policy-edit-metadata";

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
