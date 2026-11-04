import { Observable } from "rxjs";

/**
 * The status of Bitwarden's beta channel in the connected environment, from the server's
 * `beta-channel-status` feature flag. This is a property of the environment, not of the client.
 *
 * - `Open`: beta clients work normally.
 * - `Closing`: the beta channel is closing. Beta clients warn.
 * - `Closed`: the beta channel is closed. Beta clients are blocked.
 */
export const BetaChannelStatus = Object.freeze({
  Open: "open",
  Closing: "closing",
  Closed: "closed",
} as const);
export type BetaChannelStatus = (typeof BetaChannelStatus)[keyof typeof BetaChannelStatus];

/**
 * Whether this client may be used, combining its release channel with the beta channel status.
 *
 * - `Allowed`: use the client normally.
 * - `Warning`: show the beta closing warning.
 * - `Blocked`: block all vault access.
 */
export const BetaClientAccess = Object.freeze({
  Allowed: "allowed",
  Warning: "warning",
  Blocked: "blocked",
} as const);
export type BetaClientAccess = (typeof BetaClientAccess)[keyof typeof BetaClientAccess];

/**
 * Exposes the status of the environment's beta channel, and whether this client may be used.
 *
 * Whether the client itself is on the beta channel is fixed at build time. Read it with
 * `isBetaChannel()`.
 */
export abstract class ReleaseChannelService {
  /**
   * The status of the connected environment's beta channel, for every client. Emits with the
   * server config, and again when the server config changes the flag. It fails open: anything
   * other than an explicit `closing` or `closed` reports `Open`.
   */
  abstract readonly betaChannelStatus$: Observable<BetaChannelStatus>;

  /**
   * Whether this client may be used. A production client is always `Allowed`. A beta client
   * follows `betaChannelStatus$`: `Open` is `Allowed`, `Closing` is `Warning`, and `Closed` is
   * `Blocked`. Warning and block surfaces read this.
   */
  abstract readonly betaClientAccess$: Observable<BetaClientAccess>;
}
