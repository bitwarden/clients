import {
  flagEnabled as baseFlagEnabled,
  devFlagEnabled as baseDevFlagEnabled,
  devFlagValue as baseDevFlagValue,
  SharedFlags,
  SharedDevFlags,
} from "@bitwarden/common/platform/misc/flags";

import { GroupPolicyEnvironment } from "../admin-console/types/group-policy-environment";

import { BrowserApi } from "./browser/browser-api";

// required to avoid linting errors when there are no flags
export type Flags = {
  accountSwitching?: boolean;
} & SharedFlags;

// required to avoid linting errors when there are no flags
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
  if (BrowserApi.isSafariApi) {
    return false;
  }
  return flagEnabled("accountSwitching");
}
