// required to avoid linting errors when there are no flags
// eslint-disable-next-line @typescript-eslint/ban-types
export type SharedFlags = {
  showPasswordless?: boolean;
  enableCipherKeyEncryption?: boolean;
};

// required to avoid linting errors when there are no flags
// eslint-disable-next-line @typescript-eslint/ban-types
export type SharedDevFlags = {
  noopNotifications: boolean;
  skipWelcomeOnInstall: boolean;
  configRetrievalIntervalMs: number;
};

function getFlags<T>(envFlags: string | T): T {
  if (typeof envFlags === "string") {
    return JSON.parse(envFlags) as T;
  } else {
    return envFlags as T;
  }
}

/**
 * Gets the value of a feature flag from environment.
 * All flags default to "on" (true).
 * Only use for shared code in `libs`, otherwise use the client-specific function.
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
 * Only use for shared code in `libs`, otherwise use the client-specific function.
 * @param flag The name of the dev flag to check
 * @returns The value of the flag
 */
export function devFlagEnabled<DevFlags extends SharedDevFlags>(flag: keyof DevFlags): boolean {
  if (process.env.ENV !== "development") {
    return false;
  }

  const devFlags = getFlags<DevFlags>(process.env.DEV_FLAGS);
  return devFlags?.[flag] == null ? false : !!devFlags[flag];
}

/**
 * Gets the value of a dev flag from environment.
 * Will always return false unless in development.
 * @param flag The name of the dev flag to check
 * @returns The value of the flag
 * @throws Error if the flag is not enabled
 */
export function devFlagValue<DevFlags extends SharedDevFlags>(
  flag: keyof DevFlags,
): DevFlags[keyof DevFlags] {
  if (!devFlagEnabled(flag)) {
    throw new Error(`This method should not be called, it is protected by a disabled dev flag.`);
  }

  const devFlags = getFlags<DevFlags>(process.env.DEV_FLAGS);
  return devFlags[flag];
}
