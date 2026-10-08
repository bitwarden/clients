import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { OutgoingMessage } from "@bitwarden/sdk-internal";

import { IpcRendererService } from "./ipc-renderer.service";

/** The `send` the service hands to the SDK's communication backend. */
let backendSend: (message: OutgoingMessage) => Promise<void>;

jest.mock("@bitwarden/sdk-internal", () => ({
  IpcCommunicationBackend: jest.fn().mockImplementation((sender) => {
    backendSend = sender.send;
    return {};
  }),
  IpcClient: { newWithSdkInMemorySessions: jest.fn() },
  ipcRegisterDiscoverHandler: jest.fn(),
  IncomingMessage: jest.fn(),
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("IpcRendererService", () => {
  const ipcSend = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(IpcService.prototype as any, "initWithClient").mockResolvedValue(undefined);

    (global as any).ipc = {
      platform: { ipcService: { send: ipcSend, onMessage: jest.fn() } },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    });

    const sut = TestBed.runInInjectionContext(() => new IpcRendererService());
    await sut.init();
  });

  /** Sends through the backend and returns what reached the main process, if anything. */
  async function sendTo(destination: unknown): Promise<unknown> {
    await backendSend({
      destination,
      payload: new Uint8Array([1]),
      topic: "topic",
    } as OutgoingMessage);

    return ipcSend.mock.calls[0]?.[0];
  }

  it.each([
    ["a browser", { BrowserBackground: { id: { Id: 1 } } }],
    ["the CLI", { Cli: { id: { Id: 1 } } }],
    ["the main process", "DesktopMain"],
  ])("forwards messages for %s to the main process", async (_, destination) => {
    expect(await sendTo(destination)).toEqual({
      type: "bitwarden-ipc-message",
      message: { destination, payload: [1], topic: "topic" },
    });
  });

  it("rejects a destination it cannot route instead of dropping it", async () => {
    await expect(sendTo({ Web: { id: 1 } })).rejects.toThrow("Destination not supported");
    expect(ipcSend).not.toHaveBeenCalled();
  });
});
