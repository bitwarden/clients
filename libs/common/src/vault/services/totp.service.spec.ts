import { mock } from "jest-mock-extended";
import { of, take } from "rxjs";

import { BitwardenClient, TotpResponse } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { TotpService } from "./totp.service";

describe("TotpService", () => {
  let totpService: TotpService;
  let generateTotpMock: jest.Mock;

  const sdkService = mock<SdkService>();

  beforeEach(() => {
    generateTotpMock = jest
      .fn()
      .mockResolvedValueOnce({
        code: "123456",
        period: 30,
      })
      .mockResolvedValueOnce({ code: "654321", period: 30 })
      .mockResolvedValueOnce({ code: "567892", period: 30 });

    const mockBitwardenClient = {
      vault: () => ({
        totp: () => ({
          generate_totp: generateTotpMock,
        }),
      }),
    };

    sdkService.client$ = of(mockBitwardenClient as unknown as BitwardenClient);

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

    it("should emit TOTP response every second", async () => {
      const responses: TotpResponse[] = [];

      totpService
        .getCode$("WQIQ25BRKZYCJVYP")
        .pipe(take(3))
        .subscribe((result) => {
          responses.push(result);
        });

      await jest.advanceTimersByTimeAsync(2000);
      expect(responses).toEqual([
        { code: "123456", period: 30 },
        { code: "654321", period: 30 },
        { code: "567892", period: 30 },
      ]);
    });

    it("should stop emitting TOTP response after unsubscribing", async () => {
      const responses: TotpResponse[] = [];

      const subscription = totpService.getCode$("WQIQ25BRKZYCJVYP").subscribe((result) => {
        responses.push(result);
      });

      await jest.advanceTimersByTimeAsync(1900);
      subscription.unsubscribe();
      await jest.advanceTimersByTimeAsync(2000);

      expect(responses).toHaveLength(2);
    });
  });
});
