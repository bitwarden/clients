import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Policy } from "../../models/domain/policy";
import { ResetPasswordPolicyOptions } from "../../models/domain/reset-password-policy-options";

/**
 * The primary service for retrieving and evaluating policies from sync data.
 */
export abstract class PolicyService {
  /**
   * All policies for the provided user from sync data.
   * May include policies that are disabled or otherwise do not apply to the user. Be careful using this!
   * Consider {@link policiesByType$} instead, which will only return policies that should be enforced against the user.
   */
  abstract policies$: (userId: UserId) => Observable<Policy[]>;

  /**
   * @returns all {@link Policy} objects of a given type that apply to the specified user.
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * @param policyType the {@link PolicyType} to search for
   * @param userId the {@link UserId} to search against
   */
  abstract policiesByType$: (policyType: PolicyType, userId: UserId) => Observable<Policy[]>;

  /**
   * @returns true if any policy of the specified type applies to the specified user, otherwise false.
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * This does not take into account the policy's configuration - if that is important, use {@link policiesByType$} to get the
   * {@link Policy} objects and then filter by Policy.data.
   */
  abstract policyAppliesToUser$: (policyType: PolicyType, userId: UserId) => Observable<boolean>;

  // Policy specific interfaces

  /**
   * Combines all Master Password policies that apply to the user.
   * If you are evaluating Master Password policies before the first sync has completed,
   * you must supply your own `policies` value.
   * @param userId The user against whom the policy needs to be enforced.
   * @param policies The policies to be evaluated; if null or undefined, it will default to using policies from sync data.
   * @returns a set of options which represent the minimum Master Password settings that the user must
   * comply with in order to comply with **all** applicable Master Password policies.
   */
  abstract masterPasswordPolicyOptions$: (
    userId: UserId,
    policies?: Policy[],
  ) => Observable<MasterPasswordPolicyOptions | undefined>;

  /**
   * Combines all Master Password policies that are passed in and returns
   * back the strongest combination of all the policies in the form of a
   * MasterPasswordPolicyOptions.
   * @param policies
   */
  abstract combinePoliciesIntoMasterPasswordPolicyOptions(
    policies: Policy[],
  ): MasterPasswordPolicyOptions | undefined;

  /**
   * Takes an arbitrary amount of Master Password Policy options in any form and merges them
   * together using the strictest combination of all of them.
   * @param masterPasswordPolicyOptions
   */
  abstract combineMasterPasswordPolicyOptions(
    ...masterPasswordPolicyOptions: MasterPasswordPolicyOptions[]
  ): MasterPasswordPolicyOptions | undefined;

  /**
   * Evaluates whether a proposed Master Password complies with all Master Password policies that apply to the user.
   */
  abstract evaluateMasterPassword: (
    passwordStrength: number,
    newPassword: string,
    enforcedPolicyOptions?: MasterPasswordPolicyOptions,
  ) => boolean;

  /**
   * @returns {@link ResetPasswordPolicyOptions} for the specified organization and a boolean indicating whether the policy
   * is enabled
   */
  abstract getResetPasswordPolicyOptions: (
    policies: Policy[],
    orgId: string,
  ) => [ResetPasswordPolicyOptions, boolean];
}

/**
 * An "internal" extension of the `PolicyService` which allows the update of policy data in the local sync data.
 * This does not update any policies on the server.
 */
export abstract class InternalPolicyService extends PolicyService {
  /**
   * Upsert a policy in the local sync data. This does not update any policies on the server.
   */
  abstract upsert: (policy: PolicyData, userId: UserId) => Promise<void>;
  /**
   * Replace a policy in the local sync data. This does not update any policies on the server.
   */
  abstract replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
  /**
   * Wrapper around upsert that uses account service to sync policies for the logged in user. This comes from
   * the server push notification to update local policies.
   */
  abstract syncPolicy: (payload: PolicyData) => Promise<void>;
}
