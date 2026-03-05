import { take } from "rxjs";

import { TotpResponse } from "@bitwarden/sdk-internal";

import { MockSdkService } from "../../platform/spec/mock-sdk.service";

import { TotpService } from "./totp.service";

describe("TotpService", () => {
  let totpService!: TotpService;
  let sdkService!: MockSdkService;

  beforeEach(() => {
    sdkService = new MockSdkService();
    sdkService.client.vault
      .mockDeep()
      .totp.mockDeep()
      .generate_totp.mockReturnValueOnce({
        code: "123456",
        period: 30,
      })
      .mockReturnValueOnce({ code: "654321", period: 30 })
      .mockReturnValueOnce({ code: "567892", period: 30 });

    totpService = new TotpService(sdkService);

    // TOTP is time-based, so we need to mock the current time
    jest.useFakeTimers({
      now: new Date("2023-01-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("getCode$", () => {
    it("should emit TOTP response when key is provided", (done) => {
      totpService
        .getCode$("WQIQ25BRKZYCJVYP")
        .pipe(take(1))
        .subscribe((result) => {
          expect(result).toEqual({ code: "123456", period: 30 });
          done();
        });

      jest.advanceTimersByTime(1000);
    });

    it("should emit TOTP response every second", () => {
      const responses: TotpResponse[] = [];

      totpService
        .getCode$("WQIQ25BRKZYCJVYP")
        .pipe(take(3))
        .subscribe((result) => {
          responses.push(result);
        });

      jest.advanceTimersByTime(2000);

      expect(responses).toEqual([
        { code: "123456", period: 30 },
        { code: "654321", period: 30 },
        { code: "567892", period: 30 },
      ]);
    });

    it("should stop emitting TOTP response after unsubscribing", () => {
      const responses: TotpResponse[] = [];

      const subscription = totpService.getCode$("WQIQ25BRKZYCJVYP").subscribe((result) => {
        responses.push(result);
      });

      jest.advanceTimersByTime(1000);
      subscription.unsubscribe();
      jest.advanceTimersByTime(1000);

      expect(responses).toHaveLength(2);
    });
  });
});
