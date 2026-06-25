import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { UserId } from "../../types/guid";
import { ConfigService } from "../abstractions/config/config.service";
import { MessagingService } from "../abstractions/messaging.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";

import { AutomationBiometricsController, AutomationDriver } from "./automation-driver.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "./config/default-config.service";

describe("AutomationDriver", () => {
  const flag = FeatureFlag.GenerateInviteLink;
  const userId = "user-id" as UserId;

  let configService: ReturnType<typeof mock<ConfigService>>;
  let messagingService: ReturnType<typeof mock<MessagingService>>;
  let stateProvider: FakeStateProvider;
  let sut: AutomationDriver;

  const currentOverrides = () =>
    firstValueFrom(stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).state$);

  beforeEach(() => {
    configService = mock<ConfigService>();
    messagingService = mock<MessagingService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    sut = new AutomationDriver(configService, stateProvider, messagingService);
  });

  describe("feature flags", () => {
    it("sets an override", async () => {
      await sut.setFeatureFlag(flag, true);

      expect(await currentOverrides()).toEqual({ [flag]: true });
    });

    it("clears a single override", async () => {
      await sut.setFeatureFlag(flag, true);

      await sut.clearFeatureFlag(flag);

      expect(await currentOverrides()).toEqual({});
    });

    it("clears all overrides", async () => {
      await sut.setFeatureFlag(flag, true);

      await sut.clearAllFeatureFlagOverrides();

      expect(await currentOverrides()).toEqual({});
    });

    it("reads the effective value from the config service", async () => {
      configService.getFeatureFlag.mockResolvedValue(true as never);

      await expect(sut.getFeatureFlag(flag)).resolves.toBe(true);
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(flag);
    });
  });

  describe("messaging", () => {
    it("sends a message command", () => {
      sut.sendMessage("foo", { bar: 1 });

      expect(messagingService.send).toHaveBeenCalledWith("foo", { bar: 1 });
    });

    it("opens settings", () => {
      sut.openSettings();

      expect(messagingService.send).toHaveBeenCalledWith("openSettings", undefined);
    });
  });

  describe("process reload", () => {
    it("delegates to the supplied capability", async () => {
      const reloadProcess = jest.fn();
      sut = new AutomationDriver(configService, stateProvider, messagingService, {
        reloadProcess,
      });

      await sut.reloadProcess();

      expect(reloadProcess).toHaveBeenCalled();
    });

    it("throws when not supported", async () => {
      await expect(sut.reloadProcess()).rejects.toThrow();
    });
  });

  describe("biometrics", () => {
    it("exposes the supplied biometrics controller", () => {
      const biometrics = mock<AutomationBiometricsController>();
      sut = new AutomationDriver(configService, stateProvider, messagingService, { biometrics });

      expect(sut.biometrics).toBe(biometrics);
    });

    it("is undefined when not supplied", () => {
      expect(sut.biometrics).toBeUndefined();
    });
  });

  describe("attachToGlobalIfDev", () => {
    it("attaches in dev mode", () => {
      const platformUtilsService = mock<PlatformUtilsService>();
      platformUtilsService.isDev.mockReturnValue(true);
      const global: any = {};

      AutomationDriver.attachToGlobalIfDev(
        global,
        platformUtilsService,
        configService,
        stateProvider,
        messagingService,
      );

      expect(global.bitwardenAutomationDriver).toBeInstanceOf(AutomationDriver);
    });

    it("does not attach outside dev mode", () => {
      const platformUtilsService = mock<PlatformUtilsService>();
      platformUtilsService.isDev.mockReturnValue(false);
      const global: any = {};

      AutomationDriver.attachToGlobalIfDev(
        global,
        platformUtilsService,
        configService,
        stateProvider,
        messagingService,
      );

      expect(global.bitwardenAutomationDriver).toBeUndefined();
    });
  });
});
