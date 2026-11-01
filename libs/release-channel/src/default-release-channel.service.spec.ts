import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, distinctUntilChanged, firstValueFrom, map } from "rxjs";

import {
  AllowedFeatureFlagTypes,
  FeatureFlag,
  getFeatureFlagValue,
} from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { ServerConfigData } from "@bitwarden/common/platform/models/data/server-config.data";

import { DefaultReleaseChannelService } from "./default-release-channel.service";
import { BetaChannelStatus, BetaClientAccess } from "./release-channel.service";

describe("DefaultReleaseChannelService", () => {
  let configService: MockProxy<ConfigService>;
  let serverConfig: BehaviorSubject<ServerConfig | null>;

  /** A server config with the given feature states. */
  const config = (featureStates: Record<string, AllowedFeatureFlagTypes> = {}) =>
    new ServerConfig(new ServerConfigData({ featureStates }));

  /** A server config that serves `value` for `beta-channel-status`. */
  const withStatus = (value: AllowedFeatureFlagTypes) =>
    config({ [FeatureFlag.BetaChannelStatus]: value });

  /** Sets the build-time flags the way `CHANNEL=beta` and production builds inject them. */
  const setBetaChannel = (prereleaseBuild: boolean) => {
    process.env.FLAGS = JSON.stringify({ prereleaseBuild });
  };

  /** Collects every value an observable emits until the test ends. */
  const record = <T>(source$: Observable<T>) => {
    const emissions: T[] = [];
    const subscription = source$.subscribe((value) => emissions.push(value));
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

  afterEach(() => {
    process.env.FLAGS = JSON.stringify({});
  });

  describe("betaChannelStatus$", () => {
    it.each([true, false])(
      "reads the flag whatever the client channel (beta: %p)",
      async (beta) => {
        setBetaChannel(beta);
        serverConfig.next(withStatus("open"));

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.betaChannelStatus$)).toBe(BetaChannelStatus.Open);
        expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.BetaChannelStatus);
      },
    );

    it("emits nothing while no server config exists", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut.betaChannelStatus$);

      serverConfig.next(null);

      expect(emissions).toEqual([]);
      expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });

    it("emits the served status once the first server config loads, without a Closed flash", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut.betaChannelStatus$);

      serverConfig.next(withStatus("open"));

      expect(emissions).toEqual([BetaChannelStatus.Open]);
      subscription.unsubscribe();
    });

    it("reports Closed when the server config does not include the key", async () => {
      serverConfig.next(config());

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.betaChannelStatus$)).toBe(BetaChannelStatus.Closed);
    });

    it.each([
      ["open", BetaChannelStatus.Open],
      ["closing", BetaChannelStatus.Closing],
      ["closed", BetaChannelStatus.Closed],
    ])("maps the served value %p to %s", async (value, status) => {
      serverConfig.next(withStatus(value));

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.betaChannelStatus$)).toBe(status);
    });

    it.each([
      ["an unknown value", "bogus"],
      ["different casing", "Open"],
      ["different casing", "CLOSING"],
      ["an empty string", ""],
      ["a value with whitespace", " open"],
      ["a boolean", true],
      ["a number", 1],
    ])("reports Closed for %s (%p)", async (_, value) => {
      serverConfig.next(withStatus(value));

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.betaChannelStatus$)).toBe(BetaChannelStatus.Closed);
    });

    it("emits again when the server config changes the flag, and not for a repeated status", () => {
      serverConfig.next(withStatus("open"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut.betaChannelStatus$);

      serverConfig.next(withStatus("closing"));
      serverConfig.next(withStatus("closed"));
      serverConfig.next(withStatus("bogus"));
      serverConfig.next(withStatus("open"));

      expect(emissions).toEqual([
        BetaChannelStatus.Open,
        BetaChannelStatus.Closing,
        BetaChannelStatus.Closed,
        BetaChannelStatus.Open,
      ]);
      subscription.unsubscribe();
    });

    it("keeps the last status when the server config later becomes null", () => {
      serverConfig.next(withStatus("open"));
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut.betaChannelStatus$);

      serverConfig.next(null);

      expect(emissions).toEqual([BetaChannelStatus.Open]);
      subscription.unsubscribe();
    });

    it("shares one flag subscription between subscribers", () => {
      serverConfig.next(withStatus("open"));
      const sut = new DefaultReleaseChannelService(configService);

      const first = record(sut.betaChannelStatus$);
      const second = record(sut.betaChannelStatus$);

      expect(configService.getFeatureFlag$).toHaveBeenCalledTimes(1);
      expect(second.emissions).toEqual([BetaChannelStatus.Open]);
      first.subscription.unsubscribe();
      second.subscription.unsubscribe();
    });
  });

  describe("betaClientAccess$", () => {
    describe("on a production client", () => {
      it.each([
        ["without prereleaseBuild", JSON.stringify({})],
        ["with prereleaseBuild off", JSON.stringify({ prereleaseBuild: false })],
        ["with no FLAGS", undefined],
      ])("emits Allowed %s and never reads the flag", async (_, flags) => {
        if (flags === undefined) {
          delete process.env.FLAGS;
        } else {
          process.env.FLAGS = flags;
        }
        serverConfig.next(withStatus("closed"));

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.betaClientAccess$)).toBe(BetaClientAccess.Allowed);
        expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
      });

      it("emits Allowed before any server config exists", async () => {
        setBetaChannel(false);
        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.betaClientAccess$)).toBe(BetaClientAccess.Allowed);
      });
    });

    describe("on a beta client", () => {
      beforeEach(() => {
        setBetaChannel(true);
      });

      it.each([
        ["open", BetaClientAccess.Allowed],
        ["closing", BetaClientAccess.Warning],
        ["closed", BetaClientAccess.Blocked],
        ["bogus", BetaClientAccess.Blocked],
      ])("maps the served value %p to %s", async (value, access) => {
        serverConfig.next(withStatus(value));

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.betaClientAccess$)).toBe(access);
      });

      it("blocks when the server config does not include the key", async () => {
        serverConfig.next(config());

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.betaClientAccess$)).toBe(BetaClientAccess.Blocked);
      });

      it("emits nothing while no server config exists", () => {
        const sut = new DefaultReleaseChannelService(configService);
        const { emissions, subscription } = record(sut.betaClientAccess$);

        expect(emissions).toEqual([]);
        subscription.unsubscribe();
      });

      it("follows the status through every change", () => {
        serverConfig.next(withStatus("open"));
        const sut = new DefaultReleaseChannelService(configService);
        const { emissions, subscription } = record(sut.betaClientAccess$);

        for (const value of ["closing", "Open", "bogus", "closed", "open"]) {
          serverConfig.next(withStatus(value));
        }

        expect(emissions).toEqual([
          BetaClientAccess.Allowed,
          BetaClientAccess.Warning,
          BetaClientAccess.Blocked,
          BetaClientAccess.Allowed,
        ]);
        subscription.unsubscribe();
      });
    });
  });
});
