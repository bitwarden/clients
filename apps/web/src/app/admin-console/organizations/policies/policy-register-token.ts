import { SafeInjectionToken } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";

export const POLICY_REGISTER_TOKEN = new SafeInjectionToken<BasePolicyEditDefinition[]>(
  "POLICY_REGISTER_TOKEN",
);
