import { KeyDefinition, OPEN_ORG_INVITE_DISK_LOCAL } from "../../../../platform/state";

/**
 * A per-email entry in the sealed-open-org-invite secret record. Pairs the base64
 * `HighEntropySecret` produced by the SDK's `seal_open_org_invite_data` with the wall-clock
 * timestamp of when it was stored, so the TTL sweep can prune abandoned entries.
 */
export interface SealedOpenOrgInviteSecretState {
  /** Standardized base64 encoding of the SDK-generated `HighEntropySecret`. */
  highEntropySecret: string;
  /** `Date.now()` at the moment the entry was written. Feeds the TTL sweep. */
  createdAtMs: number;
}

/**
 * Cleanup TTL, not a cryptographic expiry — the crypto remains valid regardless.
 *
 * Mirrors the server's 15-minute `RegistrationEmailVerificationTokenable` lifetime with 5
 * minutes of headroom so a barely-in-window registration-finish (server accepts at ~14:59)
 * does not fail acceptance because the paired `HighEntropySecret` was cleaned up mid-flight.
 *
 * Enforcement is opportunistic: the sweep only runs on web-app boot, so this bound only takes
 * effect if the user opens the vault again after expiry. Serves as defense-in-depth for the
 * client-side entries so abandoned registrations do not linger indefinitely.
 */
export const SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS = 20 * 60 * 1000;

/**
 * Email-keyed record of sealed-open-org-invite secrets. Lives in `disk-local` scope on web so
 * the entries are anchored to the browser origin (survive tab close / reload, isolated
 * cross-origin).
 */
export const EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL = KeyDefinition.record<
  SealedOpenOrgInviteSecretState,
  string
>(OPEN_ORG_INVITE_DISK_LOCAL, "emailSealedOpenOrgInviteSecretRecord", {
  deserializer: (entry) => entry,
});
