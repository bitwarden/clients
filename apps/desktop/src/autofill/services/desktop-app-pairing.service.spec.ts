import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import {
  AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION,
  AutotypePairingPackagingType,
} from "@bitwarden/common/desktop-native/models/autotype-pairing-data";
import { DesktopAutotypePairingUri } from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { IpcClient, autotypeRequestListRunningApps } from "@bitwarden/sdk-internal";

import {
  DesktopAppPairingService,
  LIST_RUNNING_APPS_TIMEOUT_MS,
} from "./desktop-app-pairing.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  autotypeRequestListRunningApps: jest.fn(),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("DesktopAppPairingService", () => {
  const runningApps = [
    { name: "Notepad", path: "%WINDIR%\\notepad.exe" },
    { name: "App", path: "%LOCALAPPDATA%\\App\\app.exe" },
  ];
  // 2026-12-01T00:00:00.123Z
  const now = 1796083200123;

  let ipcClient: IpcClient;
  let logService: MockProxy<LogService>;
  let service: DesktopAppPairingService;
  let callerController: AbortController;
  // Stands in for the signal `AbortSignal.timeout(...)` returns, so tests can time out on demand
  let timeoutController: AbortController;

  // The desktop test environment's jsdom predates the `AbortSignal.timeout` and `AbortSignal.any`
  // statics, which Electron provides, so they're replaced for each test
  const originalTimeout = (AbortSignal as any).timeout;
  const originalAny = (AbortSignal as any).any;
  const originalIpc = (global as any).ipc;

  const requestSignal = (): AbortSignal =>
    (autotypeRequestListRunningApps as jest.Mock).mock.calls[0][1];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(now);

    timeoutController = new AbortController();
    (AbortSignal as any).timeout = jest.fn(() => timeoutController.signal);
    (AbortSignal as any).any = (signals: AbortSignal[]) => {
      const controller = new AbortController();
      for (const signal of signals) {
        if (signal.aborted) {
          controller.abort(signal.reason);
          break;
        }
        signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
      }
      return controller.signal;
    };
    (global as any).ipc = { platform: { isWindowsStore: false } };

    (autotypeRequestListRunningApps as jest.Mock).mockResolvedValue({ apps: runningApps });

    ipcClient = {} as IpcClient;
    logService = mock<LogService>();
    callerController = new AbortController();

    TestBed.configureTestingModule({
      providers: [
        DesktopAppPairingService,
        { provide: IpcService, useValue: mock<IpcService>({ client: ipcClient }) },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(DesktopAppPairingService);
  });

  afterEach(() => {
    (AbortSignal as any).timeout = originalTimeout;
    (AbortSignal as any).any = originalAny;
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
  });

  it("requests the running apps from the main process over encrypted IPC", async () => {
    await service.getRunningApps(callerController.signal);

    expect(autotypeRequestListRunningApps).toHaveBeenCalledTimes(1);
    expect(autotypeRequestListRunningApps).toHaveBeenCalledWith(ipcClient, expect.any(AbortSignal));
  });

  it("returns a pairing URI for each running app, in the order they were listed", async () => {
    const pairingUris = await service.getRunningApps(callerController.signal);

    expect(pairingUris.map((pairingUri) => pairingUri.data)).toEqual([
      {
        metadata: {
          schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
          pairingTimestamp: 1796083200,
        },
        appData: { name: "Notepad", normalizedPath: "%WINDIR%\\notepad.exe" },
        clientData: { packagingType: AutotypePairingPackagingType.WindowsExe },
      },
      {
        metadata: {
          schemaVersion: { ...AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION },
          pairingTimestamp: 1796083200,
        },
        appData: { name: "App", normalizedPath: "%LOCALAPPDATA%\\App\\app.exe" },
        clientData: { packagingType: AutotypePairingPackagingType.WindowsExe },
      },
    ]);
  });

  it("returns pairing URIs that are written in the current format and can be read back", async () => {
    const [pairingUri] = await service.getRunningApps(callerController.signal);

    expect(pairingUri.version).toBe(DesktopAutotypePairingUri.CurrentVersion);
    expect(DesktopAutotypePairingUri.fromString(pairingUri.toString())?.data).toEqual(
      pairingUri.data,
    );
  });

  it("pairs the apps with the MSIX packaging type on a Microsoft Store install", async () => {
    (global as any).ipc.platform.isWindowsStore = true;

    const pairingUris = await service.getRunningApps(callerController.signal);

    expect(pairingUris.map((pairingUri) => pairingUri.data.clientData.packagingType)).toEqual([
      AutotypePairingPackagingType.WindowsMsix,
      AutotypePairingPackagingType.WindowsMsix,
    ]);
  });

  it("skips running apps with an empty name or path", async () => {
    (autotypeRequestListRunningApps as jest.Mock).mockResolvedValue({
      apps: [
        { name: "", path: "C:\\Program Files\\NoName\\noname.exe" },
        { name: "No Path", path: "" },
        { name: "Notepad", path: "%WINDIR%\\notepad.exe" },
      ],
    });

    const pairingUris = await service.getRunningApps(callerController.signal);

    expect(pairingUris.map((pairingUri) => pairingUri.data.appData.name)).toEqual(["Notepad"]);
  });

  it("returns an empty list when no apps are running", async () => {
    (autotypeRequestListRunningApps as jest.Mock).mockResolvedValue({ apps: [] });

    await expect(service.getRunningApps(callerController.signal)).resolves.toEqual([]);
  });

  it("doesn't log the running apps", async () => {
    await service.getRunningApps(callerController.signal);

    expect(logService.debug).not.toHaveBeenCalled();
    expect(logService.info).not.toHaveBeenCalled();
    expect(logService.warning).not.toHaveBeenCalled();
    expect(logService.error).not.toHaveBeenCalled();
  });

  it("returns null and logs an error when the request fails", async () => {
    const error = new Error("request failed");
    (autotypeRequestListRunningApps as jest.Mock).mockRejectedValue(error);

    await expect(service.getRunningApps(callerController.signal)).resolves.toBeNull();

    expect(logService.error).toHaveBeenCalledWith(
      "Failed to list the running apps for Autotype.",
      error,
    );
  });

  it("times the request out after 5 seconds", async () => {
    await service.getRunningApps(callerController.signal);

    expect(AbortSignal.timeout).toHaveBeenCalledWith(LIST_RUNNING_APPS_TIMEOUT_MS);
    expect(LIST_RUNNING_APPS_TIMEOUT_MS).toBe(5_000);
    expect(requestSignal().aborted).toBe(false);

    timeoutController.abort();
    expect(requestSignal().aborted).toBe(true);
  });

  it("aborts the request when the caller's signal aborts", async () => {
    await service.getRunningApps(callerController.signal);

    callerController.abort();

    expect(requestSignal().aborted).toBe(true);
  });

  it("returns null without logging an error when the caller aborts the request", async () => {
    (autotypeRequestListRunningApps as jest.Mock).mockImplementation(async () => {
      callerController.abort();
      throw new Error("aborted");
    });

    await expect(service.getRunningApps(callerController.signal)).resolves.toBeNull();

    expect(logService.error).not.toHaveBeenCalled();
  });
});
