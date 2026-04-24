import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { PolicyData } from "../../models/data/policy.data";
import { Policy } from "../../models/domain/policy";

/**
 * Service for managing the new policy format (`policiesNew`) received from the server.
 * This is kept separate from {@link PolicyService} so that old and new policy state can
 * evolve independently, and so the SDK integration can be added here without touching
 * existing policy logic.
 */
export abstract class NewPolicyService {
  /**
   * Policies from the `policiesNew` sync response that belong to organizations where
   * the user is in the Accepted (not yet Confirmed) membership status.
   */
  abstract acceptedPolicies$: (userId: UserId) => Observable<Policy[]>;
}

/**
 * An "internal" extension of {@link NewPolicyService} that allows updating the local
 * `policiesNew` state. This does not update any policies on the server.
 */
export abstract class InternalNewPolicyService extends NewPolicyService {
  /** Upsert a single policy into the `policiesNew` local state. */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /** Replace all `policiesNew` local state for a user. */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
