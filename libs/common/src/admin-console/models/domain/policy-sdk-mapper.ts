import { Policy as SdkPolicy } from "@bitwarden/sdk-internal";

import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import { SdkRecordMapper } from "../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../platform/state";
import { PolicyId } from "../../../types/guid";
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
    return {
      id: asUuid(value.id),
      organizationId: asUuid(value.organizationId),
      type: value.type,
      data: value.data == null ? undefined : JSON.stringify(value.data),
      enabled: value.enabled,
      revisionDate: value.revisionDate,
    };
  }

  fromSdk(value: SdkPolicy): PolicyData {
    // This is never null, but the SDK has not yet been updated to make it non-optional.
    if (value.revisionDate == null) {
      throw new Error("Null policy revision date.");
    }

    return {
      id: uuidAsString(value.id) as PolicyId,
      organizationId: uuidAsString(value.organizationId),
      type: value.type,
      data: value.data == null ? null : JSON.parse(value.data),
      enabled: value.enabled,
      revisionDate: value.revisionDate,
    };
  }
}
