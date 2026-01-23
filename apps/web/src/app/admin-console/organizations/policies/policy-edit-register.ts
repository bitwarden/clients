import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import {
  AutoConfirmPolicy,
  DesktopAutotypeDefaultSettingPolicy,
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
  UriMatchDefaultPolicy,
  vNextOrganizationDataOwnershipPolicy,
} from "./policy-edit-definitions";

/**
 * The policy register for OSS policies.
 * Add your policy definition here if it is under the OSS license.
 */
export const ossPolicyEditRegister: BasePolicyEditDefinition[] = [
  new SingleOrgPolicy(),
  new vNextOrganizationDataOwnershipPolicy(), // Centralized ownership
  new MasterPasswordPolicy(), // Master password requirements
  new ResetPasswordPolicy(), // Account recovery
  new RequireSsoPolicy(), // Require SSO
  new TwoFactorAuthenticationPolicy(), // Require 2FA
  new RemoveUnlockWithPinPolicy(), // Remove Unlock with PIN
  new PasswordGeneratorPolicy(), // Password generator
  new UriMatchDefaultPolicy(), // Default URI match detection
  new SendOptionsPolicy(), // Send options
  new DisableSendPolicy(), // Remove Send
  new RestrictedItemTypesPolicy(), // Remove card item type
  new AutoConfirmPolicy(),
  new OrganizationDataOwnershipPolicy(),
  new DesktopAutotypeDefaultSettingPolicy(),
];
