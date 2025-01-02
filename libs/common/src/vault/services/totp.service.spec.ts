import { mock } from "jest-mock-extended";

import { WebCryptoFunctionService } from "@bitwarden/common/key-management/services/web-crypto-function.service";

import { LogService } from "../../platform/abstractions/log.service";

import { TotpService } from "./totp.service";

describe("TotpService", () => {
  let totpService: TotpService;

  const logService = mock<LogService>();

  beforeEach(() => {
    totpService = new TotpService(new WebCryptoFunctionService(global), logService);

    // TOTP is time-based, so we need to mock the current time
    jest.useFakeTimers({
      now: new Date("2023-01-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("should return null if key is null", async () => {
    const result = await totpService.getCode(null);
    expect(result).toBeNull();
  });

  it("should return a code if key is not null", async () => {
    const result = await totpService.getCode("WQIQ25BRKZYCJVYP");
    expect(result).toBe("194506");
  });

  it("should handle otpauth keys", async () => {
    const key = "otpauth://totp/test-account?secret=WQIQ25BRKZYCJVYP";
    const result = await totpService.getCode(key);
    expect(result).toBe("194506");

    const period = totpService.getTimeInterval(key);
    expect(period).toBe(30);
  });

  it("should handle otpauth different period", async () => {
    const key = "otpauth://totp/test-account?secret=WQIQ25BRKZYCJVYP&period=60";
    const result = await totpService.getCode(key);
    expect(result).toBe("730364");

    const period = totpService.getTimeInterval(key);
    expect(period).toBe(60);
  });

  it("should handle steam keys", async () => {
    const key = "steam://HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ";
    const result = await totpService.getCode(key);
    expect(result).toBe("7W6CJ");

    const period = totpService.getTimeInterval(key);
    expect(period).toBe(30);
  });
});
