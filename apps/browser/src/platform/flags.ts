import {
  flagEnabled as baseFlagEnabled,
  devFlagEnabled as baseDevFlagEnabled,
  devFlagValue as baseDevFlagValue,
  SharedFlags,
  SharedDevFlags,
} from "@bitwarden/common/platform/misc/flags";

import { GroupPolicyEnvironment } from "../admin-console/types/group-policy-environment";

// required to avoid linting errors when there are no flags
// eslint-disable-next-line @typescript-eslint/ban-types
export type Flags = {
  accountSwitching?: boolean;
} & SharedFlags;

// required to avoid linting errors when there are no flags
// eslint-disable-next-line @typescript-eslint/ban-types
export type DevFlags = {
  managedEnvironment?: GroupPolicyEnvironment;
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

/** Helper method to sync flag specifically for account switching, which as platform-based values.
 * If this pattern needs to be repeated, it's better handled by increasing complexity of webpack configurations
 * Not by expanding these flag getters.
 */
export function enableAccountSwitching(): boolean {
  return flagEnabled("accountSwitching");
}
