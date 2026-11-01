import { Observable } from "rxjs";

import { ReleaseChannelType } from "@bitwarden/common/platform/misc/release-channel-type";

/**
 * Where a beta build is in its sunset. Only a {@link BetaChannel} has a status.
 *
 * - `Active`: the beta works normally.
 * - `Warning`: show the sunset warning.
 * - `Blocked`: block all vault access.
 */
export const BetaStatus = Object.freeze({
  Active: "active",
  Warning: "warning",
  Blocked: "blocked",
} as const);
export type BetaStatus = (typeof BetaStatus)[keyof typeof BetaStatus];

/** A production build. It never warns or blocks. */
export type ProductionChannel = { readonly type: typeof ReleaseChannelType.Production };

/** A beta build and where it is in its sunset. */
export type BetaChannel = {
  readonly type: typeof ReleaseChannelType.Beta;
  readonly status: BetaStatus;
};

/** Narrow on `type` to read the beta status. */
export type ReleaseChannel = ProductionChannel | BetaChannel;

/**
 * Exposes the release channel a client was built for and, for a beta, where it is in its lifetime.
 *
 * The channel type is fixed at build time. The beta status comes from the `beta-channel-status`
 * feature flag in the server config. Product moves the flag from warning to blocked when it
 * chooses, so the status carries no date.
 */
export abstract class ReleaseChannelService {
  /**
   * The release channel. A production build always emits a {@link ProductionChannel}. A beta build
   * emits a {@link BetaChannel} and emits again when the server config changes the flag.
   */
  abstract readonly channel$: Observable<ReleaseChannel>;
}
