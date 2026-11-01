import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, distinctUntilChanged, firstValueFrom, map } from "rxjs";

import {
  AllowedFeatureFlagTypes,
  FeatureFlag,
  getFeatureFlagValue,
} from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { ServerConfigData } from "@bitwarden/common/platform/models/data/server-config.data";

import { DefaultReleaseChannelService } from "./default-release-channel.service";
import {
  BetaChannel,
  BetaStatus,
  ReleaseChannel,
  ReleaseChannelType,
} from "./release-channel.service";

describe("DefaultReleaseChannelService", () => {
  let configService: MockProxy<ConfigService>;
  let serverConfig: BehaviorSubject<ServerConfig | null>;

  const beta = (status: BetaStatus): BetaChannel => ({ type: ReleaseChannelType.Beta, status });

  /** A server config with the given feature states. */
  const config = (featureStates: Record<string, AllowedFeatureFlagTypes> = {}) =>
    new ServerConfig(new ServerConfigData({ featureStates }));

  /** A server config that serves `value` for `beta-channel-status`. */
  const withStatus = (value: AllowedFeatureFlagTypes) =>
    config({ [FeatureFlag.BetaChannelStatus]: value });

  /** Collects every value `channel$` emits until the test ends. */
  const record = (sut: DefaultReleaseChannelService) => {
    const emissions: ReleaseChannel[] = [];
    const subscription = sut.channel$.subscribe((channel) => emissions.push(channel));
    return { emissions, subscription };
  };

  beforeEach(() => {
    serverConfig = new BehaviorSubject<ServerConfig | null>(null);
    configService = mock<ConfigService>();
    configService.serverConfig$ = serverConfig.asObservable();
    // Resolve flags the way DefaultConfigService does: server value, else the default.
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      serverConfig.pipe(
        map((current) => getFeatureFlagValue(current, flag)),
        distinctUntilChanged(),
      )) as unknown as ConfigService["getFeatureFlag$"]);
  });

  /** Sets the build-time flags the way `CHANNEL=beta` and production builds inject them. */
  const setPrereleaseBuild = (prereleaseBuild: boolean) => {
    process.env.FLAGS = JSON.stringify({ prereleaseBuild });
  };

  afterEach(() => {
    process.env.FLAGS = JSON.stringify({});
  });

  describe("given a production build", () => {
    it.each([
      ["without prereleaseBuild", JSON.stringify({})],
      ["with prereleaseBuild off", JSON.stringify({ prereleaseBuild: false })],
      ["with no FLAGS", undefined],
    ])("emits the production channel %s, whatever the flag says", async (_, flags) => {
      if (flags === undefined) {
        delete process.env.FLAGS;
      } else {
        process.env.FLAGS = flags;
      }
      serverConfig.next(withStatus("blocked"));

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual({
        type: ReleaseChannelType.Production,
      });
      expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
    });

    it("emits the production channel before any server config exists", async () => {
      setPrereleaseBuild(false);
      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual({ type: ReleaseChannelType.Production });
    });
  });

  describe("given a beta build", () => {
    beforeEach(() => {
      setPrereleaseBuild(true);
    });

    it("emits nothing while no server config exists", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(null);

      expect(emissions).toEqual([]);
      expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });

    it("emits the served status once the first server config loads, without a Blocked flash", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(withStatus("active"));

      expect(emissions).toEqual([beta(BetaStatus.Active)]);
      subscription.unsubscribe();
    });

    it("blocks when the server config does not include the key", async () => {
      serverConfig.next(config());

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual(beta(BetaStatus.Blocked));
    });

    it.each([
      ["active", BetaStatus.Active],
      ["warning", BetaStatus.Warning],
      ["blocked", BetaStatus.Blocked],
    ])("maps the served status %p to %s", async (value, status) => {
      serverConfig.next(withStatus(value));

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual(beta(status));
    });

    it.each([
      ["an unknown value", "unknown"],
      ["different casing", "Active"],
      ["different casing", "WARNING"],
      ["an empty string", ""],
      ["a value with whitespace", " active"],
      ["a boolean", true],
      ["a number", 1],
    ])("blocks for %s (%p)", async (_, value) => {
      serverConfig.next(withStatus(value));

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual(beta(BetaStatus.Blocked));
    });

    it("emits again when the server config changes the flag", () => {
      serverConfig.next(withStatus("active"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(withStatus("warning"));
      serverConfig.next(withStatus("blocked"));

      expect(emissions).toEqual([
        beta(BetaStatus.Active),
        beta(BetaStatus.Warning),
        beta(BetaStatus.Blocked),
      ]);
      subscription.unsubscribe();
    });

    it("can move back from Blocked when the flag changes back", () => {
      serverConfig.next(withStatus("blocked"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(withStatus("active"));

      expect(emissions).toEqual([beta(BetaStatus.Blocked), beta(BetaStatus.Active)]);
      subscription.unsubscribe();
    });

    it("keeps the last status when the server config later becomes null", () => {
      serverConfig.next(withStatus("active"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(null);

      expect(emissions).toEqual([beta(BetaStatus.Active)]);
      subscription.unsubscribe();
    });

    it("does not emit again when the status stays the same", () => {
      serverConfig.next(withStatus("active"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      serverConfig.next(withStatus("active"));
      serverConfig.next(withStatus("blocked"));
      serverConfig.next(withStatus("unknown"));

      expect(emissions).toEqual([beta(BetaStatus.Active), beta(BetaStatus.Blocked)]);
      subscription.unsubscribe();
    });

    it("shares one flag subscription between subscribers", () => {
      serverConfig.next(withStatus("active"));
      const sut = new DefaultReleaseChannelService(configService);

      const first = record(sut);
      const second = record(sut);

      expect(configService.getFeatureFlag$).toHaveBeenCalledTimes(1);
      expect(second.emissions).toEqual([beta(BetaStatus.Active)]);
      first.subscription.unsubscribe();
      second.subscription.unsubscribe();
    });
  });

  it("exposes the beta status only after narrowing on the channel type", async () => {
    setPrereleaseBuild(true);
    serverConfig.next(withStatus("active"));
    const channel: ReleaseChannel = await firstValueFrom(
      new DefaultReleaseChannelService(configService).channel$,
    );

    // @ts-expect-error `status` exists only on BetaChannel, so an un-narrowed channel cannot read it.
    expect(channel.status).toBe(BetaStatus.Active);

    if (channel.type !== ReleaseChannelType.Beta) {
      throw new Error("expected a beta channel");
    }
    expect(channel.status).toBe(BetaStatus.Active);
  });
});
