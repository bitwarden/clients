import { SafeInjectionToken } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";

export const POLICY_EDIT_REGISTER = new SafeInjectionToken<BasePolicyEditDefinition[]>(
  "POLICY_EDIT_REGISTER",
);
