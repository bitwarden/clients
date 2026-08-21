import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ConsoleLogService, FlightRecorder, LogLevel } from "@bitwarden/logging";

import {
  AUTOMATION_TOAST_TIMEOUT_MS,
  AutomationBiometricsController,
  AutomationDriver,
  AutomationToastController,
  ToastEntry,
} from "./automation-driver.service";

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

  describe("flight recorder", () => {
    it("exposes the supplied flight recorder", () => {
      const flightRecorder = mock<FlightRecorder>();
      sut = new AutomationDriver(configService, stateProvider, messagingService, {
        flightRecorder,
      });

      expect(sut.flightRecorder).toBe(flightRecorder);
    });

    it("is undefined when not supplied", () => {
      expect(sut.flightRecorder).toBeUndefined();
    });
  });

  describe("log service hook", () => {
    let logService: ConsoleLogService;

    beforeEach(() => {
      logService = new ConsoleLogService(false);
    });

    it("hooks automatically when logService is in capabilities", () => {
      sut = new AutomationDriver(configService, stateProvider, messagingService, { logService });

      logService.write(LogLevel.Info, "auto");

      expect(sut.readLogBuffer()).toEqual([{ level: LogLevel.Info, message: "auto", params: [] }]);
    });

    it("buffers entries written after hooking", () => {
      sut.hookLogService(logService);

      logService.write(LogLevel.Info, "hello");

      expect(sut.readLogBuffer()).toEqual([{ level: LogLevel.Info, message: "hello", params: [] }]);
    });

    it("captures extra params", () => {
      sut.hookLogService(logService);

      logService.write(LogLevel.Warning, "msg", "a", "b");

      expect(sut.readLogBuffer()[0].params).toEqual(["a", "b"]);
    });

    it("still calls the original write", () => {
      const writeSpy = jest.spyOn(logService, "write");
      sut.hookLogService(logService);

      logService.write(LogLevel.Error, "boom");

      expect(writeSpy).toHaveBeenCalledWith(LogLevel.Error, "boom");
    });

    it("readLogBuffer returns a snapshot, not the live array", () => {
      sut.hookLogService(logService);
      logService.write(LogLevel.Debug, "first");
      const snapshot = sut.readLogBuffer();

      logService.write(LogLevel.Debug, "second");

      expect(snapshot).toHaveLength(1);
    });

    it("clearLogBuffer empties the buffer", () => {
      sut.hookLogService(logService);
      logService.write(LogLevel.Info, "x");

      sut.clearLogBuffer();

      expect(sut.readLogBuffer()).toHaveLength(0);
    });

    it("keeps buffering after a clear", () => {
      sut.hookLogService(logService);
      logService.write(LogLevel.Info, "before");
      sut.clearLogBuffer();

      logService.write(LogLevel.Info, "after");

      expect(sut.readLogBuffer()).toEqual([{ level: LogLevel.Info, message: "after", params: [] }]);
    });
  });

  describe("toast service hook", () => {
    let toastService: AutomationToastController;
    let shown: ToastEntry[];

    beforeEach(() => {
      shown = [];
      toastService = {
        showToast: (options: ToastEntry) => {
          shown.push(options);
        },
      };
    });

    it("hooks automatically when toastService is in capabilities", () => {
      sut = new AutomationDriver(configService, stateProvider, messagingService, { toastService });

      toastService.showToast({ message: "auto" });

      expect(sut.readToastBuffer()).toEqual([{ message: "auto" }]);
    });

    it("overrides the timeout to the automation timeout", () => {
      sut.hookToastService(toastService);

      toastService.showToast({ message: "saved", variant: "success", timeout: 1000 });

      expect(shown).toEqual([
        {
          message: "saved",
          variant: "success",
          timeout: AUTOMATION_TOAST_TIMEOUT_MS,
        },
      ]);
    });

    it("overrides the timeout when none was requested", () => {
      sut.hookToastService(toastService);

      toastService.showToast({ message: "saved" });

      expect(shown[0].timeout).toBe(AUTOMATION_TOAST_TIMEOUT_MS);
    });

    it("buffers the timeout the caller asked for, not the override", () => {
      sut.hookToastService(toastService);

      toastService.showToast({ message: "saved", timeout: 1000 });

      expect(sut.readToastBuffer()).toEqual([{ message: "saved", timeout: 1000 }]);
    });

    it("buffers title and variant", () => {
      sut.hookToastService(toastService);

      toastService.showToast({ message: "body", title: "Error", variant: "error" });

      expect(sut.readToastBuffer()).toEqual([
        { message: "body", title: "Error", variant: "error" },
      ]);
    });

    it("readToastBuffer returns a snapshot, not the live array", () => {
      sut.hookToastService(toastService);
      toastService.showToast({ message: "first" });
      const snapshot = sut.readToastBuffer();

      toastService.showToast({ message: "second" });

      expect(snapshot).toHaveLength(1);
    });

    it("clearToastBuffer empties the buffer", () => {
      sut.hookToastService(toastService);
      toastService.showToast({ message: "x" });

      sut.clearToastBuffer();

      expect(sut.readToastBuffer()).toHaveLength(0);
    });

    it("keeps buffering after a clear", () => {
      sut.hookToastService(toastService);
      toastService.showToast({ message: "before" });
      sut.clearToastBuffer();

      toastService.showToast({ message: "after" });

      expect(sut.readToastBuffer()).toEqual([{ message: "after" }]);
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
