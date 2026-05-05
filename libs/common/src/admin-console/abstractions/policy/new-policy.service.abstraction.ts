import { UserId } from "../../../types/guid";
import { PolicyData } from "../../models/data/policy.data";

/**
 * Service for managing policy state and enforcement using the SDK.
 * Policies can be enforced in both accepted and confirmed statuses.
 * This is internal to AC Team for now and should NOT BE USED by outside consumers.
 */
export abstract class InternalNewPolicyService {
  /** Upsert a single policy into the `policiesNew` local state. */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /** Replace all `policiesNew` local state for a user. */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
