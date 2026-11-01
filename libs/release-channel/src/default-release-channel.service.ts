import { NEVER, Observable, distinctUntilChanged, map, of, shareReplay, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { flagEnabled } from "@bitwarden/common/platform/misc/flags";

import {
  BetaStatus,
  ReleaseChannel,
  ReleaseChannelService,
  ReleaseChannelType,
} from "./release-channel.service";

/**
 * Reads the beta status from the `beta-channel-status` feature flag. A build without the
 * `prereleaseBuild` flag is a production build and never reads `beta-channel-status`.
 *
 * The flag defaults to `blocked`, so a beta must not read it before any server config exists.
 * `channel$` waits until `serverConfig$` holds a config. On a first launch, `serverConfig$` emits
 * `null` when the first fetch is slow or fails, and reading the flag then would flash `Blocked`.
 * A config without the key blocks, and so does any value other than exactly `active` or
 * `warning`. An offline launch uses the cached config.
 */
export class DefaultReleaseChannelService implements ReleaseChannelService {
  readonly channel$: Observable<ReleaseChannel>;

  constructor(configService: ConfigService) {
    if (!flagEnabled("prereleaseBuild")) {
      this.channel$ = of({ type: ReleaseChannelType.Production });
      return;
    }

    this.channel$ = configService.serverConfig$.pipe(
      map((serverConfig) => serverConfig != null),
      distinctUntilChanged(),
      switchMap((configLoaded) =>
        configLoaded ? configService.getFeatureFlag$(FeatureFlag.BetaChannelStatus) : NEVER,
      ),
      map(toBetaStatus),
      distinctUntilChanged(),
      map((status): ReleaseChannel => ({ type: ReleaseChannelType.Beta, status })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}

/** Maps the flag value to a status. Only exactly `active` and `warning` keep a beta running. */
function toBetaStatus(value: unknown): BetaStatus {
  switch (value) {
    case BetaStatus.Active:
      return BetaStatus.Active;
    case BetaStatus.Warning:
      return BetaStatus.Warning;
    default:
      return BetaStatus.Blocked;
  }
}
