import { mock } from "jest-mock-extended";

import { FakeSingleUserStateProvider, FakeGlobalStateProvider } from "../../../spec";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { UserId } from "../../types/guid";

import { ACCOUNT_ACTIVE_ACCOUNT_ID } from "./account.service";
import { DecodedAccessToken, TokenService } from "./token.service";
import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
} from "./token.state";

describe("TokenService", () => {
  let tokenService: TokenService;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let globalStateProvider: FakeGlobalStateProvider;

  const secureStorageService = mock<AbstractStorageService>();

  const memoryVaultTimeoutAction = VaultTimeoutAction.LogOut;
  const memoryVaultTimeout = 30;

  const diskVaultTimeoutAction = VaultTimeoutAction.Lock;
  const diskVaultTimeout: number = null;

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

  const secureStorageOptions: StorageOptions = {
    storageLocation: StorageLocation.Disk,
    useSecureStorage: true,
    userId: userIdFromAccessToken,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    singleUserStateProvider = new FakeSingleUserStateProvider();
    globalStateProvider = new FakeGlobalStateProvider();

    const supportsSecureStorage = false; // default to false; tests will override as needed
    tokenService = createTokenService(supportsSecureStorage);
  });

  it("instantiates", () => {
    expect(tokenService).not.toBeFalsy();
  });

  describe("Access Token methods", () => {
    const accessTokenPartialSecureStorageKey = `_accessToken`;
    const accessTokenSecureStorageKey = `${userIdFromAccessToken}${accessTokenPartialSecureStorageKey}`;

    describe("setAccessToken", () => {
      it("should throw an error if the access token is null", async () => {
        // Act
        const result = tokenService.setAccessToken(null, VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).rejects.toThrow("Access token is required.");
      });

      it("should throw an error if an invalid token is passed in", async () => {
        // Act
        const result = tokenService.setAccessToken("invalidToken", VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).rejects.toThrow("JWT must have 3 parts");
      });

      it("should not throw an error as long as the token is valid", async () => {
        // Act
        const result = tokenService.setAccessToken(accessTokenJwt, VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).resolves.not.toThrow();
      });

      describe("Memory storage tests", () => {
        it("should set the access token in memory", async () => {
          // Act
          await tokenService.setAccessToken(
            accessTokenJwt,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
          );
          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("should set the access token in disk", async () => {
          // Act
          await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should set the access token in secure storage, null out data on disk or in memory, and set a flag to indicate the token has been migrated", async () => {
          // Arrange:

          // For testing purposes, let's assume that the access token is already in disk and memory
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Act
          await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert

          // assert that the access token was set in secure storage
          expect(secureStorageService.save).toHaveBeenCalledWith(
            accessTokenSecureStorageKey,
            accessTokenJwt,
            secureStorageOptions,
          );

          // assert data was migrated out of disk and memory + flag was set
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(
            singleUserStateProvider.getFake(
              userIdFromAccessToken,
              ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE,
            ).nextMock,
          ).toHaveBeenCalledWith(true);
        });
      });
    });

    describe("getAccessToken", () => {
      it("should return undefined if no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getAccessToken();
        // Assert
        expect(result).toBeUndefined();
      });

      it("should return null if no access token is found in memory, disk, or secure storage", async () => {
        // Arrange
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        const result = await tokenService.getAccessToken();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("should get the access token from memory with no user id specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getAccessToken();

          // Assert
          expect(result).toEqual(accessTokenJwt);
        });

        it("should get the access token from memory for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("should get the access token from disk with no user id specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getAccessToken();
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });

        it("should get the access token from disk for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should get the access token from secure storage when no user id is specified and the migration flag is set to true", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          secureStorageService.get.mockResolvedValue(accessTokenJwt);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // set access token migration flag to true
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, true]);

          // Act
          const result = await tokenService.getAccessToken();
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });

        it("should get the access token from secure storage when user id is specified and the migration flag set to true", async () => {
          // Arrange

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          secureStorageService.get.mockResolvedValue(accessTokenJwt);

          // set access token migration flag to true
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, true]);

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });

        it("should fallback and get the access token from disk when user id is specified and the migration flag is set to false even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // set access token migration flag to false
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, false]);

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);

          // Assert
          expect(result).toEqual(accessTokenJwt);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });

        it("should fallback and get the access token from disk when no user id is specified and the migration flag is set to false even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // set access token migration flag to false
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, false]);

          // Act
          const result = await tokenService.getAccessToken();

          // Assert
          expect(result).toEqual(accessTokenJwt);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });
      });
    });

    describe("clearAccessToken", () => {
      it("should throw an error if no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.clearAccessToken();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear access token.");
      });

      describe("Secure storage enabled", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should clear the access token from all storage locations for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Act
          await tokenService.clearAccessToken(userIdFromAccessToken);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(secureStorageService.remove).toHaveBeenCalledWith(
            accessTokenSecureStorageKey,
            secureStorageOptions,
          );
        });

        it("should clear the access token from all storage locations for the global active user", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, accessTokenJwt]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          await tokenService.clearAccessToken();

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(secureStorageService.remove).toHaveBeenCalledWith(
            accessTokenSecureStorageKey,
            secureStorageOptions,
          );
        });
      });
    });

    describe("decodeAccessToken", () => {
      it("should throw an error if no access token provided or retrieved from state", async () => {
        // Access
        tokenService.getAccessToken = jest.fn().mockResolvedValue(null);

        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.decodeAccessToken();
        // Assert
        await expect(result).rejects.toThrow("Access token not found.");
      });

      it("should decode the access token", async () => {
        // Arrange
        tokenService.getAccessToken = jest.fn().mockResolvedValue(accessTokenJwt);

        // Act
        const result = await tokenService.decodeAccessToken();

        // Assert
        expect(result).toEqual(accessTokenDecoded);
      });
    });

    describe("Data methods", () => {
      describe("getTokenExpirationDate", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getTokenExpirationDate();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should return null if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toBeNull();
        });

        it("should return null if the decoded access token does not have an expiration date", async () => {
          // Arrange
          const accessTokenDecodedWithoutExp = { ...accessTokenDecoded };
          delete accessTokenDecodedWithoutExp.exp;
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithoutExp);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toBeNull();
        });

        it("should return null if the decoded access token has an non numeric expiration date", async () => {
          // Arrange
          const accessTokenDecodedWithNonNumericExp = { ...accessTokenDecoded, exp: "non-numeric" };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonNumericExp);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toBeNull();
        });

        it("should return the expiration date of the access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toEqual(new Date(accessTokenDecoded.exp * 1000));
        });
      });

      describe("tokenSecondsRemaining", () => {
        it("should return 0 if the tokenExpirationDate is null", async () => {
          // Arrange
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.tokenSecondsRemaining();

          // Assert
          expect(result).toEqual(0);
        });

        it("should return the number of seconds remaining until the token expires", async () => {
          // Arrange
          // Lock the time to ensure a consistent test environment
          // otherwise we have flaky issues with set system time date and the Date.now() call.
          const fixedCurrentTime = new Date("2024-03-06T00:00:00Z");
          jest.useFakeTimers().setSystemTime(fixedCurrentTime);

          const nowInSeconds = Math.floor(Date.now() / 1000);
          const expirationInSeconds = nowInSeconds + 3600; // token expires in 1 hr
          const expectedSecondsRemaining = expirationInSeconds - nowInSeconds;

          const expirationDate = new Date(0);
          expirationDate.setUTCSeconds(expirationInSeconds);
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(expirationDate);

          // Act
          const result = await tokenService.tokenSecondsRemaining();

          // Assert
          expect(result).toEqual(expectedSecondsRemaining);

          // Reset the timers to be the real ones
          jest.useRealTimers();
        });

        it("should return the number of seconds remaining until the token expires, considering an offset", async () => {
          // Arrange
          // Lock the time to ensure a consistent test environment
          // otherwise we have flaky issues with set system time date and the Date.now() call.
          const fixedCurrentTime = new Date("2024-03-06T00:00:00Z");
          jest.useFakeTimers().setSystemTime(fixedCurrentTime);

          const nowInSeconds = Math.floor(Date.now() / 1000);
          const offsetSeconds = 300; // 5 minute offset
          const expirationInSeconds = nowInSeconds + 3600; // token expires in 1 hr
          const expectedSecondsRemaining = expirationInSeconds - nowInSeconds - offsetSeconds; // Adjust for offset

          const expirationDate = new Date(0);
          expirationDate.setUTCSeconds(expirationInSeconds);
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(expirationDate);

          // Act
          const result = await tokenService.tokenSecondsRemaining(offsetSeconds);

          // Assert
          expect(result).toEqual(expectedSecondsRemaining);

          // Reset the timers to be the real ones
          jest.useRealTimers();
        });
      });

      describe("tokenNeedsRefresh", () => {
        it("should return true if token is within the default refresh threshold (5 min)", async () => {
          // Arrange
          const tokenSecondsRemaining = 60;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh();

          // Assert
          expect(result).toEqual(true);
        });

        it("should return false if token is outside the default refresh threshold (5 min)", async () => {
          // Arrange
          const tokenSecondsRemaining = 600;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh();

          // Assert
          expect(result).toEqual(false);
        });

        it("should return true if token is within the specified refresh threshold", async () => {
          // Arrange
          const tokenSecondsRemaining = 60;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh(2);

          // Assert
          expect(result).toEqual(true);
        });

        it("should return false if token is outside the specified refresh threshold", async () => {
          // Arrange
          const tokenSecondsRemaining = 600;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh(5);

          // Assert
          expect(result).toEqual(false);
        });
      });

      describe("getUserId", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getUserId();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should throw an error if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getUserId();
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("should throw an error if the decoded access token has a non-string user id", async () => {
          // Arrange
          const accessTokenDecodedWithNonStringSub = { ...accessTokenDecoded, sub: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringSub);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getUserId();
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("should return the user id from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getUserId();

          // Assert
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getUserIdFromAccessToken", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should throw an error if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("should throw an error if the decoded access token has a non-string user id", async () => {
          // Arrange
          const accessTokenDecodedWithNonStringSub = { ...accessTokenDecoded, sub: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringSub);

          // Act
          // note: don't await here because we want to test the error
          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("should return the user id from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);

          // Assert
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getEmail", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmail();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should throw an error if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmail();
          // Assert
          await expect(result).rejects.toThrow("No email found");
        });

        it("should throw an error if the decoded access token has a non-string email", async () => {
          // Arrange
          const accessTokenDecodedWithNonStringEmail = { ...accessTokenDecoded, email: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringEmail);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmail();
          // Assert
          await expect(result).rejects.toThrow("No email found");
        });

        it("should return the email from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getEmail();

          // Assert
          expect(result).toEqual(accessTokenDecoded.email);
        });
      });

      describe("getEmailVerified", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmailVerified();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should throw an error if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmailVerified();
          // Assert
          await expect(result).rejects.toThrow("No email verification found");
        });

        it("should throw an error if the decoded access token has a non-boolean email_verified", async () => {
          // Arrange
          const accessTokenDecodedWithNonBooleanEmailVerified = {
            ...accessTokenDecoded,
            email_verified: 123,
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonBooleanEmailVerified);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmailVerified();
          // Assert
          await expect(result).rejects.toThrow("No email verification found");
        });

        it("should return the email_verified from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getEmailVerified();

          // Assert
          expect(result).toEqual(accessTokenDecoded.email_verified);
        });
      });

      describe("getName", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getName();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should return null if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.getName();

          // Assert
          expect(result).toBeNull();
        });

        it("should return null if the decoded access token has a non-string name", async () => {
          // Arrange
          const accessTokenDecodedWithNonStringName = { ...accessTokenDecoded, name: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringName);

          // Act
          const result = await tokenService.getName();

          // Assert
          expect(result).toBeNull();
        });

        it("should return the name from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getName();

          // Assert
          expect(result).toEqual(accessTokenDecoded.name);
        });
      });

      describe("getIssuer", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIssuer();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should throw an error if the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIssuer();
          // Assert
          await expect(result).rejects.toThrow("No issuer found");
        });

        it("should throw an error if the decoded access token has a non-string iss", async () => {
          // Arrange
          const accessTokenDecodedWithNonStringIss = { ...accessTokenDecoded, iss: 123 };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithNonStringIss);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIssuer();
          // Assert
          await expect(result).rejects.toThrow("No issuer found");
        });

        it("should return the issuer from the decoded access token", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getIssuer();

          // Assert
          expect(result).toEqual(accessTokenDecoded.iss);
        });
      });

      describe("getIsExternal", () => {
        it("should throw an error if the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIsExternal();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("should return false if the amr (Authentication Method Reference) claim does not contain 'external'", async () => {
          // Arrange
          const accessTokenDecodedWithoutExternalAmr = {
            ...accessTokenDecoded,
            amr: ["not-external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithoutExternalAmr);

          // Act
          const result = await tokenService.getIsExternal();

          // Assert
          expect(result).toEqual(false);
        });

        it("should return true if the amr (Authentication Method Reference) claim contains 'external'", async () => {
          // Arrange
          const accessTokenDecodedWithExternalAmr = {
            ...accessTokenDecoded,
            amr: ["external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithExternalAmr);

          // Act
          const result = await tokenService.getIsExternal();

          // Assert
          expect(result).toEqual(true);
        });
      });
    });
  });

  describe("Refresh Token methods", () => {
    const refreshToken = "refreshToken";
    const refreshTokenPartialSecureStorageKey = `_refreshToken`;
    const refreshTokenSecureStorageKey = `${userIdFromAccessToken}${refreshTokenPartialSecureStorageKey}`;

    describe("setRefreshToken", () => {
      it("should throw an error if no user id is provided", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).setRefreshToken(
          refreshToken,
          VaultTimeoutAction.Lock,
          null,
        );
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save refresh token.");
      });

      describe("Memory storage tests", () => {
        it("should set the refresh token in memory for the specified user id", async () => {
          // Act
          await (tokenService as any).setRefreshToken(
            refreshToken,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(refreshToken);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("should set the refresh token in disk for the specified user id", async () => {
          // Act
          await (tokenService as any).setRefreshToken(
            refreshToken,
            diskVaultTimeoutAction,
            diskVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(refreshToken);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should set the refresh token in secure storage, null out data on disk or in memory, and set a flag to indicate the token has been migrated for the specified user id", async () => {
          // Arrange:
          // For testing purposes, let's assume that the token is already in disk and memory
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // Act
          await (tokenService as any).setRefreshToken(
            refreshToken,
            diskVaultTimeoutAction,
            diskVaultTimeout,
            userIdFromAccessToken,
          );
          // Assert

          // assert that the refresh token was set in secure storage
          expect(secureStorageService.save).toHaveBeenCalledWith(
            refreshTokenSecureStorageKey,
            refreshToken,
            secureStorageOptions,
          );

          // assert data was migrated out of disk and memory + flag was set
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(
            singleUserStateProvider.getFake(
              userIdFromAccessToken,
              REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE,
            ).nextMock,
          ).toHaveBeenCalledWith(true);
        });
      });
    });

    describe("getRefreshToken", () => {
      it("should return undefined if no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await (tokenService as any).getRefreshToken();
        // Assert
        expect(result).toBeUndefined();
      });

      it("should return null if no refresh token is found in memory, disk, or secure storage", async () => {
        // Arrange
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        const result = await (tokenService as any).getRefreshToken();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("should get the refresh token from memory with no user id specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();

          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("should get the refresh token from memory for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(refreshToken);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("should get the refresh token from disk with no user id specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("should get the refresh token from disk for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(refreshToken);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should get the refresh token from secure storage when no user id is specified and the migration flag is set to true", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          secureStorageService.get.mockResolvedValue(refreshToken);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // set access token migration flag to true
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, true]);

          // Act
          const result = await tokenService.getRefreshToken();
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("should get the refresh token from secure storage when user id is specified and the migration flag set to true", async () => {
          // Arrange

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          secureStorageService.get.mockResolvedValue(refreshToken);

          // set access token migration flag to true
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, true]);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("should fallback and get the refresh token from disk when user id is specified and the migration flag is set to false even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // set refresh token migration flag to false
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, false]);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);

          // Assert
          expect(result).toEqual(refreshToken);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });

        it("should fallback and get the refresh token from disk when no user id is specified and the migration flag is set to false even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // set access token migration flag to false
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MIGRATED_TO_SECURE_STORAGE)
            .stateSubject.next([userIdFromAccessToken, false]);

          // Act
          const result = await tokenService.getRefreshToken();

          // Assert
          expect(result).toEqual(refreshToken);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });
      });
    });

    describe("clearRefreshToken", () => {
      it("should throw an error if no user id is provided", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).clearRefreshToken();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear refresh token.");
      });

      describe("Secure storage enabled", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should clear the refresh token from all storage locations for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .stateSubject.next([userIdFromAccessToken, refreshToken]);

          // Act
          await (tokenService as any).clearRefreshToken(userIdFromAccessToken);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(secureStorageService.remove).toHaveBeenCalledWith(
            refreshTokenSecureStorageKey,
            secureStorageOptions,
          );
        });
      });
    });
  });

  describe("Client Id methods", () => {
    const clientId = "clientId";

    describe("setClientId", () => {
      it("should throw an error if no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.setClientId(clientId, VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save client id.");
      });

      describe("Memory storage tests", () => {
        it("should set the client id in memory when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          await tokenService.setClientId(clientId, memoryVaultTimeoutAction, memoryVaultTimeout);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
              .nextMock,
          ).toHaveBeenCalledWith(clientId);
        });

        it("should set the client id in memory for the specified user id", async () => {
          // Act
          await tokenService.setClientId(
            clientId,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
              .nextMock,
          ).toHaveBeenCalledWith(clientId);
        });
      });

      describe("Disk storage tests", () => {
        it("should set the client id in disk when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          await tokenService.setClientId(clientId, diskVaultTimeoutAction, diskVaultTimeout);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK).nextMock,
          ).toHaveBeenCalledWith(clientId);
        });

        it("should set the client id in disk for the specified user id", async () => {
          // Act
          await tokenService.setClientId(
            clientId,
            diskVaultTimeoutAction,
            diskVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK).nextMock,
          ).toHaveBeenCalledWith(clientId);
        });
      });
    });

    describe("getClientId", () => {
      it("should return undefined if no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getClientId();
        // Assert
        expect(result).toBeUndefined();
      });

      it("should return null if no client id is found in memory or disk", async () => {
        // Arrange
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        const result = await tokenService.getClientId();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("should get the client id from memory with no user id specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .stateSubject.next([userIdFromAccessToken, clientId]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientId();

          // Assert
          expect(result).toEqual(clientId);
        });

        it("should get the client id from memory for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .stateSubject.next([userIdFromAccessToken, clientId]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Act
          const result = await tokenService.getClientId(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientId);
        });
      });

      describe("Disk storage tests", () => {
        it("should get the client id from disk with no user id specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .stateSubject.next([userIdFromAccessToken, clientId]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientId();
          // Assert
          expect(result).toEqual(clientId);
        });

        it("should get the client id from disk for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .stateSubject.next([userIdFromAccessToken, clientId]);

          // Act
          const result = await tokenService.getClientId(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientId);
        });
      });
    });

    describe("clearClientId", () => {
      it("should throw an error if no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).clearClientId();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear client id.");
      });

      it("should clear the client id from memory and disk for the specified user id", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .stateSubject.next([userIdFromAccessToken, clientId]);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
          .stateSubject.next([userIdFromAccessToken, clientId]);

        // Act
        await (tokenService as any).clearClientId(userIdFromAccessToken);

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK).nextMock,
        ).toHaveBeenCalledWith(null);
      });

      it("should clear the client id from memory and disk for the global active user", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .stateSubject.next([userIdFromAccessToken, clientId]);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
          .stateSubject.next([userIdFromAccessToken, clientId]);

        // Need to have global active id set to the user id
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        await (tokenService as any).clearClientId();

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY).nextMock,
        ).toHaveBeenCalledWith(null);
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK).nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Client Secret methods", () => {
    const clientSecret = "clientSecret";

    describe("setClientSecret", () => {
      it("should throw an error if no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.setClientSecret(clientSecret, VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save client secret.");
      });

      describe("Memory storage tests", () => {
        it("should set the client secret in memory when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          await tokenService.setClientSecret(
            clientSecret,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
              .nextMock,
          ).toHaveBeenCalledWith(clientSecret);
        });

        it("should set the client secret in memory for the specified user id", async () => {
          // Act
          await tokenService.setClientSecret(
            clientSecret,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
              .nextMock,
          ).toHaveBeenCalledWith(clientSecret);
        });
      });

      describe("Disk storage tests", () => {
        it("should set the client secret in disk when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          await tokenService.setClientSecret(
            clientSecret,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
              .nextMock,
          ).toHaveBeenCalledWith(clientSecret);
        });

        it("should set the client secret in disk for the specified user id", async () => {
          // Act
          await tokenService.setClientSecret(
            clientSecret,
            diskVaultTimeoutAction,
            diskVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
              .nextMock,
          ).toHaveBeenCalledWith(clientSecret);
        });
      });
    });

    describe("getClientSecret", () => {
      it("should return undefined if no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getClientSecret();
        // Assert
        expect(result).toBeUndefined();
      });

      it("should return null if no client secret is found in memory or disk", async () => {
        // Arrange
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        const result = await tokenService.getClientSecret();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("should get the client secret from memory with no user id specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .stateSubject.next([userIdFromAccessToken, clientSecret]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientSecret();

          // Assert
          expect(result).toEqual(clientSecret);
        });

        it("should get the client secret from memory for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .stateSubject.next([userIdFromAccessToken, clientSecret]);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          // Act
          const result = await tokenService.getClientSecret(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientSecret);
        });
      });

      describe("Disk storage tests", () => {
        it("should get the client secret from disk with no user id specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .stateSubject.next([userIdFromAccessToken, clientSecret]);

          // Need to have global active id set to the user id
          globalStateProvider
            .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
            .stateSubject.next(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientSecret();
          // Assert
          expect(result).toEqual(clientSecret);
        });

        it("should get the client secret from disk for the specified user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .stateSubject.next([userIdFromAccessToken, undefined]);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .stateSubject.next([userIdFromAccessToken, clientSecret]);

          // Act
          const result = await tokenService.getClientSecret(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientSecret);
        });
      });
    });

    describe("clearClientSecret", () => {
      it("should throw an error if no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).clearClientSecret();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear client secret.");
      });

      it("should clear the client secret from memory and disk for the specified user id", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .stateSubject.next([userIdFromAccessToken, clientSecret]);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
          .stateSubject.next([userIdFromAccessToken, clientSecret]);

        // Act
        await (tokenService as any).clearClientSecret(userIdFromAccessToken);

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(null);
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextMock,
        ).toHaveBeenCalledWith(null);
      });

      it("should clear the client secret from memory and disk for the global active user", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .stateSubject.next([userIdFromAccessToken, clientSecret]);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
          .stateSubject.next([userIdFromAccessToken, clientSecret]);

        // Need to have global active id set to the user id
        globalStateProvider
          .getFake(ACCOUNT_ACTIVE_ACCOUNT_ID)
          .stateSubject.next(userIdFromAccessToken);

        // Act
        await (tokenService as any).clearClientSecret();

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextMock,
        ).toHaveBeenCalledWith(null);
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextMock,
        ).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("setTokens", () => {
    it("should call to set all passed in tokens after deriving user id from the access token", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      // specific vault timeout actions and vault timeouts don't change this test so values don't matter.
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;
      const clientId = "clientId";
      const clientSecret = "clientSecret";

      (tokenService as any)._setAccessToken = jest.fn();
      // any hack allows for mocking private method.
      (tokenService as any).setRefreshToken = jest.fn();
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      // Act
      // Note: passing a valid access token so that a valid user id can be determined from the access token
      await tokenService.setTokens(accessTokenJwt, refreshToken, vaultTimeoutAction, vaultTimeout, [
        clientId,
        clientSecret,
      ]);

      // Assert
      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );

      // any hack allows for testing private methods
      expect((tokenService as any).setRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );

      expect(tokenService.setClientId).toHaveBeenCalledWith(
        clientId,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );
      expect(tokenService.setClientSecret).toHaveBeenCalledWith(
        clientSecret,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );
    });

    it("should not try to set client id and client secret if they are not passed in", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      (tokenService as any)._setAccessToken = jest.fn();
      (tokenService as any).setRefreshToken = jest.fn();
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      // Act
      await tokenService.setTokens(accessTokenJwt, refreshToken, vaultTimeoutAction, vaultTimeout);

      // Assert
      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );

      // any hack allows for testing private methods
      expect((tokenService as any).setRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );

      expect(tokenService.setClientId).not.toHaveBeenCalled();
      expect(tokenService.setClientSecret).not.toHaveBeenCalled();
    });

    it("should throw an error if the access token is invalid", async () => {
      // Arrange
      const accessToken = "invalidToken";
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      // Act
      const result = tokenService.setTokens(
        accessToken,
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
      );

      // Assert
      await expect(result).rejects.toThrow("JWT must have 3 parts");
    });

    it("should throw an error if the access token is missing", async () => {
      // Arrange
      const accessToken: string = null;
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      // Act
      const result = tokenService.setTokens(
        accessToken,
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
      );

      // Assert
      await expect(result).rejects.toThrow("Access token and refresh token are required.");
    });

    it("should throw an error if the refresh token is missing", async () => {
      // Arrange
      const accessToken = "accessToken";
      const refreshToken: string = null;
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      // Act
      const result = tokenService.setTokens(
        accessToken,
        refreshToken,
        vaultTimeoutAction,
        vaultTimeout,
      );

      // Assert
      await expect(result).rejects.toThrow("Access token and refresh token are required.");
    });
  });

  describe("clearTokens", () => {
    it("should call to clear all tokens for the specified user id", async () => {
      // Arrange
      const userId = "userId" as UserId;

      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      // Act

      await tokenService.clearTokens(userId);

      // Assert

      expect(tokenService.clearAccessToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearRefreshToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientId).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientSecret).toHaveBeenCalledWith(userId);
    });

    it("should call to clear all tokens for the active user id", async () => {
      // Arrange
      const userId = "userId" as UserId;

      globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).stateSubject.next(userId);

      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      // Act

      await tokenService.clearTokens();

      // Assert

      expect(tokenService.clearAccessToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearRefreshToken).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientId).toHaveBeenCalledWith(userId);
      expect((tokenService as any).clearClientSecret).toHaveBeenCalledWith(userId);
    });

    it("should not call to clear all tokens if no user id is provided and there is no active user in global state", async () => {
      // Arrange
      tokenService.clearAccessToken = jest.fn();
      (tokenService as any).clearRefreshToken = jest.fn();
      (tokenService as any).clearClientId = jest.fn();
      (tokenService as any).clearClientSecret = jest.fn();

      // Act

      const result = tokenService.clearTokens();

      // Assert
      await expect(result).rejects.toThrow("User id not found. Cannot clear tokens.");
    });
  });

  describe("Two Factor Token methods", () => {
    describe("setTwoFactorToken", () => {
      it("should set the email and two factor token when there hasn't been a previous record (initializing the record)", async () => {
        // Arrange
        const email = "testUser@email.com";
        const twoFactorToken = "twoFactorTokenForTestUser";
        // Act
        await tokenService.setTwoFactorToken(email, twoFactorToken);
        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({ [email]: twoFactorToken });
      });

      it("should set the email and two factor token when there is an initialized value already (updating the existing record)", async () => {
        // Arrange
        const email = "testUser@email.com";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "otherUserTwoFactorToken",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .stateSubject.next(initialTwoFactorTokenRecord);

        // Act
        await tokenService.setTwoFactorToken(email, twoFactorToken);

        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({ [email]: twoFactorToken, ...initialTwoFactorTokenRecord });
      });
    });

    describe("getTwoFactorToken", () => {
      it("should return the two factor token for the given email", async () => {
        // Arrange
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .stateSubject.next(initialTwoFactorTokenRecord);

        // Act
        const result = await tokenService.getTwoFactorToken(email);

        // Assert
        expect(result).toEqual(twoFactorToken);
      });

      it("should not return the two factor token for an email that doesn't exist", async () => {
        // Arrange
        const email = "testUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "twoFactorTokenForOtherUser",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .stateSubject.next(initialTwoFactorTokenRecord);

        // Act
        const result = await tokenService.getTwoFactorToken(email);

        // Assert
        expect(result).toEqual(undefined);
      });

      it("should return null if there is no two factor token record", async () => {
        // Arrange
        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .stateSubject.next(null);

        // Act
        const result = await tokenService.getTwoFactorToken("testUser");

        // Assert
        expect(result).toEqual(null);
      });
    });

    describe("clearTwoFactorToken", () => {
      it("should clear the two factor token for the given email when a record exists", async () => {
        // Arrange
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .stateSubject.next(initialTwoFactorTokenRecord);

        // Act
        await tokenService.clearTwoFactorToken(email);

        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({});
      });

      it("should initialize the record if it doesn't exist and delete the value", async () => {
        // Arrange
        const email = "testUser";

        // Act
        await tokenService.clearTwoFactorToken(email);

        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({});
      });
    });
  });

  // Helpers
  function createTokenService(supportsSecureStorage: boolean) {
    return new TokenService(
      singleUserStateProvider,
      globalStateProvider,
      supportsSecureStorage,
      secureStorageService,
    );
  }
});
