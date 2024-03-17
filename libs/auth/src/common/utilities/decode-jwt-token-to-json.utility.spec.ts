import { DecodedAccessToken } from "@bitwarden/common/auth/services/token.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { decodeJwtTokenToJson } from "./decode-jwt-token-to-json.utility";

describe("decodeJwtTokenToJson", () => {
  const accessTokenJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0IiwibmJmIjoxNzA5MzI0MTExLCJpYXQiOjE3MDkzMjQxMTEsImV4cCI6MTcwOTMyNzcxMSwic2NvcGUiOlsiYXBpIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbIkFwcGxpY2F0aW9uIl0sImNsaWVudF9pZCI6IndlYiIsInN1YiI6ImVjZTcwYTEzLTcyMTYtNDNjNC05OTc3LWIxMDMwMTQ2ZTFlNyIsImF1dGhfdGltZSI6MTcwOTMyNDEwNCwiaWRwIjoiYml0d2FyZGVuIiwicHJlbWl1bSI6ZmFsc2UsImVtYWlsIjoiZXhhbXBsZUBiaXR3YXJkZW4uY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJzc3RhbXAiOiJHWTdKQU82NENLS1RLQkI2WkVBVVlMMldPUVU3QVNUMiIsIm5hbWUiOiJUZXN0IFVzZXIiLCJvcmdvd25lciI6WyI5MmI0OTkwOC1iNTE0LTQ1YTgtYmFkYi1iMTAzMDE0OGZlNTMiLCIzOGVkZTMyMi1iNGI0LTRiZDgtOWUwOS1iMTA3MDExMmRjMTEiLCJiMmQwNzAyOC1hNTgzLTRjM2UtOGQ2MC1iMTA3MDExOThjMjkiLCJiZjkzNGJhMi0wZmQ0LTQ5ZjItYTk1ZS1iMTA3MDExZmM5ZTYiLCJjMGI3Zjc1ZC0wMTVmLTQyYzktYjNhNi1iMTA4MDE3NjA3Y2EiXSwiZGV2aWNlIjoiNGI4NzIzNjctMGRhNi00MWEwLWFkY2ItNzdmMmZlZWZjNGY0IiwianRpIjoiNzUxNjFCRTQxMzFGRjVBMkRFNTExQjhDNEUyRkY4OUEifQ.n7roP8sSbfwcYdvRxZNZds27IK32TW6anorE6BORx_Q";

  const accessTokenDecoded: DecodedAccessToken = {
    iss: "http://localhost",
    nbf: 1709324111,
    iat: 1709324111,
    exp: 1709327711,
    scope: ["api", "offline_access"],
    amr: ["Application"],
    client_id: "web",
    sub: "ece70a13-7216-43c4-9977-b1030146e1e7", // user id
    auth_time: 1709324104,
    idp: "bitwarden",
    premium: false,
    email: "example@bitwarden.com",
    email_verified: false,
    sstamp: "GY7JAO64CKKTKBB6ZEAUYL2WOQU7AST2",
    name: "Test User",
    orgowner: [
      "92b49908-b514-45a8-badb-b1030148fe53",
      "38ede322-b4b4-4bd8-9e09-b1070112dc11",
      "b2d07028-a583-4c3e-8d60-b10701198c29",
      "bf934ba2-0fd4-49f2-a95e-b107011fc9e6",
      "c0b7f75d-015f-42c9-b3a6-b108017607ca",
    ],
    device: "4b872367-0da6-41a0-adcb-77f2feefc4f4",
    jti: "75161BE4131FF5A2DE511B8C4E2FF89A",
  };

  it("should decode the JWT token", () => {
    // Act
    const result = decodeJwtTokenToJson(accessTokenJwt);

    // Assert
    expect(result).toEqual(accessTokenDecoded);
  });

  it("should throw an error if the JWT token is null", () => {
    // Act && Assert
    expect(() => decodeJwtTokenToJson(null)).toThrow("JWT token not found");
  });

  it("should throw an error if the JWT token is missing 3 parts", () => {
    // Act && Assert
    expect(() => decodeJwtTokenToJson("invalidToken")).toThrow("JWT must have 3 parts");
  });

  it("should throw an error if the JWT token payload contains invalid JSON", () => {
    // Arrange: Create a token with a valid format but with a payload that's valid Base64 but not valid JSON
    const header = btoa(JSON.stringify({ alg: "none" }));
    // Create a Base64-encoded string which fails to parse as JSON
    const payload = btoa("invalid JSON");
    const signature = "signature";
    const malformedToken = `${header}.${payload}.${signature}`;

    // Act & Assert
    expect(() => decodeJwtTokenToJson(malformedToken)).toThrow(
      "Cannot parse the token's payload into JSON",
    );
  });

  it("should throw an error if the JWT token cannot be decoded", () => {
    // Arrange: Create a token with a valid format
    const header = btoa(JSON.stringify({ alg: "none" }));
    const payload = "invalidPayloadBecauseWeWillMockTheFailure";
    const signature = "signature";
    const malformedToken = `${header}.${payload}.${signature}`;

    // Mock Utils.fromUrlB64ToUtf8 to throw an error for this specific payload
    jest.spyOn(Utils, "fromUrlB64ToUtf8").mockImplementation((input) => {
      if (input === payload) {
        throw new Error("Mock error");
      }
      return input; // Default behavior for other inputs
    });

    // Act & Assert
    expect(() => decodeJwtTokenToJson(malformedToken)).toThrow("Cannot decode the token");

    // Restore original function so other tests are not affected
    jest.restoreAllMocks();
  });
});
