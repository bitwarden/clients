import { SendAccessTokenResponse } from "@bitwarden/sdk-internal";

import { SendAccessToken } from "./send-access-token";

describe("SendAccessToken", () => {
  const sendId = "sendId";

  const NOW = 1_000_000; // fixed timestamp for predictable results

  const expiresAt: number = NOW + 1000 * 60 * 5; // 5 minutes from now

  const expiredExpiresAt: number = NOW - 1000 * 60 * 5; // 5 minutes ago

  let nowSpy: jest.SpyInstance<number, []>;

  beforeAll(() => {
    nowSpy = jest.spyOn(Date, "now");
  });

  beforeEach(() => {
    // Ensure every test starts from the same fixed time
    nowSpy.mockReturnValue(NOW);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should create a valid, unexpired token", () => {
    const token = new SendAccessToken(sendId, expiresAt);
    expect(token).toBeTruthy();
    expect(token.isExpired()).toBe(false);
  });

  it("should be expired after the expiration time", () => {
    const token = new SendAccessToken(sendId, expiredExpiresAt);
    expect(token.isExpired()).toBe(true);
  });

  it("should be considered expired if within 5 seconds of expiration", () => {
    const token = new SendAccessToken(sendId, expiresAt);
    nowSpy.mockReturnValue(expiresAt - 4_000); // 4 seconds before expiry
    expect(token.isExpired()).toBe(true);
  });

  it("should return the correct time until expiry in seconds", () => {
    const token = new SendAccessToken(sendId, expiresAt);
    expect(token.timeUntilExpirySeconds()).toBe(300); // 5 minutes
  });

  it("should return 0 if the token is expired", () => {
    const token = new SendAccessToken(sendId, expiredExpiresAt);
    expect(token.timeUntilExpirySeconds()).toBe(0);
  });

  it("should create a token from JSON", () => {
    const json = {
      token: sendId,
      expiresAt: expiresAt,
    };
    const token = SendAccessToken.fromJson(json);
    expect(token).toBeTruthy();
    expect(token.isExpired()).toBe(false);
  });

  it("should create a token from SendAccessTokenResponse", () => {
    const response = {
      token: sendId,
      expiresAt: expiresAt,
    } as SendAccessTokenResponse;
    const token = SendAccessToken.fromSendAccessTokenResponse(response);
    expect(token).toBeTruthy();
    expect(token.isExpired()).toBe(false);
  });
});
