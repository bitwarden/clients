import {
  ossPolicyEditRegister,
  BasePolicyEditDefinition,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";

import { FreeFamiliesSponsorshipPolicy } from "../../billing/policies/free-families-sponsorship.component";

import {
  ActivateAutofillPolicy,
  AutomaticAppLoginPolicy,
  DisablePersonalVaultExportPolicy,
  MaximumVaultTimeoutPolicy,
} from "./policy-edit-definitions";

/**
 * The policy register for Bitwarden Licensed policies.
 * Add your policy definition here if it is under the Bitwarden License.
 * It will not appear in the web vault when running in OSS mode.
 */
const policyEditRegister: BasePolicyEditDefinition[] = [
  new MaximumVaultTimeoutPolicy(),
  new DisablePersonalVaultExportPolicy(),
  new FreeFamiliesSponsorshipPolicy(),
  new ActivateAutofillPolicy(),
  new AutomaticAppLoginPolicy(),
];

export const bitPolicyEditRegister = ossPolicyEditRegister.concat(policyEditRegister);
