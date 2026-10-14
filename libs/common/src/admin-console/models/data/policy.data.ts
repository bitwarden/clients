import { Policy as SdkPolicy } from "@bitwarden/sdk-internal";

import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyResponse } from "../response/policy.response";

export class PolicyData {
  id: PolicyId;
  organizationId: string;
  type: PolicyType;
  data: Record<string, string | number | boolean> | null;
  enabled: boolean;
  revisionDate: string | undefined;

  constructor(response: PolicyResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.type = response.type;
    this.data = response.data;
    this.enabled = response.enabled;
    this.revisionDate = response.revisionDate;
  }

  /**
   * Static rather than instance methods because policy state is stored and deserialized as
   * plain objects, not `PolicyData` instances.
   */
  static fromSdk(obj: SdkPolicy): PolicyData {
    return {
      id: uuidAsString(obj.id) as PolicyId,
      organizationId: uuidAsString(obj.organizationId),
      type: obj.type,
      data: obj.data == null ? null : JSON.parse(obj.data),
      enabled: obj.enabled,
      revisionDate: obj.revisionDate,
    };
  }

  static toSdk(data: PolicyData): SdkPolicy {
    return {
      id: asUuid(data.id),
      organizationId: asUuid(data.organizationId),
      type: data.type,
      data: data.data == null ? undefined : JSON.stringify(data.data),
      enabled: data.enabled,
      revisionDate: data.revisionDate,
    };
  }
}
