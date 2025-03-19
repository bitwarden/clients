// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Policy } from "../../models/domain/policy";
import { ResetPasswordPolicyOptions } from "../../models/domain/reset-password-policy-options";

export abstract class PolicyService {
  /**
   * All policies for the active user from sync data.
   * May include policies that are disabled or otherwise do not apply to the user. Be careful using this!
   * Consider using {@link get$} or {@link getAll$} instead, which will only return policies that should be enforced against the user.
   */
  policies$: Observable<Policy[]>;

  /**
   * @returns the first {@link Policy} found that applies to the active user.
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * @param policyType the {@link PolicyType} to search for
   * @see {@link getAll$} if you need all policies of a given type
   */
  get$: (policyType: PolicyType) => Observable<Policy>;

  /**
   * @returns all {@link Policy} objects of a given type that apply to the specified user (or the active user if not specified).
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * @param policyType the {@link PolicyType} to search for
   */
  getAll$: (policyType: PolicyType, userId: UserId) => Observable<Policy[]>;

  /**
   * All {@link Policy} objects for the specified user (from sync data).
   * May include policies that are disabled or otherwise do not apply to the user.
   * Consider using {@link getAll$} instead, which will only return policies that should be enforced against the user.
   */
  getAll: (policyType: PolicyType) => Promise<Policy[]>;

  /**
   * @returns true if a policy of the specified type applies to the active user, otherwise false.
   * A policy "applies" if it is enabled and the user is not exempt (e.g. because they are an Owner).
   * This does not take into account the policy's configuration - if that is important, use {@link getAll$} to get the
   * {@link Policy} objects and then filter by Policy.data.
   */
  policyAppliesToActiveUser$: (policyType: PolicyType) => Observable<boolean>;

  policyAppliesToUser: (policyType: PolicyType) => Promise<boolean>;

  // Policy specific interfaces

  /**
   * Combines all Master Password policies that apply to the user.
   * @returns a set of options which represent the minimum Master Password settings that the user must
   * comply with in order to comply with **all** Master Password policies.
   */
  masterPasswordPolicyOptions$: (policies?: Policy[]) => Observable<MasterPasswordPolicyOptions>;

  /**
   * Evaluates whether a proposed Master Password complies with all Master Password policies that apply to the user.
   */
  evaluateMasterPassword: (
    passwordStrength: number,
    newPassword: string,
    enforcedPolicyOptions?: MasterPasswordPolicyOptions,
  ) => boolean;

  /**
   * @returns Reset Password policy options for the specified organization and a boolean indicating whether the policy
   * is enabled
   */
  getResetPasswordPolicyOptions: (
    policies: Policy[],
    orgId: string,
  ) => [ResetPasswordPolicyOptions, boolean];
}

export abstract class InternalPolicyService extends PolicyService {
  upsert: (policy: PolicyData) => Promise<void>;
  replace: (policies: { [id: string]: PolicyData }, userId: UserId) => Promise<void>;
}
