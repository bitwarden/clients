import { NEVER, Observable, distinctUntilChanged, map, of, shareReplay, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { isBetaChannel } from "./is-beta-channel";
import {
  BetaChannelStatus,
  BetaClientAccess,
  ReleaseChannelService,
} from "./release-channel.service";

/**
 * Reads the beta channel status from the `beta-channel-status` feature flag.
 *
 * The flag defaults to `closed`, so the status must not be read before any server config exists.
 * `betaChannelStatus$` waits until `serverConfig$` holds a config. On a first launch,
 * `serverConfig$` emits `null` when the first fetch is slow or fails, and reading the flag then
 * would report `Closed` and flash a block. A config without the key reports `Closed`, and so does
 * any value other than exactly `open` or `closing`. An offline launch uses the cached config.
 */
export class DefaultReleaseChannelService implements ReleaseChannelService {
  readonly betaChannelStatus$: Observable<BetaChannelStatus>;
  readonly betaClientAccess$: Observable<BetaClientAccess>;

  constructor(configService: ConfigService) {
    this.betaChannelStatus$ = configService.serverConfig$.pipe(
      map((serverConfig) => serverConfig != null),
      distinctUntilChanged(),
      switchMap((configLoaded) =>
        configLoaded ? configService.getFeatureFlag$(FeatureFlag.BetaChannelStatus) : NEVER,
      ),
      map(toBetaChannelStatus),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.betaClientAccess$ = isBetaChannel()
      ? this.betaChannelStatus$.pipe(map(toBetaClientAccess))
      : of(BetaClientAccess.Allowed);
  }
}

/** Maps the flag value to a status. Only exactly `open` and `closing` keep the channel open. */
function toBetaChannelStatus(value: unknown): BetaChannelStatus {
  switch (value) {
    case BetaChannelStatus.Open:
      return BetaChannelStatus.Open;
    case BetaChannelStatus.Closing:
      return BetaChannelStatus.Closing;
    default:
      return BetaChannelStatus.Closed;
  }
}

function toBetaClientAccess(status: BetaChannelStatus): BetaClientAccess {
  switch (status) {
    case BetaChannelStatus.Open:
      return BetaClientAccess.Allowed;
    case BetaChannelStatus.Closing:
      return BetaClientAccess.Warning;
    case BetaChannelStatus.Closed:
      return BetaClientAccess.Blocked;
  }
}
