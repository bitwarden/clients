import { OpenOrgInviteLinkData } from "../models/open-organization-invite";

/**
 * Result contract for `OrganizationInviteService.unsealOpenOrgInvite`. The service
 * classifies unseal outcomes into typed kinds so consumers can `switch` exhaustively
 * instead of catching thrown errors and inspecting them.
 *
 * Kinds:
 *  - `ok` — unseal succeeded; carries the recovered invite triple.
 *  - `secret-miss` — no paired `HighEntropySecret` is stored for the email. Happens
 *    when the browser origin never sealed a value for this email, the entry was
 *    already consumed by a successful accept, or the TTL sweep pruned it.
 *  - `crypto-failure` — the SDK reported a `RegistrationError` with `Crypto` variant.
 *    The paired secret does not match the sealed blob, or the blob has been tampered.
 *  - `unexpected` — any other throw (non-`RegistrationError`, non-`Crypto` variant, or
 *    a runtime error crossing the WASM boundary). Carries a best-effort message so the
 *    caller can render something meaningful.
 */
export type UnsealOpenOrgInviteResult =
  | { kind: "ok"; invite: OpenOrgInviteLinkData }
  | { kind: "secret-miss" }
  | { kind: "crypto-failure" }
  | { kind: "unexpected"; errorMessage: string };

/**
 * Non-`ok` arms of {@link UnsealOpenOrgInviteResult}. Derived via `Exclude` so a new
 * failure kind added to the parent union automatically shows up here.
 */
export type UnsealOpenOrgInviteError = Exclude<UnsealOpenOrgInviteResult, { kind: "ok" }>;
