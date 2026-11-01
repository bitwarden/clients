import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ReleaseChannelType } from "@bitwarden/common/platform/misc/release-channel-type";

import { DefaultReleaseChannelService } from "./default-release-channel.service";
import { BetaChannel, BetaStatus, ReleaseChannel } from "./release-channel.service";

describe("DefaultReleaseChannelService", () => {
  let configService: MockProxy<ConfigService>;
  let statusFlag: BehaviorSubject<string>;

  const beta = (status: BetaStatus): BetaChannel => ({ type: ReleaseChannelType.Beta, status });

  /** Collects every value `channel$` emits until the test ends. */
  const record = (sut: DefaultReleaseChannelService) => {
    const emissions: ReleaseChannel[] = [];
    const subscription = sut.channel$.subscribe((channel) => emissions.push(channel));
    return { emissions, subscription };
  };

  beforeEach(() => {
    statusFlag = new BehaviorSubject<string>("active");
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) => {
      if (flag !== FeatureFlag.BetaChannelStatus) {
        throw new Error(`unexpected flag ${flag}`);
      }
      return statusFlag.asObservable();
    }) as unknown as ConfigService["getFeatureFlag$"]);
  });

  afterEach(() => {
    delete process.env.RELEASE_CHANNEL;
  });

  describe("given a production build", () => {
    it.each([undefined, "production", "rc", "Beta"])(
      "emits the production channel for RELEASE_CHANNEL %p, whatever the flag says",
      async (channel) => {
        if (channel === undefined) {
          delete process.env.RELEASE_CHANNEL;
        } else {
          process.env.RELEASE_CHANNEL = channel;
        }
        statusFlag.next("blocked");

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.channel$)).toEqual({
          type: ReleaseChannelType.Production,
        });
        expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
      },
    );
  });

  describe("given a beta build", () => {
    beforeEach(() => {
      process.env.RELEASE_CHANNEL = "beta";
    });

    it("reads the status flag", async () => {
      const sut = new DefaultReleaseChannelService(configService);

      await firstValueFrom(sut.channel$);

      expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.BetaChannelStatus);
    });

    it.each([
      ["active", BetaStatus.Active],
      ["warning", BetaStatus.Warning],
      ["blocked", BetaStatus.Blocked],
    ])("maps the status flag %p to %s", async (value, status) => {
      statusFlag.next(value);

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual(beta(status));
    });

    it.each(["", "unknown", "Blocked", "BLOCKED"])(
      "maps the unknown status flag %p to Active",
      async (value) => {
        statusFlag.next(value);

        const sut = new DefaultReleaseChannelService(configService);

        expect(await firstValueFrom(sut.channel$)).toEqual(beta(BetaStatus.Active));
      },
    );

    it("maps a non-string status flag to Active", async () => {
      (statusFlag as unknown as BehaviorSubject<unknown>).next(true);

      const sut = new DefaultReleaseChannelService(configService);

      expect(await firstValueFrom(sut.channel$)).toEqual(beta(BetaStatus.Active));
    });

    it("emits again when the server config changes the flag", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      statusFlag.next("warning");
      statusFlag.next("blocked");

      expect(emissions).toEqual([
        beta(BetaStatus.Active),
        beta(BetaStatus.Warning),
        beta(BetaStatus.Blocked),
      ]);
      subscription.unsubscribe();
    });

    it("can move back from Blocked when the flag changes back", () => {
      statusFlag.next("blocked");
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      statusFlag.next("active");

      expect(emissions).toEqual([beta(BetaStatus.Blocked), beta(BetaStatus.Active)]);
      subscription.unsubscribe();
    });

    it("does not emit again when the status stays the same", () => {
      const sut = new DefaultReleaseChannelService(configService);
      const { emissions, subscription } = record(sut);

      statusFlag.next("active");
      statusFlag.next("unknown");

      expect(emissions).toEqual([beta(BetaStatus.Active)]);
      subscription.unsubscribe();
    });

    it("shares one flag subscription between subscribers", () => {
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
    process.env.RELEASE_CHANNEL = "beta";
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
