import { Policy as SdkPolicy } from "@bitwarden/sdk-internal";

import { SdkRecordMapper } from "../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../platform/state";
import { POLICIES_NEW } from "../../services/policy/policy-state";
import { PolicyData } from "../data/policy.data";

/**
 * Bridges the client's `POLICIES_NEW` state to the SDK's policy repository so the SDK can
 * read/write policies from the same state legacy sync already populates. `POLICIES_NEW` is used
 * because the SDK sync handler prefers the `policiesNew` sync response field.
 */
export class PolicyRecordMapper implements SdkRecordMapper<PolicyData, SdkPolicy> {
  userKeyDefinition(): UserKeyDefinition<Record<string, PolicyData>> {
    return POLICIES_NEW;
  }

  toSdk(value: PolicyData): SdkPolicy {
    return PolicyData.toSdk(value);
  }

  fromSdk(value: SdkPolicy): PolicyData {
    return PolicyData.fromSdk(value);
  }
}
