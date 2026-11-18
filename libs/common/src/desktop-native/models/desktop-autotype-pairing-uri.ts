import { Utils } from "../../platform/misc/utils";

import { AutotypePairingData, isAutotypePairingData } from "./autotype-pairing-data";

/** The prefix of every login URI that pairs the login with a desktop app. */
export const DESKTOP_APP_URI_PREFIX = "desktopapp://";

// Everything before the query of a pairing URI. The scheme and host are matched as this exact
// string rather than read from a parsed `URL`, because browsers don't all parse the host and path
// of custom schemes per the URL spec (e.g. Firefox before 122 reports an empty host).
const PAIRING_URI_BASE = `${DESKTOP_APP_URI_PREFIX}autotype?`;
const VERSION_PARAM = "version";
const DATA_PARAM = "data";

// Only major version 1 of the pairing URI format is supported.
const SUPPORTED_VERSION_PATTERN = /^1\.\d+\.\d+$/;

/**
 * A Desktop Autotype Pairing URI, saved as a login URI to pair the login with a desktop app for
 * Autotype:
 *
 * `desktopapp://autotype?version=<version>&data=<data>`
 *
 * - `version` is the SemVer version of this URI format.
 * - `data` is the {@link AutotypePairingData}, stored as unpadded base64url encoded UTF-8 JSON.
 *
 * Every 1.x.y version of this format stays compatible with 1.0.0: a later version may only add
 * optional query parameters. Query parameters this client doesn't recognize are kept as
 * {@link unknownParams} and written back by {@link toString}, like unknown properties in the data.
 *
 * The URI holds decrypted vault data (including the paired app's path), so it must never be logged.
 */
export class DesktopAutotypePairingUri {
  /** The version of the pairing URI format that new pairing URIs are created with. */
  static readonly CurrentVersion = "1.0.0";

  /**
   * @param version the SemVer version of this URI format
   * @param data the app pairing data
   * @param unknownParams the query parameters other than `version` and `data`, as `[name, value]`
   * pairs in their original order, from a pairing URI written by a later 1.x version
   */
  constructor(
    readonly version: string,
    readonly data: AutotypePairingData,
    readonly unknownParams: ReadonlyArray<readonly [string, string]> = [],
  ) {}

  /**
   * Recreates a pairing URI from a saved login URI string.
   *
   * @returns the pairing URI, or `null` if the string is not a valid pairing URI of a supported
   * version with data that adheres to a 1.x.y version of the Autotype Pairing Data Schema
   */
  static fromString(uri: string): DesktopAutotypePairingUri | null {
    try {
      if (!uri.startsWith(PAIRING_URI_BASE) || uri.includes("#")) {
        return null;
      }

      const params = new URLSearchParams(uri.slice(PAIRING_URI_BASE.length));
      const version = params.get(VERSION_PARAM);
      const encodedData = params.get(DATA_PARAM);
      if (version == null || !SUPPORTED_VERSION_PATTERN.test(version) || encodedData == null) {
        return null;
      }

      const data: unknown = JSON.parse(Utils.fromUrlB64ToUtf8(encodedData));
      if (!isAutotypePairingData(data)) {
        return null;
      }

      // Only the first `version` and `data` are used, so repeats of them are not kept
      const unknownParams = [...params].filter(
        ([name]) => name !== VERSION_PARAM && name !== DATA_PARAM,
      );
      return new DesktopAutotypePairingUri(version, data, unknownParams);
    } catch {
      // Invalid base64url and JSON, and non-strings at runtime, are treated as "not a pairing URI"
      return null;
    }
  }

  /**
   * Returns the pairing URI string to save as the login URI: `version`, then `data`, then any
   * unknown query parameters.
   */
  toString(): string {
    const params = new URLSearchParams({
      [VERSION_PARAM]: this.version,
      [DATA_PARAM]: Utils.fromUtf8ToUrlB64(JSON.stringify(this.data)),
    });
    this.unknownParams.forEach(([name, value]) => params.append(name, value));
    return `${PAIRING_URI_BASE}${params.toString()}`;
  }
}
