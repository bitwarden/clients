import { SafeInjectionToken } from "@bitwarden/ui-common";

import { BasePolicy } from "./base-policy.component";

export const POLICY_REGISTER_TOKEN = new SafeInjectionToken<BasePolicy[]>("POLICY_REGISTER_TOKEN");
