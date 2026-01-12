import { MockProxy, mock } from "jest-mock-extended";

import { Duo2faResult } from "@bitwarden/auth/angular";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { WebTwoFactorAuthDuoComponentService } from "./web-two-factor-auth-duo-component.service";

describe("WebTwoFactorAuthDuoComponentService", () => {
  let webTwoFactorAuthDuoComponentService: WebTwoFactorAuthDuoComponentService;

  let platformUtilsService: MockProxy<PlatformUtilsService>;

  let mockBroadcastChannel: jest.Mocked<BroadcastChannel>;
  let eventTarget: EventTarget;

  beforeEach(() => {
    jest.clearAllMocks();

    platformUtilsService = mock<PlatformUtilsService>();

    eventTarget = new EventTarget();

    mockBroadcastChannel = {
      name: "duoResult",
      postMessage: jest.fn(),
      close: jest.fn(),
      onmessage: jest.fn(),
      onmessageerror: jest.fn(),
      addEventListener: jest.fn().mockImplementation((type, listener) => {
        eventTarget.addEventListener(type, listener);
      }),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    global.BroadcastChannel = jest.fn(() => mockBroadcastChannel);

    webTwoFactorAuthDuoComponentService = new WebTwoFactorAuthDuoComponentService(
      platformUtilsService,
    );
  });

  afterEach(() => {
    // reset global object
    jest.restoreAllMocks();
  });

  describe("listenForDuo2faResult$", () => {
    it("should return an observable that emits a duo 2FA result when a duo result message is received", (done) => {
      const expectedResult: Duo2faResult = {
        code: "123456",
        state: "verified",
        token: "123456|verified",
      };
      const mockMessageEvent = new MessageEvent("message", {
        data: {
          code: "123456",
          state: "verified",
        },
        lastEventId: "",
        origin: "",
        ports: [],
        source: null,
      });
      webTwoFactorAuthDuoComponentService.listenForDuo2faResult$().subscribe((result) => {
        expect(result).toEqual(expectedResult);
        done();
      });

      // Trigger the message event
      eventTarget.dispatchEvent(mockMessageEvent);
    });
  });

  describe("launchDuoFrameless", () => {
    it("should launch the duo frameless URL", async () => {
      const duoFramelessUrl = "https://duo.com/frameless";
      await webTwoFactorAuthDuoComponentService.launchDuoFrameless(duoFramelessUrl);

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(duoFramelessUrl);
    });
  });
});
