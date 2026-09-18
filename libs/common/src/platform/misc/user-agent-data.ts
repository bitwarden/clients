/**
 * A single entry of the low-entropy brand list exposed by the User-Agent Client Hints API.
 *
 * The list always contains a randomized "GREASE" entry (e.g. `Not=A?Brand`) alongside the
 * real brands, so callers must look for the brand they care about rather than assuming a
 * position in the list.
 */
interface UserAgentBrand {
  brand: string;
  version: string;
}

/**
 * The subset of `NavigatorUAData` we rely on. TypeScript's `dom` lib does not declare
 * `navigator.userAgentData`, so we describe just the low-entropy surface here instead of
 * augmenting the global `Navigator` type.
 */
interface UserAgentData {
  brands?: UserAgentBrand[];
}

/**
 * Returns true when the current browser reports the given brand in
 * `navigator.userAgentData.brands`.
 *
 * `brands` is the *low-entropy* portion of the User-Agent Client Hints API, which means it
 * is available synchronously — no `getHighEntropyValues()` call, and therefore no need to
 * make callers async.
 *
 * The API is Chromium-only, is gated to secure contexts, and is absent in Firefox and
 * Safari, so every access is guarded and this returns false wherever it is unavailable.
 *
 * @param brand The brand to look for, matched exactly (e.g. `"DuckDuckGo"`).
 */
export function hasUserAgentBrand(brand: string): boolean {
  // `navigator` is a `WorkerNavigator` in the extension's service worker context, which
  // also implements `userAgentData`.
  const userAgentData: UserAgentData | undefined = (
    globalThis.navigator as Navigator & { userAgentData?: UserAgentData }
  )?.userAgentData;

  return userAgentData?.brands?.some((b) => b.brand === brand) ?? false;
}
