import {
  flagEnabled as baseFlagEnabled,
  devFlagEnabled as baseDevFlagEnabled,
  devFlagValue as baseDevFlagValue,
  SharedFlags,
  SharedDevFlags,
} from "@bitwarden/common/platform/misc/flags";

import { GroupPolicyEnvironment } from "../admin-console/types/group-policy-environment";
import { QualificationEngineId } from "../autofill/qualification/types/engine-id";

// required to avoid linting errors when there are no flags
export type Flags = SharedFlags;

// required to avoid linting errors when there are no flags
export type DevFlags = {
  managedEnvironment?: GroupPolicyEnvironment;
  /**
   * Selects which autofill qualification engine to build. Set it in the
   * gitignored `apps/browser/config/local.json`. This is the only selection
   * source content scripts and the background have, since neither can await
   * the feature flag.
   */
  qualificationEngine?: QualificationEngineId;
} & SharedDevFlags;

export function flagEnabled(flag: keyof Flags): boolean {
  return baseFlagEnabled<Flags>(flag);
}

export function devFlagEnabled(flag: keyof DevFlags) {
  return baseDevFlagEnabled<DevFlags>(flag);
}

export function devFlagValue(flag: keyof DevFlags) {
  return baseDevFlagValue(flag);
}
