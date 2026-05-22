// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// required to avoid linting errors when there are no flags
export type SharedFlags = {
  sdk?: boolean;
  prereleaseBuild?: boolean;
};

// required to avoid linting errors when there are no flags
export type SharedDevFlags = {
  noopNotifications: boolean;
  skipWelcomeOnInstall: boolean;
  configRetrievalIntervalMs: number;
  showRiskInsightsDebug: boolean;
  testPhishingUrls: string[];
};

function getFlags<T>(envFlags: string | T): T {
  if (typeof envFlags === "string") {
    return JSON.parse(envFlags) as T;
  } else {
    return envFlags as T;
  }
}

type Channel = "all" | "stable" | "beta";
type ChannelFlags<T> = Partial<Record<Channel, Partial<T>>>;

function resolveChannelFlag<T, K extends keyof T>(
  flags: ChannelFlags<T> | undefined,
  flag: K,
): T[K] | undefined {
  const channelValue = flags?.[BIT_RELEASE_CHANNEL]?.[flag];
  if (channelValue != null) {
    return channelValue as T[K];
  }
  return flags?.all?.[flag] as T[K] | undefined;
}

/**
 * Gets the value of a feature flag from environment.
 * All flags default to "on" (true).
 * A channel-specific entry (`stable` / `beta`) takes precedence over `all`.
 * Only use for shared code in `libs`, otherwise use the client-specific function.
 * @param flag The name of the feature flag to check
 * @returns The value of the flag
 */
export function flagEnabled<Flags extends SharedFlags>(flag: keyof Flags): boolean {
  const flags = getFlags<ChannelFlags<Flags>>(process.env.FLAGS);
  const value = resolveChannelFlag(flags, flag);
  return value == null || !!value;
}

/**
 * Gets the value of a dev flag from environment.
 * Will always return false unless in development.
 * A channel-specific entry (`stable` / `beta`) takes precedence over `all`.
 * Only use for shared code in `libs`, otherwise use the client-specific function.
 * @param flag The name of the dev flag to check
 * @returns The value of the flag
 */
export function devFlagEnabled<DevFlags extends SharedDevFlags>(flag: keyof DevFlags): boolean {
  if (process.env.ENV !== "development") {
    return false;
  }

  const devFlags = getFlags<ChannelFlags<DevFlags>>(process.env.DEV_FLAGS);
  const value = resolveChannelFlag(devFlags, flag);
  return value == null ? false : !!value;
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

  const devFlags = getFlags<ChannelFlags<DevFlags>>(process.env.DEV_FLAGS);
  return resolveChannelFlag(devFlags, flag) as DevFlags[keyof DevFlags];
}
