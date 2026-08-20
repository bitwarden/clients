import { OpenOrgInviteLinkData } from "../models/open-organization-invite";

/**
 * Result contract for `OrganizationInviteService.unsealOpenOrgInvite`. The service
 * classifies outcomes into typed kinds so consumers can `switch` exhaustively instead
 * of catching thrown errors and inspecting them.
 *
 * Kinds:
 *  - `ok` — unseal succeeded; carries the recovered invite triple.
 *  - `secret-miss` — no paired `HighEntropySecret` is stored for the email. Happens
 *    when the browser origin never sealed a value for this email, the entry was
 *    already consumed by a successful accept, or the TTL sweep pruned it.
 *  - `crypto-failure` — the SDK reported a `RegistrationError` with `Crypto` variant;
 *    the paired secret does not match the sealed blob, or the blob has been tampered.
 *  - `unexpected` — fallback for unclassified throws; `errorMessage` carries a
 *    best-effort string.
 */
export type OpenOrgInviteUnsealResult =
  | { kind: "ok"; invite: OpenOrgInviteLinkData }
  | { kind: "secret-miss" }
  | { kind: "crypto-failure" }
  | { kind: "unexpected"; errorMessage: string };

/**
 * Error arms of {@link OpenOrgInviteUnsealResult} — derived via `Exclude` so a new
 * failure kind added to the parent union automatically shows up here.
 */
export type OpenOrgInviteUnsealError = Exclude<OpenOrgInviteUnsealResult, { kind: "ok" }>;
