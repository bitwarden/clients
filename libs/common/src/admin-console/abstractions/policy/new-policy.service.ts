import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { PolicyData } from "../../models/data/policy.data";
import { Policy } from "../../models/domain/policy";

/**
 * Used for managing local policy state where the user is
 * in either the accepted or confirmed states.
 * This is internal to AC Team for now and should NOT BE USED by outside consumers.
 */
export abstract class InternalNewPolicyService {
  /** @returns all {@link Policy} objects for organizations in which the user is accepted or confirmed. */
  abstract policies$: (userId: UserId) => Observable<Policy[]>;
  /** Upsert a single policy into the `policiesNew` local state. */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /** Replace all `policiesNew` local state for a user. */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
