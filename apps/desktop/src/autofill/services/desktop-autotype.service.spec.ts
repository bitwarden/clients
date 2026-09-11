import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";
import { autotypeRegisterEchoHandler, autotypeRequestEcho } from "@bitwarden/sdk-internal";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";
import { DesktopAutotypeService } from "./desktop-autotype.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  autotypeRegisterEchoHandler: jest.fn(),
  autotypeRequestEcho: jest.fn(),
  // Pulled in transitively by the IpcService barrel via SdkLoadService.
  LogLevel: { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 },
  init_sdk: jest.fn(),
}));

const registerEchoHandlerMock = autotypeRegisterEchoHandler as jest.Mock;
const requestEchoMock = autotypeRequestEcho as jest.Mock;

describe("DesktopAutotypeService", () => {
  let service: DesktopAutotypeService;

  // Sentinel standing in for the SDK IpcClient, so assertions can prove the
  // service passes `ipcService.client` through rather than something else.
  const ipcClient = { sentinel: "ipc-client" };
  let ipcService: IpcService;
  let logService: LogService;
  let platformUtilsService: PlatformUtilsService;

  // The desktop test environment runs on jest-environment-jsdom's bundled jsdom@20,
  // which predates the `AbortSignal.timeout` static the service relies on (present in
  // both the Electron/Chromium renderer and the main process). Polyfill it per test,
  // matching desktop-fido2-user-interface.service.spec.ts.
  const originalTimeout = (AbortSignal as any).timeout;
  let deadlineController: AbortController;

  function buildService() {
    const enabledState = {
      state$: new BehaviorSubject<boolean | null>(null).asObservable(),
      update: jest.fn(),
    };
    const shortcutState = {
      state$: new BehaviorSubject<string[] | null>(null).asObservable(),
      update: jest.fn(),
    };

    return new DesktopAutotypeService(
      mock<AccountService>({ activeAccount$: of(null) }),
      mock<AuthService>({ activeAccountStatus$: of(AuthenticationStatus.Locked) }),
      mock<CipherService>(),
      mock<ConfigService>({ getFeatureFlag$: jest.fn().mockReturnValue(of(false)) }),
      mock<GlobalStateProvider>({
        get: jest
          .fn()
          .mockImplementation((keyDef) =>
            keyDef.key === "autotypeGaEnabled" ? enabledState : shortcutState,
          ),
      }),
      ipcService,
      platformUtilsService,
      mock<BillingAccountProfileStateService>({
        hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
      }),
      mock<DesktopAutotypeDefaultSettingPolicy>({ autotypeDefaultSetting$: of(false) }),
      logService,
    );
  }

  beforeEach(() => {
    deadlineController = new AbortController();
    (AbortSignal as any).timeout = jest.fn(() => deadlineController.signal);

    registerEchoHandlerMock.mockResolvedValue(undefined);
    requestEchoMock.mockResolvedValue({ message: "autotype echo from renderer" });

    ipcService = { client: ipcClient, send: jest.fn() } as unknown as IpcService;
    logService = mock<LogService>();
    platformUtilsService = mock<PlatformUtilsService>({
      getDevice: jest.fn().mockReturnValue(DeviceType.WindowsDesktop),
    });

    service = buildService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    (AbortSignal as any).timeout = originalTimeout;
    jest.clearAllMocks();
  });

  it("registers the echo handler with the SDK ipc client", async () => {
    await service.init();

    expect(registerEchoHandlerMock).toHaveBeenCalledWith(ipcClient);
  });

  it("registers the echo handler on platforms where autotype is unsupported", async () => {
    // The Windows-only gate sits at the top of init(); registration is deliberately
    // hoisted above it so the encrypted channel is exercised on every platform.
    platformUtilsService = mock<PlatformUtilsService>({
      getDevice: jest.fn().mockReturnValue(DeviceType.MacOsDesktop),
    });
    service = buildService();

    await service.init();

    expect(registerEchoHandlerMock).toHaveBeenCalledWith(ipcClient);
    expect(requestEchoMock).toHaveBeenCalled();
  });

  it("sends the proving echo to the main process with a timeout signal", async () => {
    await service.init();

    expect(requestEchoMock).toHaveBeenCalledWith(
      ipcClient,
      "DesktopMain",
      "autotype echo from renderer",
      expect.any(AbortSignal),
    );
  });

  it("logs the echoed message on a successful round-trip", async () => {
    requestEchoMock.mockResolvedValue({ message: "pong" });

    await service.init();

    expect(logService.info).toHaveBeenCalledWith(
      expect.stringContaining("Autotype echo round-trip succeeded"),
    );
    expect(logService.error).not.toHaveBeenCalled();
  });

  it("logs and swallows a failed round-trip so startup is not blocked", async () => {
    const failure = new Error("timed out");
    requestEchoMock.mockRejectedValue(failure);

    await expect(service.init()).resolves.toBeUndefined();

    expect(logService.error).toHaveBeenCalledWith("Autotype echo round-trip failed.", failure);
  });

  it("no longer sends raw pub/sub IPC messages", async () => {
    await service.init();

    expect(ipcService.send).not.toHaveBeenCalled();
  });
});
