// required to avoid linting errors when there are no feature flags
/* eslint-disable @typescript-eslint/ban-types */

export type SharedFlags = {
  useWebWorkers: boolean;
};

export type SharedDevFlags = {};

function getFlags<T>(envFlags: string | T): T {
  if (typeof envFlags === "string") {
    return JSON.parse(envFlags) as T;
  } else {
    return envFlags as T;
  }
}

/**
 * Gets the value of a feature flag from environment.
 * All flags default to "on" (true)
 * @param flag The name of the feature flag to check
 * @returns The value of the flag
 */
export function flagEnabled<Flags extends SharedFlags>(flag: keyof Flags): boolean {
  const flags = getFlags<Flags>(process.env.FLAGS);
  return flags[flag] == null || !!flags[flag];
}

/**
 * Gets the value of a dev flag from environment.
 * Will always return false unless in development.
 * @param flag The name of the dev flag to check
 * @returns The value of the flag
 */
export function devFlagEnabled<DevFlags extends SharedDevFlags>(flag: keyof DevFlags): boolean {
  if (process.env.ENV !== "development") {
    return false;
  }

  const devFlags = getFlags<DevFlags>(process.env.DEV_FLAGS);
  return devFlags[flag] == null || !!devFlags[flag];
}

export function getDevFlagValue<DevFlags extends SharedFlags, TKey extends keyof DevFlags>(
  flag: TKey
): DevFlags[TKey] {
  const devFlags = getFlags<DevFlags>(process.env.DEV_FLAGS);
  return devFlags[flag] as DevFlags[TKey];
}
