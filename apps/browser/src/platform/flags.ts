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
  /** PROTOTYPE (agent autofill): native messaging host name for dev builds. */
  nativeMessagingHostName?: string;
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

const DEFAULT_NATIVE_MESSAGING_HOST = "com.8bit.bitwarden";

/**
 * PROTOTYPE (agent autofill): the native messaging host the extension connects to. Dev builds can
 * set `devFlags.nativeMessagingHostName` (e.g. in `config/local.json`) so a dev extension and a
 * debug desktop app pair up without touching the installed desktop app's host registration.
 */
export function nativeMessagingHostName(): string {
  if (devFlagEnabled("nativeMessagingHostName")) {
    return devFlagValue("nativeMessagingHostName") as string;
  }
  return DEFAULT_NATIVE_MESSAGING_HOST;
}
