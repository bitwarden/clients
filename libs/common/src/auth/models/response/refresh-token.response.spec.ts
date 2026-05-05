import { RefreshTokenResponse } from "./refresh-token.response";

describe("RefreshTokenResponse", () => {
  const accessToken = "testAccessToken";
  const tokenType = "Bearer";
  const expiresIn = 3600;
  const refreshToken = "testRefreshToken";

  it("should throw when access_token is missing", () => {
    const response = {
      access_token: undefined as unknown,
      token_type: tokenType,
    };

    expect(() => new RefreshTokenResponse(response)).toThrow(
      "Refresh token response does not contain a valid access token",
    );
  });

  it("should throw when token_type is missing", () => {
    const response = {
      access_token: accessToken,
      token_type: undefined as unknown,
    };

    expect(() => new RefreshTokenResponse(response)).toThrow(
      "Refresh token response does not contain a valid token type",
    );
  });

  it("should construct with only required fields", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
    };

    const result = new RefreshTokenResponse(response);
    expect(result.accessToken).toEqual(accessToken);
    expect(result.tokenType).toEqual(tokenType);
    expect(result.expiresIn).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
  });

  it("should populate expiresIn when expires_in is present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
    };

    const result = new RefreshTokenResponse(response);
    expect(result.expiresIn).toEqual(expiresIn);
  });

  it("should populate refreshToken when refresh_token is present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      refresh_token: refreshToken,
    };

    const result = new RefreshTokenResponse(response);
    expect(result.refreshToken).toEqual(refreshToken);
  });

  it("should construct with all fields present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      refresh_token: refreshToken,
    };

    const result = new RefreshTokenResponse(response);
    expect(result.accessToken).toEqual(accessToken);
    expect(result.tokenType).toEqual(tokenType);
    expect(result.expiresIn).toEqual(expiresIn);
    expect(result.refreshToken).toEqual(refreshToken);
  });

  it("should ignore extra fields and not throw (PM-35246 regression)", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      Kdf: 0,
      KdfIterations: 600_000,
    };

    const result = new RefreshTokenResponse(response);
    expect(result.accessToken).toEqual(accessToken);
    expect(result.tokenType).toEqual(tokenType);
    expect(result.expiresIn).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
  });
});
