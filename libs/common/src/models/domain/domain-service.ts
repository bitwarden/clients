import { UriMatchType } from "@bitwarden/sdk-internal";

/*
  See full documentation at:
    https://bitwarden.com/help/uri-match-detection/#match-detection-options

  Domain: "the top-level domain and second-level domain of the URI match the detected resource",
  Host: "the hostname and (if specified) port of the URI matches the detected resource",
  StartsWith: "the detected resource starts with the URI, regardless of what follows it",
  Exact: "the URI matches the detected resource exactly",
  RegularExpression: "the detected resource matches a specified regular expression",
  Never: "never offer auto-fill for the item",
*/
export const UriMatchStrategy = {
  Domain: 0,
  Host: 1,
  StartsWith: 2,
  Exact: 3,
  RegularExpression: 4,
  Never: 5,
} as const;

export type UriMatchStrategySetting = (typeof UriMatchStrategy)[keyof typeof UriMatchStrategy];

// using uniqueness properties of object shape over Set for ease of state storability
export type NeverDomains = { [id: string]: null | { bannerIsDismissed?: boolean } };
export type EquivalentDomains = string[][];

/**
 * Normalizes UriMatchStrategySetting for SDK mapping.
 * @param value - The URI match strategy from user data
 * @returns Valid UriMatchType or undefined if invalid
 */
export function normalizeUriMatchStrategyForSdk(
  value: UriMatchStrategySetting | undefined,
): UriMatchType | undefined {
  if (value == null) {
    return undefined;
  }

  switch (value) {
    case 0: // Domain
    case 1: // Host
    case 2: // StartsWith
    case 3: // Exact
    case 4: // RegularExpression
    case 5: // Never
      return value;
    default:
      return undefined;
  }
}
