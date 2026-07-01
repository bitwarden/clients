import { UserId } from "../../../types/guid";
import { PolicyData } from "../../models/data/policy.data";

/**
 * Service for managing the `policiesNew` local state, which covers organizations the user is in an
 * accepted or confirmed status. This state backs {@link PolicyService.policiesByType$}, but the
 * SDK-based evaluation lives in the policy service; this service only owns writes to the state so
 * that it stays separate until we are ready to migrate.
 * This is internal to AC Team for now and should NOT BE USED by outside consumers.
 */
export abstract class InternalNewPolicyService {
  /** Upsert a single policy into the `policiesNew` local state. */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /** Replace all `policiesNew` local state for a user. */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
