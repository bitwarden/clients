import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FlightRecorder } from "@bitwarden/logging";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { FakeStorageService } from "@bitwarden/storage-test-utils";
import { LockService, LockSource, UnlockService } from "@bitwarden/unlock";

import { AutomationDriver } from "./automation-driver.service";
import {
  AUTOMATION_TOAST_TIMEOUT_MS,
  AutomationBiometricsController,
  AutomationToastController,
  ReloadProcess,
  ToastEntry,
} from "./capabilities";

interface OptionalDependencies {
  reloadProcess?: ReloadProcess;
  biometrics?: AutomationBiometricsController;
  messagingService?: MessagingService;
  toastService?: AutomationToastController;
}

describe("AutomationDriver", () => {
  const flag = FeatureFlag.GenerateInviteLink;
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let configService: ReturnType<typeof mock<ConfigService>>;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let authService: ReturnType<typeof mock<AuthService>>;
  let lockService: ReturnType<typeof mock<LockService>>;
  let unlockService: ReturnType<typeof mock<UnlockService>>;
  let flightRecorder: ReturnType<typeof mock<FlightRecorder>>;
  let stateProvider: FakeStateProvider;
  let diskStorage: FakeStorageService;
  let memoryStorage: FakeStorageService;
  let sut: AutomationDriver;

  const currentOverrides = () =>
    firstValueFrom(stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES).state$);

  /** Builds a driver with the always-wired dependencies, plus whichever optional ones a test needs. */
  const buildDriver = (optional: OptionalDependencies = {}) =>
    new AutomationDriver(
      configService,
      stateProvider,
      new StorageServiceProvider(diskStorage, memoryStorage),
      flightRecorder,
      accountService,
      authService,
      lockService,
      unlockService,
      optional.reloadProcess,
      optional.biometrics,
      optional.messagingService,
      optional.toastService,
    );

  beforeEach(() => {
    configService = mock<ConfigService>();
    flightRecorder = mock<FlightRecorder>();
    accountService = mock<AccountService>();
    authService = mock<AuthService>();
    lockService = mock<LockService>();
    unlockService = mock<UnlockService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    diskStorage = new FakeStorageService();
    memoryStorage = new FakeStorageService();
    sut = buildDriver();
  });

  describe("feature flags", () => {
    it("sets an override", async () => {
      await sut.featureFlags.set(flag, true);

      expect(await currentOverrides()).toEqual({ [flag]: true });
    });

    it("clears a single override", async () => {
      await sut.featureFlags.set(flag, true);

      await sut.featureFlags.clear(flag);

      expect(await currentOverrides()).toEqual({});
    });

    it("clears all overrides", async () => {
      await sut.featureFlags.set(flag, true);

      await sut.featureFlags.clearAll();

      expect(await currentOverrides()).toEqual({});
    });

    it("reads the effective value from the config service", async () => {
      configService.getFeatureFlag.mockResolvedValue(true as never);

      await expect(sut.featureFlags.get(flag)).resolves.toBe(true);
      expect(configService.getFeatureFlag).toHaveBeenCalledWith(flag);
    });
  });

  describe("state", () => {
    const address = { stateName: "automationTest", key: "someKey" };

    it("reads global state by address", async () => {
      diskStorage.internalUpdateStore({ global_automationTest_someKey: "stored" });

      await expect(sut.state.readGlobal(address)).resolves.toBe("stored");
    });

    it("reads user state by address", async () => {
      diskStorage.internalUpdateStore({
        [`user_${userId}_automationTest_someKey`]: "stored",
      });

      await expect(sut.state.readUser(userId, address)).resolves.toBe("stored");
    });

    it("returns null for state that was never written", async () => {
      await expect(sut.state.readGlobal(address)).resolves.toBeNull();
      await expect(sut.state.readUser(userId, address)).resolves.toBeNull();
    });
  });

  describe("process reload", () => {
    it("delegates to the supplied capability", async () => {
      const reloadProcess = jest.fn();
      sut = buildDriver({ reloadProcess });

      await sut.processReload!.reload();

      expect(reloadProcess).toHaveBeenCalled();
    });

    it("is undefined when not supplied", () => {
      expect(sut.processReload).toBeUndefined();
    });
  });

  describe("biometrics", () => {
    it("exposes the supplied biometrics controller", () => {
      const biometrics = mock<AutomationBiometricsController>();
      sut = buildDriver({ biometrics });

      expect(sut.biometrics).toBe(biometrics);
    });

    it("is undefined when not supplied", () => {
      expect(sut.biometrics).toBeUndefined();
    });
  });

  describe("logging", () => {
    it("is undefined when no flight recorder is supplied", () => {
      sut = new AutomationDriver(
        configService,
        stateProvider,
        new StorageServiceProvider(diskStorage, memoryStorage),
        undefined,
        accountService,
        authService,
        lockService,
        unlockService,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(sut.logging).toBeUndefined();
    });

    it("reads flight recorder events", async () => {
      flightRecorder.read.mockResolvedValue([]);

      await expect(sut.logging!.readEvents()).resolves.toEqual([]);
      expect(flightRecorder.read).toHaveBeenCalled();
    });

    it("counts flight recorder events", async () => {
      flightRecorder.count.mockResolvedValue(2);

      await expect(sut.logging!.countEvents()).resolves.toBe(2);
    });
  });

  describe("desktop navigation", () => {
    it("opens settings through the messaging service", () => {
      const messagingService = mock<MessagingService>();
      sut = buildDriver({ messagingService });

      sut.desktopNavigation!.openSettings();

      expect(messagingService.send).toHaveBeenCalledWith("openSettings");
    });

    it("is undefined when not supplied", () => {
      expect(sut.desktopNavigation).toBeUndefined();
    });
  });

  describe("lock", () => {
    const otherUserId = "other-user-id" as UserId;

    it("lists the lock status of every known account", async () => {
      accountService.accounts$ = of({
        [userId]: {
          email: "user@example.com",
          emailVerified: true,
          name: "User",
          creationDate: undefined,
        },
        [otherUserId]: {
          email: "other@example.com",
          emailVerified: true,
          name: "Other",
          creationDate: undefined,
        },
      });
      authService.authStatuses$ = of({
        [userId]: AuthenticationStatus.Unlocked,
        [otherUserId]: AuthenticationStatus.Locked,
      } as Record<UserId, AuthenticationStatus>);

      await expect(sut.lock!.listUsers()).resolves.toEqual([
        { userId, email: "user@example.com", status: "Unlocked" },
        { userId: otherUserId, email: "other@example.com", status: "Locked" },
      ]);
    });

    it("reports users with no auth status as logged out", async () => {
      accountService.accounts$ = of({
        [userId]: {
          email: "user@example.com",
          emailVerified: true,
          name: "User",
          creationDate: undefined,
        },
      });
      authService.authStatuses$ = of({} as Record<UserId, AuthenticationStatus>);

      const [status] = await sut.lock!.listUsers();

      expect(status.status).toBe("LoggedOut");
    });

    it("locks a user manually", async () => {
      await sut.lock!.lock(userId);

      expect(lockService.lock).toHaveBeenCalledWith(userId, LockSource.Manual);
    });

    it("unlocks with a master password", async () => {
      await sut.lock!.unlockWithMasterPassword(userId, "pw");

      expect(unlockService.unlockWithMasterPassword).toHaveBeenCalledWith(userId, "pw");
    });

    it("unlocks with a pin", async () => {
      await sut.lock!.unlockWithPin(userId, "1234");

      expect(unlockService.unlockWithPin).toHaveBeenCalledWith(userId, "1234");
    });

    it("unlocks with biometrics", async () => {
      await sut.lock!.unlockWithBiometrics(userId);

      expect(unlockService.unlockWithBiometrics).toHaveBeenCalledWith(userId);
    });
  });

  describe("toast", () => {
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

    it("is undefined when no toast service is supplied", () => {
      expect(sut.toast).toBeUndefined();
    });

    it("buffers toasts shown after the service is hooked", () => {
      sut = buildDriver({ toastService });

      toastService.showToast({ message: "auto" });

      expect(sut.toast!.readBuffer()).toEqual([{ message: "auto" }]);
    });

    it("overrides the timeout to the automation timeout", () => {
      sut = buildDriver({ toastService });

      toastService.showToast({ message: "saved", variant: "success", timeout: 1000 });

      expect(shown).toEqual([
        { message: "saved", variant: "success", timeout: AUTOMATION_TOAST_TIMEOUT_MS },
      ]);
    });

    it("overrides the timeout when none was requested", () => {
      sut = buildDriver({ toastService });

      toastService.showToast({ message: "saved" });

      expect(shown[0].timeout).toBe(AUTOMATION_TOAST_TIMEOUT_MS);
    });

    it("buffers the timeout the caller asked for, not the override", () => {
      sut = buildDriver({ toastService });

      toastService.showToast({ message: "saved", timeout: 1000 });

      expect(sut.toast!.readBuffer()).toEqual([{ message: "saved", timeout: 1000 }]);
    });

    it("buffers title and variant", () => {
      sut = buildDriver({ toastService });

      toastService.showToast({ message: "body", title: "Error", variant: "error" });

      expect(sut.toast!.readBuffer()).toEqual([
        { message: "body", title: "Error", variant: "error" },
      ]);
    });

    it("readBuffer returns a snapshot, not the live array", () => {
      sut = buildDriver({ toastService });
      toastService.showToast({ message: "first" });
      const snapshot = sut.toast!.readBuffer();

      toastService.showToast({ message: "second" });

      expect(snapshot).toHaveLength(1);
    });

    it("keeps buffering after a clear", () => {
      sut = buildDriver({ toastService });
      toastService.showToast({ message: "before" });
      sut.toast!.clearBuffer();

      toastService.showToast({ message: "after" });

      expect(sut.toast!.readBuffer()).toEqual([{ message: "after" }]);
    });
  });

  describe("attachToGlobal", () => {
    it("attaches the driver", () => {
      const global: any = {};

      AutomationDriver.attachToGlobal(
        global,
        configService,
        stateProvider,
        new StorageServiceProvider(diskStorage, memoryStorage),
        flightRecorder,
        accountService,
        authService,
        lockService,
        unlockService,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(global.bitwardenAutomationDriver).toBeInstanceOf(AutomationDriver);
    });

    it("does not replace an already attached driver", () => {
      const existing = {};
      const global: any = { bitwardenAutomationDriver: existing };

      AutomationDriver.attachToGlobal(
        global,
        configService,
        stateProvider,
        new StorageServiceProvider(diskStorage, memoryStorage),
        flightRecorder,
        accountService,
        authService,
        lockService,
        unlockService,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(global.bitwardenAutomationDriver).toBe(existing);
    });
  });
});
