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
 * The URI holds decrypted vault data (including the paired app's path), so it must never be logged.
 */
export class DesktopAutotypePairingUri {
  /** The version of the pairing URI format that new pairing URIs are created with. */
  static readonly CurrentVersion = "1.0.0";

  constructor(
    readonly version: string,
    readonly data: AutotypePairingData,
  ) {}

  /**
   * Recreates a pairing URI from a saved login URI string.
   *
   * @returns the pairing URI, or `null` if the string is not a valid pairing URI of a supported
   * version with data that adheres to a 1.x.y version of the Autotype Pairing Data Schema
   */
  static fromString(uri: string): DesktopAutotypePairingUri | null {
    try {
      // Throws if the pairing URI is not a valid URL
      new URL(uri);

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
      return isAutotypePairingData(data) ? new DesktopAutotypePairingUri(version, data) : null;
    } catch {
      // Invalid URLs, base64url, and JSON are all treated as "not a pairing URI"
      return null;
    }
  }

  /** Returns the pairing URI string to save as the login URI. */
  toString(): string {
    const params = new URLSearchParams({
      [VERSION_PARAM]: this.version,
      [DATA_PARAM]: Utils.fromUtf8ToUrlB64(JSON.stringify(this.data)),
    });
    return `${PAIRING_URI_BASE}${params.toString()}`;
  }
}
