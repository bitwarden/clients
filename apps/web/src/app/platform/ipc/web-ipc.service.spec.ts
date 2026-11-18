import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DESTINATION_UNREACHABLE_ERROR, IpcService } from "@bitwarden/common/platform/ipc";
import { OutgoingMessage } from "@bitwarden/sdk-internal";

import { WebBrowserInteractionService } from "../../vault/services/web-browser-interaction.service";

import { WebIpcService } from "./web-ipc.service";

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

const TO_EXTENSION = {
  destination: { BrowserBackground: { id: "Own" } },
  payload: new Uint8Array([1, 2, 3]),
  topic: undefined,
} as unknown as OutgoingMessage;

describe("WebIpcService", () => {
  let extensionInstalled$: BehaviorSubject<boolean>;
  let postMessage: jest.SpyInstance;
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    platformUtilsService.isFirefox.mockReturnValue(false);
    jest.spyOn(IpcService.prototype as any, "initWithClient").mockResolvedValue(undefined);
    postMessage = jest.spyOn(window, "postMessage").mockImplementation(() => {});

    extensionInstalled$ = new BehaviorSubject<boolean>(false);

    TestBed.configureTestingModule({
      providers: [
        WebIpcService,
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        {
          provide: WebBrowserInteractionService,
          useValue: { extensionInstalled$ },
        },
      ],
    });

    await TestBed.inject(WebIpcService).init();
  });

  afterEach(() => {
    postMessage.mockRestore();
  });

  it("reports the extension unreachable while it is not installed", async () => {
    await expect(backendSend(TO_EXTENSION)).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("posts to the extension once it is installed", async () => {
    extensionInstalled$.next(true);

    await backendSend(TO_EXTENSION);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "bitwarden-ipc-message" }),
      window.location.origin,
    );
  });

  it("reports the extension unreachable on Firefox, which has no web IPC", async () => {
    platformUtilsService.isFirefox.mockReturnValue(true);
    extensionInstalled$.next(true);

    await expect(backendSend(TO_EXTENSION)).rejects.toThrow(DESTINATION_UNREACHABLE_ERROR);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
