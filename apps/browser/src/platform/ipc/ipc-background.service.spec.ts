import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { BroadcastGroup, BroadcastResolution, Endpoint } from "@bitwarden/sdk-internal";

import { IpcBackgroundService } from "./ipc-background.service";
import { BrowserForegroundIpcTransport } from "./transports";

/** The `resolve` the service hands to the SDK's communication backend. */
let backendResolve: (group: BroadcastGroup) => Promise<BroadcastResolution>;

jest.mock("@bitwarden/sdk-internal", () => ({
  IpcCommunicationBackend: jest.fn().mockImplementation((sender) => {
    backendResolve = sender.resolve;
    return {};
  }),
  IpcClient: { newWithSdkInMemorySessions: jest.fn() },
  ipcRegisterDiscoverHandler: jest.fn(),
  IncomingMessage: jest.fn(),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

jest.mock("./transports", () => ({
  BrowserForegroundIpcTransport: jest.fn(),
  DesktopIpcTransport: jest.fn().mockImplementation(() => ({ init: jest.fn() })),
  WebIpcTransport: jest.fn().mockImplementation(() => ({ init: jest.fn() })),
}));

describe("IpcBackgroundService", () => {
  let connectedEndpoints: Endpoint[];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(IpcService.prototype as any, "initWithClient").mockResolvedValue(undefined);

    connectedEndpoints = [];
    jest.mocked(BrowserForegroundIpcTransport).mockImplementation(
      () =>
        ({
          init: jest.fn(),
          start: jest.fn(),
          connectedEndpoints: () => connectedEndpoints,
        }) as unknown as BrowserForegroundIpcTransport,
    );

    const sut = new IpcBackgroundService(mock<PlatformUtilsService>(), mock<LogService>());
    await sut.init();
  });

  it("resolves the browser foreground group to the connected extension pages", async () => {
    connectedEndpoints = [{ BrowserForeground: { id: 1 } }, { BrowserForeground: { id: 3 } }];

    await expect(backendResolve("AllBrowserForeground")).resolves.toEqual({
      Endpoints: [{ BrowserForeground: { id: 1 } }, { BrowserForeground: { id: 3 } }],
    });
  });

  it("resolves the browser foreground group to no endpoints when no page is connected", async () => {
    await expect(backendResolve("AllBrowserForeground")).resolves.toEqual({ Endpoints: [] });
  });

  it("does not support the browser background group", async () => {
    await expect(backendResolve("AllBrowserBackground")).resolves.toBe("Unsupported");
  });
});
