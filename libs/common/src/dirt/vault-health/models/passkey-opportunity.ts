import { CipherType } from "../../../vault/enums/cipher-type";

import { VaultHealthReportStatus } from "./vault-health-report-status";

/*
 * PENDING SDK: the three types below mirror `PasskeyCandidate`,
 * `PasskeyDirectoryEntry` and `PasskeyOpportunity` in sdk-internal
 * (crates/bitwarden-vault/src/cipher_risk/passkey.rs, camelCase on the wire).
 * Once a published `@bitwarden/sdk-internal` exports them, replace these
 * declarations with re-exports of the SDK types under the same names so
 * callers do not change.
 */

/**
 * The facts about one cipher the SDK needs to decide whether it is a passkey
 * opportunity. Deliberately unfiltered: eligibility (Login type, not deleted,
 * no passkey yet, password viewable) is the SDK's decision, so mobile and the
 * extension cannot disagree on it.
 */
export type PasskeyCandidate = {
  id: string;
  /** Serialized as its numeric value, which the SDK's `CipherType` shares. */
  type: CipherType;
  /** The login's non-null URIs, in the cipher's order. */
  uris: string[];
  hasFido2Credentials: boolean;
  isDeleted: boolean;
  viewPassword: boolean;
};

/** One site from the server's passkey directory. */
export type PasskeyDirectoryEntry = {
  domainName?: string;
  instructions?: string;
  supportsPasskeyLogin: boolean;
  supportsPasskeyMfa: boolean;
};

/** A login whose site supports passkeys and that has none saved yet. */
export type PasskeyOpportunity = {
  id: string;
  supportsPasskeyLogin: boolean;
  supportsPasskeyMfa: boolean;
  /** The site's passkey setup instructions; the clients only keep http(s) URLs. */
  instructions?: string;
};

/**
 * Where a user's passkey check is and its last result. Kept apart from
 * `VaultHealthReportState`: a passkey opportunity is not a risk, so it does not
 * count toward the at-risk score, and it depends on a directory fetch that can
 * fail without failing the health scan.
 *
 * `opportunities` stays put through `error` once a check has succeeded, so
 * results never flicker to null during a background refresh.
 */
export type PasskeyOpportunitiesState = {
  status: VaultHealthReportStatus;
  opportunities: PasskeyOpportunity[] | null;
};

/** The starting state, before any check has run. */
export const PASSKEY_OPPORTUNITIES_IDLE: PasskeyOpportunitiesState = Object.freeze({
  status: VaultHealthReportStatus.Idle,
  opportunities: null,
});
