import {
  flagEnabled as baseFlagEnabled,
  devFlagEnabled as baseDevFlagEnabled,
  devFlagValue as baseDevFlagValue,
  SharedFlags,
  SharedDevFlags,
} from "@bitwarden/common/platform/misc/flags";

import { GroupPolicyEnvironment } from "../admin-console/types/group-policy-environment";

// required to avoid linting errors when there are no flags
export type Flags = SharedFlags;

// required to avoid linting errors when there are no flags
export type DevFlags = {
  managedEnvironment?: GroupPolicyEnvironment;
  /** Dev-only: an in-code managed-settings map (dotted key -> value) pushed at boot. */
  managedSettings?: Record<string, unknown>;
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
