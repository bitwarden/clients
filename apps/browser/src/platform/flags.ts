import {
  flagEnabled as baseFlagEnabled,
  devFlagEnabled as baseDevFlagEnabled,
  devFlagValue as baseDevFlagValue,
  SharedFlags,
  SharedDevFlags,
} from "@bitwarden/common/platform/misc/flags";

export type Flags = {
  /**
   * Client rollout gate for managed-settings OS acquisition. Network-free
   * (build-time); defaults off via config/base.json. Distinct from the
   * `managedSettings` DevFlag (an in-code map for local emulation).
   */
  managedSettings?: boolean;
} & SharedFlags;

// required to avoid linting errors when there are no flags
export type DevFlags = {
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
