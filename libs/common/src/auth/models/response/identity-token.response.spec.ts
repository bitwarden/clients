import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";

import { makeEncString } from "../../../../spec";

describe("IdentityTokenResponse", () => {
  const accessToken = "testAccessToken";
  const tokenType = "Bearer";
  const expiresIn = 3600;
  const refreshToken = "testRefreshToken";
  const encryptedUserKey = makeEncString("testUserKey");

  it("should throw an error when access token is missing", () => {
    const response = {
      access_token: undefined as unknown,
      token_type: tokenType,
    };

    expect(() => new IdentityTokenResponse(response)).toThrow(
      "Identity response does not contain a valid access token",
    );
  });

  it("should throw an error when token type is missing", () => {
    const response = {
      access_token: accessToken,
      token_type: undefined as unknown,
    };

    expect(() => new IdentityTokenResponse(response)).toThrow(
      "Identity response does not contain a valid token type",
    );
  });

  it("should create response without optional fields", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toBeUndefined();
    expect(identityTokenResponse.refreshToken).toBeUndefined();
  });

  it("should create response with expires_in present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toEqual(expiresIn);
    expect(identityTokenResponse.refreshToken).toBeUndefined();
  });

  it("should create response with refresh_token present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      refresh_token: refreshToken,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toEqual(expiresIn);
    expect(identityTokenResponse.refreshToken).toEqual(refreshToken);
  });

  it("should create response with key is not present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      Key: undefined as unknown,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.key).toBeUndefined();
  });

  it("should create response with key present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      Key: encryptedUserKey.encryptedString,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.key).toEqual(encryptedUserKey);
  });

  it("should create response with user decryption options is not present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      UserDecryptionOptions: undefined as unknown,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.userDecryptionOptions).toBeUndefined();
  });

  it("should create response with user decryption options present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      UserDecryptionOptions: {},
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.userDecryptionOptions).toBeDefined();
  });
});
