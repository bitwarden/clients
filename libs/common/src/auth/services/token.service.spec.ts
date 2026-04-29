// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { FakeSingleUserStateProvider, FakeGlobalStateProvider } from "../../../spec";
import { UserId } from "../../types/guid";
import { SetTokensResult } from "../models/domain/set-tokens-result";

import { ACCOUNT_ACTIVE_ACCOUNT_ID } from "./account.service";
import { DecodedAccessToken, TokenService } from "./token.service";
import {
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_MEMORY,
  SECURITY_STAMP_MEMORY,
} from "./token.state";

describe("TokenService", () => {
  let tokenService: TokenService;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let globalStateProvider: FakeGlobalStateProvider;

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

  const userIdFromAccessToken: UserId = accessTokenDecoded.sub as UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    singleUserStateProvider = new FakeSingleUserStateProvider();
    globalStateProvider = new FakeGlobalStateProvider();

    tokenService = createTokenService();
  });

  it("instantiates", () => {
    expect(tokenService).not.toBeFalsy();
  });

  describe("Token observables", () => {
    describe("accessToken$", () => {
      it("emits null initially when no access token is set", async () => {
        const result = await firstValueFrom(tokenService.accessToken$(userIdFromAccessToken));
        expect(result).toBeNull();
      });

      it("emits token when ACCESS_TOKEN_MEMORY is set", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        const result = await firstValueFrom(tokenService.accessToken$(userIdFromAccessToken));
        expect(result).toEqual(accessTokenJwt);
      });
    });

    describe("refreshToken$", () => {
      it("emits null initially when no refresh token is set", async () => {
        const result = await firstValueFrom(tokenService.refreshToken$(userIdFromAccessToken));
        expect(result).toBeNull();
      });

      it("emits token when REFRESH_TOKEN_MEMORY is set", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
          .nextState("refreshToken");

        const result = await firstValueFrom(tokenService.refreshToken$(userIdFromAccessToken));
        expect(result).toEqual("refreshToken");
      });
    });

    describe("clientId$", () => {
      it("emits null initially when no client id is set", async () => {
        const result = await firstValueFrom(tokenService.clientId$(userIdFromAccessToken));
        expect(result).toBeNull();
      });

      it("emits value when API_KEY_CLIENT_ID_MEMORY is set", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState("clientId");

        const result = await firstValueFrom(tokenService.clientId$(userIdFromAccessToken));
        expect(result).toEqual("clientId");
      });
    });

    describe("clientSecret$", () => {
      it("emits null initially when no client secret is set", async () => {
        const result = await firstValueFrom(tokenService.clientSecret$(userIdFromAccessToken));
        expect(result).toBeNull();
      });

      it("emits value when API_KEY_CLIENT_SECRET_MEMORY is set", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState("clientSecret");

        const result = await firstValueFrom(tokenService.clientSecret$(userIdFromAccessToken));
        expect(result).toEqual("clientSecret");
      });
    });
  });

  describe("Access Token methods", () => {
    describe("hasAccessToken$", () => {
      it("returns true when an access token exists in memory", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));
        expect(result).toEqual(true);
      });

      it("returns false when no access token exists in memory", async () => {
        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));
        expect(result).toEqual(false);
      });
    });

    describe("setAccessToken", () => {
      it("throws an error when the access token is null", async () => {
        const result = tokenService.setAccessToken(null);
        await expect(result).rejects.toThrow("Access token is required.");
      });

      it("throws an error when an invalid token is passed in", async () => {
        const result = tokenService.setAccessToken("invalidToken");
        await expect(result).rejects.toThrow("JWT must have 3 parts");
      });

      it("should not throw an error as long as the token is valid", async () => {
        const result = tokenService.setAccessToken(accessTokenJwt);
        await expect(result).resolves.not.toThrow();
      });

      it("sets the access token in memory", async () => {
        const result = await tokenService.setAccessToken(accessTokenJwt);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
        ).toHaveBeenCalledWith(accessTokenJwt);
        expect(result).toEqual(accessTokenJwt);
      });
    });

    describe("getAccessToken", () => {
      it("gets the access token from memory when a user id is provided", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        const result = await tokenService.getAccessToken(userIdFromAccessToken);
        expect(result).toEqual(accessTokenJwt);
      });

      it("returns null when no access token exists in memory", async () => {
        const result = await tokenService.getAccessToken(userIdFromAccessToken);
        expect(result).toBeNull();
      });

      it("returns null when no user id is provided", async () => {
        const result = await tokenService.getAccessToken(null);
        expect(result).toBeNull();
      });
    });

    describe("clearAccessToken", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = tokenService.clearAccessToken();
        await expect(result).rejects.toThrow("User id not found. Cannot clear access token.");
      });

      it("clears the access token from memory when a user id is provided", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        await tokenService.clearAccessToken(userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
      });

      it("clears the access token from memory when there is a global active user", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await tokenService.clearAccessToken();

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });

    describe("decodeAccessToken", () => {
      it("retrieves the requested user's token when the passed in parameter is a Guid", async () => {
        tokenService.getAccessToken = jest.fn().mockResolvedValue(accessTokenJwt);

        const result = await tokenService.decodeAccessToken(userIdFromAccessToken);

        expect(result).toEqual(accessTokenDecoded);
        expect(tokenService.getAccessToken).toHaveBeenCalledWith(userIdFromAccessToken);
      });

      it("decodes the given token when a string is passed in that is not a Guid", async () => {
        tokenService.getAccessToken = jest.fn();

        const result = await tokenService.decodeAccessToken(accessTokenJwt);

        expect(result).toEqual(accessTokenDecoded);
        expect(tokenService.getAccessToken).not.toHaveBeenCalled();
      });

      it("throws an error when no access token is provided or retrievable from state", async () => {
        tokenService.getAccessToken = jest.fn().mockResolvedValue(null);

        const result = tokenService.decodeAccessToken();
        await expect(result).rejects.toThrow("Access token not found.");
      });

      it("decodes the access token when a valid one is stored", async () => {
        tokenService.getAccessToken = jest.fn().mockResolvedValue(accessTokenJwt);

        const result = await tokenService.decodeAccessToken();

        expect(result).toEqual(accessTokenDecoded);
      });
    });

    describe("Data methods", () => {
      describe("getTokenExpirationDate", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getTokenExpirationDate(userIdFromAccessToken);
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns null when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = await tokenService.getTokenExpirationDate(userIdFromAccessToken);
          expect(result).toBeNull();
        });

        it("returns null when the decoded access token does not have an expiration date", async () => {
          const accessTokenDecodedWithoutExp = { ...accessTokenDecoded };
          delete accessTokenDecodedWithoutExp.exp;
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithoutExp);

          const result = await tokenService.getTokenExpirationDate(userIdFromAccessToken);
          expect(result).toBeNull();
        });

        it("returns null when the decoded access token has a non numeric expiration date", async () => {
          const accessTokenDecodedWithNonNumericExp = {
            ...accessTokenDecoded,
            exp: "non-numeric",
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonNumericExp);

          const result = await tokenService.getTokenExpirationDate(userIdFromAccessToken);
          expect(result).toBeNull();
        });

        it("returns the expiration date of the access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getTokenExpirationDate(userIdFromAccessToken);
          expect(result).toEqual(new Date(accessTokenDecoded.exp * 1000));
        });
      });

      describe("tokenSecondsRemaining", () => {
        it("returns 0 when the tokenExpirationDate is null", async () => {
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(null);

          const result = await tokenService.tokenSecondsRemaining(userIdFromAccessToken);
          expect(result).toEqual(0);
        });

        it("returns the number of seconds remaining until the token expires", async () => {
          const fixedCurrentTime = new Date("2024-03-06T00:00:00Z");
          jest.useFakeTimers().setSystemTime(fixedCurrentTime);

          const nowInSeconds = Math.floor(Date.now() / 1000);
          const expirationInSeconds = nowInSeconds + 3600;
          const expectedSecondsRemaining = expirationInSeconds - nowInSeconds;

          const expirationDate = new Date(0);
          expirationDate.setUTCSeconds(expirationInSeconds);
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(expirationDate);

          const result = await tokenService.tokenSecondsRemaining(userIdFromAccessToken);
          expect(result).toEqual(expectedSecondsRemaining);

          jest.useRealTimers();
        });

        it("returns the number of seconds remaining until the token expires when given an offset", async () => {
          const fixedCurrentTime = new Date("2024-03-06T00:00:00Z");
          jest.useFakeTimers().setSystemTime(fixedCurrentTime);

          const nowInSeconds = Math.floor(Date.now() / 1000);
          const offsetSeconds = 300;
          const expirationInSeconds = nowInSeconds + 3600;
          const expectedSecondsRemaining = expirationInSeconds - nowInSeconds - offsetSeconds;

          const expirationDate = new Date(0);
          expirationDate.setUTCSeconds(expirationInSeconds);
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(expirationDate);

          const result = await tokenService.tokenSecondsRemaining(
            userIdFromAccessToken,
            offsetSeconds,
          );
          expect(result).toEqual(expectedSecondsRemaining);

          jest.useRealTimers();
        });
      });

      describe("tokenNeedsRefresh", () => {
        it("returns true when the token is within the default refresh threshold (5 min)", async () => {
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(60);

          const result = await tokenService.tokenNeedsRefresh(userIdFromAccessToken);
          expect(result).toEqual(true);
        });

        it("returns false when the token is outside the default refresh threshold (5 min)", async () => {
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(600);

          const result = await tokenService.tokenNeedsRefresh(userIdFromAccessToken);
          expect(result).toEqual(false);
        });

        it("returns true when the token is within the specified refresh threshold", async () => {
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(60);

          const result = await tokenService.tokenNeedsRefresh(userIdFromAccessToken, 2);
          expect(result).toEqual(true);
        });

        it("returns false when the token is outside the specified refresh threshold", async () => {
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(600);

          const result = await tokenService.tokenNeedsRefresh(userIdFromAccessToken, 5);
          expect(result).toEqual(false);
        });
      });

      describe("getUserId", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getUserId();
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = tokenService.getUserId();
          await expect(result).rejects.toThrow("No user id found");
        });

        it("throws an error when the decoded access token has a non-string user id", async () => {
          const accessTokenDecodedWithNonStringSub = { ...accessTokenDecoded, sub: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringSub);

          const result = tokenService.getUserId();
          await expect(result).rejects.toThrow("No user id found");
        });

        it("returns the user id from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getUserId();
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getUserIdFromAccessToken", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          await expect(result).rejects.toThrow("No user id found");
        });

        it("throws an error when the decoded access token has a non-string user id", async () => {
          const accessTokenDecodedWithNonStringSub = { ...accessTokenDecoded, sub: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringSub);

          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          await expect(result).rejects.toThrow("No user id found");
        });

        it("returns the user id from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getEmail", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getEmail();
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = tokenService.getEmail();
          await expect(result).rejects.toThrow("No email found");
        });

        it("throws an error when the decoded access token has a non-string email", async () => {
          const accessTokenDecodedWithNonStringEmail = { ...accessTokenDecoded, email: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringEmail);

          const result = tokenService.getEmail();
          await expect(result).rejects.toThrow("No email found");
        });

        it("returns the email from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getEmail();
          expect(result).toEqual(accessTokenDecoded.email);
        });
      });

      describe("getEmailVerified", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getEmailVerified();
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = tokenService.getEmailVerified();
          await expect(result).rejects.toThrow("No email verification found");
        });

        it("throws an error when the decoded access token has a non-boolean email_verified", async () => {
          const accessTokenDecodedWithNonBooleanEmailVerified = {
            ...accessTokenDecoded,
            email_verified: 123,
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonBooleanEmailVerified);

          const result = tokenService.getEmailVerified();
          await expect(result).rejects.toThrow("No email verification found");
        });

        it("returns the email_verified from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getEmailVerified();
          expect(result).toEqual(accessTokenDecoded.email_verified);
        });
      });

      describe("getName", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getName();
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns null when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = await tokenService.getName();
          expect(result).toBeNull();
        });

        it("returns null when the decoded access token has a non-string name", async () => {
          const accessTokenDecodedWithNonStringName = { ...accessTokenDecoded, name: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringName);

          const result = await tokenService.getName();
          expect(result).toBeNull();
        });

        it("returns the name from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getName();
          expect(result).toEqual(accessTokenDecoded.name);
        });
      });

      describe("getIssuer", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getIssuer();
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          const result = tokenService.getIssuer();
          await expect(result).rejects.toThrow("No issuer found");
        });

        it("throws an error when the decoded access token has a non-string iss", async () => {
          const accessTokenDecodedWithNonStringIss = { ...accessTokenDecoded, iss: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringIss);

          const result = tokenService.getIssuer();
          await expect(result).rejects.toThrow("No issuer found");
        });

        it("returns the issuer from the decoded access token when a valid access token is stored", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          const result = await tokenService.getIssuer();
          expect(result).toEqual(accessTokenDecoded.iss);
        });
      });

      describe("getIsExternal", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          const result = tokenService.getIsExternal(null);
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns false when the amr claim does not contain 'external'", async () => {
          const accessTokenDecodedWithoutExternalAmr = {
            ...accessTokenDecoded,
            amr: ["not-external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithoutExternalAmr);

          const result = await tokenService.getIsExternal(null);
          expect(result).toEqual(false);
        });

        it("returns true when the amr claim contains 'external'", async () => {
          const accessTokenDecodedWithExternalAmr = {
            ...accessTokenDecoded,
            amr: ["external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithExternalAmr);

          const result = await tokenService.getIsExternal(null);
          expect(result).toEqual(true);
        });

        it("passes the requested userId to decode", async () => {
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          await tokenService.getIsExternal(userIdFromAccessToken);

          expect(tokenService.decodeAccessToken).toHaveBeenCalledWith(userIdFromAccessToken);
        });
      });
    });
  });

  describe("Refresh Token methods", () => {
    const refreshToken = "refreshToken";

    describe("setRefreshToken", () => {
      it("throws an error when no user id is provided", async () => {
        const result = (tokenService as any).setRefreshToken(refreshToken, null);
        await expect(result).rejects.toThrow("User id not found. Cannot save refresh token.");
      });

      it("sets the refresh token in memory when given a user id", async () => {
        await (tokenService as any).setRefreshToken(refreshToken, userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
        ).toHaveBeenCalledWith(refreshToken);
      });
    });

    describe("getRefreshToken", () => {
      it("returns null when no user id is provided", async () => {
        const result = await tokenService.getRefreshToken(null);
        expect(result).toBeNull();
      });

      it("returns null when no refresh token is found in memory", async () => {
        const result = await tokenService.getRefreshToken(userIdFromAccessToken);
        expect(result).toBeNull();
      });

      it("gets the refresh token from memory when a user id is specified", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
          .nextState(refreshToken);

        const result = await tokenService.getRefreshToken(userIdFromAccessToken);
        expect(result).toEqual(refreshToken);
      });
    });

    describe("clearRefreshToken", () => {
      it("throws an error when no user id is provided", async () => {
        const result = (tokenService as any).clearRefreshToken();
        await expect(result).rejects.toThrow("User id not found. Cannot clear refresh token.");
      });

      it("clears the refresh token from memory when given a user id", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
          .nextState(refreshToken);

        await (tokenService as any).clearRefreshToken(userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Client Id methods", () => {
    const clientId = "clientId";

    describe("setClientId", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = tokenService.setClientId(clientId);
        await expect(result).rejects.toThrow("User id not found. Cannot save client id.");
      });

      it("sets the client id in memory when there is an active user in global state", async () => {
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await tokenService.setClientId(clientId);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(clientId);
      });

      it("sets the client id in memory when given a user id", async () => {
        await tokenService.setClientId(clientId, userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(clientId);
      });
    });

    describe("getClientId", () => {
      it("returns null when no client id is found in memory", async () => {
        const result = await tokenService.getClientId(userIdFromAccessToken);
        expect(result).toBeNull();
      });

      it("gets the client id from memory when given a user id", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState(clientId);

        const result = await tokenService.getClientId(userIdFromAccessToken);
        expect(result).toEqual(clientId);
      });
    });

    describe("clearClientId", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = (tokenService as any).clearClientId();
        await expect(result).rejects.toThrow("User id not found. Cannot clear client id.");
      });

      it("clears the client id from memory when a user id is specified", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState(clientId);

        await (tokenService as any).clearClientId(userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
      });

      it("clears the client id from memory when there is a global active user", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState(clientId);

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await (tokenService as any).clearClientId();

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Client Secret methods", () => {
    const clientSecret = "clientSecret";

    describe("setClientSecret", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = tokenService.setClientSecret(clientSecret);
        await expect(result).rejects.toThrow("User id not found. Cannot save client secret.");
      });

      it("sets the client secret in memory when there is an active user in global state", async () => {
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await tokenService.setClientSecret(clientSecret);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(clientSecret);
      });

      it("sets the client secret in memory when a user id is specified", async () => {
        await tokenService.setClientSecret(clientSecret, userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(clientSecret);
      });
    });

    describe("getClientSecret", () => {
      it("returns null when no client secret is found in memory", async () => {
        const result = await tokenService.getClientSecret(userIdFromAccessToken);
        expect(result).toBeNull();
      });

      it("gets the client secret from memory when a user id is specified", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState(clientSecret);

        const result = await tokenService.getClientSecret(userIdFromAccessToken);
        expect(result).toEqual(clientSecret);
      });
    });

    describe("clearClientSecret", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = (tokenService as any).clearClientSecret();
        await expect(result).rejects.toThrow("User id not found. Cannot clear client secret.");
      });

      it("clears the client secret from memory when a user id is specified", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState(clientSecret);

        await (tokenService as any).clearClientSecret(userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(null);
      });

      it("clears the client secret from memory when there is a global active user", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState(clientSecret);

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await (tokenService as any).clearClientSecret();

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("setTokens", () => {
    it("calls to set all tokens after deriving user id from the access token when called with valid params", async () => {
      const refreshToken = "refreshToken";
      const clientId = "clientId";
      const clientSecret = "clientSecret";

      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn().mockReturnValue(refreshToken);
      tokenService.setClientId = jest.fn().mockReturnValue(clientId);
      tokenService.setClientSecret = jest.fn().mockReturnValue(clientSecret);

      const result = await tokenService.setTokens(accessTokenJwt, refreshToken, [
        clientId,
        clientSecret,
      ]);

      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        userIdFromAccessToken,
      );

      expect((tokenService as any).setRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        userIdFromAccessToken,
      );

      expect(tokenService.setClientId).toHaveBeenCalledWith(clientId, userIdFromAccessToken);
      expect(tokenService.setClientSecret).toHaveBeenCalledWith(
        clientSecret,
        userIdFromAccessToken,
      );

      expect(result).toStrictEqual(
        new SetTokensResult(accessTokenJwt, refreshToken, [clientId, clientSecret]),
      );
    });

    it("does not try to set the refresh token when it is not passed in", async () => {
      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn();
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      const result = await tokenService.setTokens(accessTokenJwt, null);

      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        userIdFromAccessToken,
      );

      expect((tokenService as any).setRefreshToken).not.toHaveBeenCalled();
      expect(tokenService.setClientId).not.toHaveBeenCalled();
      expect(tokenService.setClientSecret).not.toHaveBeenCalled();

      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt));
    });

    it("does not try to set client id and client secret when they are not passed in", async () => {
      const refreshToken = "refreshToken";

      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn().mockReturnValue(refreshToken);
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      const result = await tokenService.setTokens(accessTokenJwt, refreshToken);

      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        userIdFromAccessToken,
      );

      expect((tokenService as any).setRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        userIdFromAccessToken,
      );

      expect(tokenService.setClientId).not.toHaveBeenCalled();
      expect(tokenService.setClientSecret).not.toHaveBeenCalled();

      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt, refreshToken));
    });

    it("throws an error when the access token is invalid", async () => {
      const result = tokenService.setTokens("invalidToken", "refreshToken");
      await expect(result).rejects.toThrow("JWT must have 3 parts");
    });

    it("throws an error when the access token is missing", async () => {
      const result = tokenService.setTokens(null, "refreshToken");
      await expect(result).rejects.toThrow("Access token is required.");
    });

    it("does not throw an error or set the refresh token when the refresh token is missing", async () => {
      (tokenService as any).setRefreshToken = jest.fn();

      const result = await tokenService.setTokens(accessTokenJwt, null);

      expect((tokenService as any).setRefreshToken).not.toHaveBeenCalled();
      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt));
    });
  });

  describe("clearTokens", () => {
    it("calls to clear all tokens when given a specified user id", async () => {
      const userId = "userId" as UserId;

      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      await tokenService.clearTokens(userId);

      expect(tokenService.clearAccessToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearRefreshToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientId).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientSecret).toHaveBeenCalledWith(userId);
    });

    it("calls to clear all tokens when there is an active user", async () => {
      const userId = "userId" as UserId;

      globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userId);

      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      await tokenService.clearTokens();

      expect(tokenService.clearAccessToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearRefreshToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientId).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientSecret).toHaveBeenCalledWith(userId);
    });

    it("does not call to clear all tokens when no user id is provided and there is no active user in global state", async () => {
      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      const result = tokenService.clearTokens();
      await expect(result).rejects.toThrow("User id not found. Cannot clear tokens.");
    });
  });

  describe("Two Factor Token methods", () => {
    describe("setTwoFactorToken", () => {
      it("sets the email and two factor token when there hasn't been a previous record (initializing the record)", async () => {
        const email = "testUser@email.com";
        const twoFactorToken = "twoFactorTokenForTestUser";

        await tokenService.setTwoFactorToken(email, twoFactorToken);

        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({ [email]: twoFactorToken });
      });

      it("sets the email and two factor token when there is an initialized value already (updating the existing record)", async () => {
        const email = "testUser@email.com";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "otherUserTwoFactorToken",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        await tokenService.setTwoFactorToken(email, twoFactorToken);

        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({ [email]: twoFactorToken, ...initialTwoFactorTokenRecord });
      });
    });

    describe("getTwoFactorToken", () => {
      it("returns the two factor token when given an email", async () => {
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        const result = await tokenService.getTwoFactorToken(email);
        expect(result).toEqual(twoFactorToken);
      });

      it("does not return the two factor token when given an email that doesn't exist", async () => {
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "twoFactorTokenForOtherUser",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        const result = await tokenService.getTwoFactorToken("testUser");
        expect(result).toEqual(undefined);
      });

      it("returns null when there is no two factor token record", async () => {
        globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextState(null);

        const result = await tokenService.getTwoFactorToken("testUser");
        expect(result).toEqual(null);
      });
    });

    describe("clearTwoFactorToken", () => {
      it("clears the two factor token for the given email when a record exists", async () => {
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        await tokenService.clearTwoFactorToken(email);

        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({});
      });

      it("initializes the record and deletes the value when the record doesn't exist", async () => {
        await tokenService.clearTwoFactorToken("testUser");

        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({});
      });
    });
  });

  describe("Security Stamp methods", () => {
    const mockSecurityStamp = "securityStamp";

    describe("setSecurityStamp", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = tokenService.setSecurityStamp(mockSecurityStamp);
        await expect(result).rejects.toThrow("User id not found. Cannot set security stamp.");
      });

      it("sets the security stamp in memory when there is an active user in global state", async () => {
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        await tokenService.setSecurityStamp(mockSecurityStamp);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY).nextMock,
        ).toHaveBeenCalledWith(mockSecurityStamp);
      });

      it("sets the security stamp in memory when a user id is specified", async () => {
        await tokenService.setSecurityStamp(mockSecurityStamp, userIdFromAccessToken);

        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY).nextMock,
        ).toHaveBeenCalledWith(mockSecurityStamp);
      });
    });

    describe("getSecurityStamp", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        const result = tokenService.getSecurityStamp();
        await expect(result).rejects.toThrow("User id not found. Cannot get security stamp.");
      });

      it("returns the security stamp from memory when no user id is specified (uses global active user)", async () => {
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY)
          .nextState(mockSecurityStamp);

        const result = await tokenService.getSecurityStamp();
        expect(result).toEqual(mockSecurityStamp);
      });

      it("returns the security stamp from memory when a user id is specified", async () => {
        singleUserStateProvider
          .getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY)
          .nextState(mockSecurityStamp);

        const result = await tokenService.getSecurityStamp(userIdFromAccessToken);
        expect(result).toEqual(mockSecurityStamp);
      });
    });
  });

  // Helpers
  function createTokenService() {
    return new TokenService(singleUserStateProvider, globalStateProvider);
  }
});
