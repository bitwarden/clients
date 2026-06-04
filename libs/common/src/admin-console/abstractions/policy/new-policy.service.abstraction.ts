import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { Policy } from "../../models/domain/policy";

/**
 * Service for managing policy state and enforcement using the SDK,
 * including use of accepted-state policy data.
 * Policies can be enforced in both accepted and confirmed statuses.
 * This is internal to AC Team for now and should NOT BE USED by outside consumers.
 */
export abstract class InternalNewPolicyService {
  /**
   * @returns all {@link Policy} objects of a given type that apply to the specified user.
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * @param policyType the {@link PolicyType} to search for
   * @param userId the {@link UserId} to search against
   */
  abstract policiesByType$: (policyType: PolicyType, userId: UserId) => Observable<Policy[]>;
  /** Upsert a single policy into the `policiesNew` local state. */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /** Replace all `policiesNew` local state for a user. */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
