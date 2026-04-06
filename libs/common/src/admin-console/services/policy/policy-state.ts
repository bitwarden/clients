import { POLICIES_DISK, UserKeyDefinition } from "../../../platform/state";
import { PolicyId } from "../../../types/guid";
import { PolicyData } from "../../models/data/policy.data";

export const POLICIES = UserKeyDefinition.record<PolicyData, PolicyId>(POLICIES_DISK, "policies", {
  deserializer: (policyData) => policyData,
  clearOn: ["logout"],
});
