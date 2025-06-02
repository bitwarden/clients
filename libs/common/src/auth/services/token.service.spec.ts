// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutReason } from "@bitwarden/auth/common";

import { FakeSingleUserStateProvider, FakeGlobalStateProvider } from "../../../spec";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutStringType,
} from "../../key-management/vault-timeout";
import { KeyGenerationService } from "../../platform/abstractions/key-generation.service";
import { LogService } from "../../platform/abstractions/log.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { StorageLocation } from "../../platform/enums";
import { StorageOptions } from "../../platform/models/domain/storage-options";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { SetTokensResult } from "../models/domain/set-tokens-result";

import { ACCOUNT_ACTIVE_ACCOUNT_ID } from "./account.service";
import {
  AccessTokenKey,
  DecodedAccessToken,
  TokenService,
  TokenStorageLocation,
} from "./token.service";
import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  SECURITY_STAMP_MEMORY,
} from "./token.state";

describe("TokenService", () => {
  let tokenService: TokenService;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let globalStateProvider: FakeGlobalStateProvider;

  let secureStorageService: MockProxy<AbstractStorageService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;
  let logoutCallback: jest.Mock<Promise<void>, [logoutReason: LogoutReason, userId?: string]>;

  const memoryVaultTimeoutAction = VaultTimeoutAction.LogOut;
  const memoryVaultTimeout: VaultTimeout = 30;

  const diskVaultTimeoutAction = VaultTimeoutAction.Lock;
  const diskVaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;

  const accessTokenJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0IiwibmJmIjoxNzA5MzI0MTExLCJpYXQiOjE3MDkzMjQxMTEsImV4cCI6MTcwOTMyNzcxMSwic2NvcGUiOlsiYXBpIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbIkFwcGxpY2F0aW9uIl0sImNsaWVudF9pZCI6IndlYiIsInN1YiI6ImVjZTcwYTEzLTcyMTYtNDNjNC05OTc3LWIxMDMwMTQ2ZTFlNyIsImF1dGhfdGltZSI6MTcwOTMyNDEwNCwiaWRwIjoiYml0d2FyZGVuIiwicHJlbWl1bSI6ZmFsc2UsImVtYWlsIjoiZXhhbXBsZUBiaXR3YXJkZW4uY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJzc3RhbXAiOiJHWTdKQU82NENLS1RLQkI2WkVBVVlMMldPUVU3QVNUMiIsIm5hbWUiOiJUZXN0IFVzZXIiLCJvcmdvd25lciI6WyI5MmI0OTkwOC1iNTE0LTQ1YTgtYmFkYi1iMTAzMDE0OGZlNTMiLCIzOGVkZTMyMi1iNGI0LTRiZDgtOWUwOS1iMTA3MDExMmRjMTEiLCJiMmQwNzAyOC1hNTgzLTRjM2UtOGQ2MC1iMTA3MDExOThjMjkiLCJiZjkzNGJhMi0wZmQ0LTQ5ZjItYTk1ZS1iMTA3MDExZmM5ZTYiLCJjMGI3Zjc1ZC0wMTVmLTQyYzktYjNhNi1iMTA4MDE3NjA3Y2EiXSwiZGV2aWNlIjoiNGI4NzIzNjctMGRhNi00MWEwLWFkY2ItNzdmMmZlZWZjNGY0IiwianRpIjoiNzUxNjFCRTQxMzFGRjVBMkRFNTExQjhDNEUyRkY4OUEifQ.n7roP8sSbfwcYdvRxZNZds27IK32TW6anorE6BORx_Q";

  const encryptedAccessToken =
    "2.rFNYSTJoljn8h6GOSNVYdQ==|4dIp7ONJzC+Kx1ClA+1aIAb7EqCQ4OjnADCYdCPg7BKkdheG+yM62ZiONFk+S6at84M+RnGWWO04aIjinTdJhlhyUmszePNATxIfX60Y+bFKQhlMuCtZpYdEmQDzXVgT43YRbf/6NnN9WzhefLqeMiocwoIJTEpLptb+Zcm7T3MJpkX4dR9w5LUOxUTNFEGd5PlWaI8FBavOkNsrzY5skRK70pvFABET5IDeRlKhi8NwbzvTzkO3SisLRzih+djiz5nEZf0+ujeGAp6P+o7l0mB0sXVsNJzcuE4S9QtHLnx31N6z3mQm5pOgP4EmEOdRIcQGc1p7dL1vXcXtaTJLtfKXoJjJbYT3wplnY9Pf8+2FVxdbM3bRB2yVsnEzgLcf9UchKThQSdOy8+5TO/prDbUt5mDpO4GmRltom5ncda8yJaD3Hw1DO7fa0Xh+kfeByxb1AwBC+GTPfqmo5uqr0J4dZsf9cGlPMTElwR3GYmD60OcQ6iDX36CZZjqqJqBwKSpepDXV39p9G347e6YAAvJenLDKtdjgfWXCMXbkwETbMgYooFDRd60KYsGIXV16UwzJSvczgTY2d+hYb2Cl0lClequaiwcRxLVtW2xau6qoEPjTqJjJi9I0Cs2WNL4LRH96Ir14a3bEtnTvkO1NjN+bQNon+KksaP2BqTbuiAfZbBP/cL4S1Oew4G00PSLZUGV5S1BI0ooJy6e2NLQJlYqfCeKM6RgpvgfOiXlZddVgkkB6lohLjyVvcSZNuKPjs1wZMZ9C76bKb6o39NFK8G3/YScELFf9gkueWjmhcjrs22+xNDn5rxXeedwIkVW9UJVNLc//eGxLfp70y8fNDcyTPRN1UUpqT8+wSz+9ZHl4DLUK0DE2jIveEDke8vi4MK/XLMC/c50rr1NCEuVy6iA3nwiOzVo/GNfeKTpzMcR/D9A0gxkC9GyZ3riSsMQsGNXhZCZLdsFYp0gLiiJxVilMUfyTWaygsNm87GPY3ep3GEHcq/pCuxrpLQQYT3V1j95WJvFxb8dSLiPHb8STR0GOZhe7SquI5LIRmYCFTo+3VBnItYeuin9i2xCIqWz886xIyllHN2BIPILbA1lCOsCsz1BRRGNqtLvmTeVRO8iujsHWBJicVgSI7/dgSJwcdOv2t4TIVtnN1hJkQnz+HZcJ2FYK/VWlo4UQYYoML52sBd1sSz/n8/8hrO2N4X9frHHNCrcxeoyChTKo2cm4rAxHylLbCZYvGt/KIW9x3AFkPBMr7tAc3yq98J0Crna8ukXc3F3uGb5QXLnBi//3zBDN6RCv7ByaFW5G0I+pglBegzeFBqKH8xwfy76B2e2VLFF8rz/r/wQzlumGFypsRhAoGxrkZyzjec/k+RNR0arf7TTX7ymC1cueTnItRDx89veW6WLlF53NpAGqC8GJSp4T2FGIIk01y29j6Ji7GOlQ8BUbyLWYjMfHf3khRzAfr6UC2QgVvKWQTKET4Y/b1nZCnwxeW8wC80GHtYGuarsU+KlsEw4242cjyIN1GobrWaA2GTOedQDEMWUA64McAw5fAvMEEao5DM7i57tMzJHeKfruyMuXYQkBca094vmATjJ/T+kIrWGIcmxCT/Fp2SW1hcxr6Ciwuog84LVfbVlUl2MAj3eC/xqL/5HP6Q3ObD0ld444GV+HSrQUqfIvEIn9gFmalW6TGugyhfROACCogoXbeIr1AyMUNDnl4EWlPl6u7SQvPX+itKyq4qhaK2J0W6f7ElLVQ5GbC2uwARuhXOi7mqEZ5FP0V675C5NPZOl2ZEd6BhmuyhGkmQEtEvw0DCKnbKM7bKMk90Y599DSnuEna4BNFBVjJ7k+BuNhXUKO+iNcDZT0pCQhOKRVLWsaqVff3BsuQ4zMEOVnccJwwAVipwSRyxZi8bF+Wyun6BVI8pz1CBvRMy+6ifmIq2awEL8NnV65hF2jyZDEVwsnrvCyT7MlM8l5C3MhqH/MgMcKqOsUz+P6Jv5sBi4WvojsaHzqxQ6miBHpHhGDpYH5K53LVs36henB/tOUTcg5ZnO4ZM67jjB7Oz7to+QnJsldp5Bdwvi1XD/4jeh/Llezu5/KwwytSHnZG1z6dZA7B8rKwnI+yN2Qnfi70h68jzGZ1xCOFPz9KMorNKP3XLw8x2g9H6lEBXdV95uc/TNw+WTJbvKRawns/DZhM1u/g13lU6JG19cht3dh/DlKRcJpj1AdOAxPiUubTSkhBmdwRj2BTTHrVlF3/9ladTP4s4f6Zj9TtQvR9CREVe7CboGflxDYC+Jww3PU50XLmxQjkuV5MkDAmBVcyFCFOcHhDRoxet4FX9ec0wjNeDpYtkI8B/qUS1Rp+is1jOxr4/ni|pabwMkF/SdYKdDlow4uKxaObrAP0urmv7N7fA9bedec=";

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

  const accessTokenKeyB64 = { keyB64: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" };

  beforeEach(() => {
    jest.clearAllMocks();

    singleUserStateProvider = new FakeSingleUserStateProvider();
    globalStateProvider = new FakeGlobalStateProvider();

    secureStorageService = mock<AbstractStorageService>();
    keyGenerationService = mock<KeyGenerationService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();
    logoutCallback = jest.fn();

    const supportsSecureStorage = false; // default to false; tests will override as needed
    tokenService = createTokenService(supportsSecureStorage);
  });

  it("instantiates", () => {
    expect(tokenService).not.toBeFalsy();
  });

  describe("Access Token methods", () => {
    const accessTokenKeyPartialSecureStorageKey = `_accessTokenKey`;
    const accessTokenKeySecureStorageKey = `${userIdFromAccessToken}${accessTokenKeyPartialSecureStorageKey}`;

    describe("hasAccessToken$", () => {
      it("returns true when an access token exists in memory", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(accessTokenJwt);

        // Act
        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));

        // Assert
        expect(result).toEqual(true);
      });

      it("returns true when an access token exists in disk", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
          .nextState(undefined);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
          .nextState(accessTokenJwt);

        // Act
        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));

        // Assert
        expect(result).toEqual(true);
      });

      it("returns true when an access token exists in secure storage", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
          .nextState("encryptedAccessToken");

        secureStorageService.get.mockResolvedValue(accessTokenKeyB64);

        // Act
        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));

        // Assert
        expect(result).toEqual(true);
      });

      it("returns false when no access token exists in memory, disk, or secure storage", async () => {
        // Act
        const result = await firstValueFrom(tokenService.hasAccessToken$(userIdFromAccessToken));

        // Assert
        expect(result).toEqual(false);
      });
    });

    describe("setAccessToken", () => {
      it("throws an error when the access token is null", async () => {
        // Act
        const result = tokenService.setAccessToken(
          null,
          VaultTimeoutAction.Lock,
          VaultTimeoutStringType.Never,
        );
        // Assert
        await expect(result).rejects.toThrow("Access token is required.");
      });

      it("throws an error when an invalid token is passed in", async () => {
        // Act
        const result = tokenService.setAccessToken(
          "invalidToken",
          VaultTimeoutAction.Lock,
          VaultTimeoutStringType.Never,
        );
        // Assert
        await expect(result).rejects.toThrow("JWT must have 3 parts");
      });

      it("should throw an error if the vault timeout is missing", async () => {
        // Act
        const result = tokenService.setAccessToken(accessTokenJwt, VaultTimeoutAction.Lock, null);

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout is required.");
      });

      it("should throw an error if the vault timeout action is missing", async () => {
        // Act
        const result = tokenService.setAccessToken(
          accessTokenJwt,
          null,
          VaultTimeoutStringType.Never,
        );

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout Action is required.");
      });

      it("should not throw an error as long as the token is valid", async () => {
        // Act
        const result = tokenService.setAccessToken(
          accessTokenJwt,
          VaultTimeoutAction.Lock,
          VaultTimeoutStringType.Never,
        );
        // Assert
        await expect(result).resolves.not.toThrow();
      });

      describe("Memory storage tests", () => {
        it("set the access token in memory", async () => {
          // Act
          const result = await tokenService.setAccessToken(
            accessTokenJwt,
            memoryVaultTimeoutAction,
            memoryVaultTimeout,
          );
          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("should set the access token in disk", async () => {
          // Act
          const result = await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        const accessTokenKey = new SymmetricCryptoKey(
          new Uint8Array(64) as CsprngArray,
        ) as AccessTokenKey;

        const accessTokenKeyB64 = {
          keyB64:
            "lI7lSoejJ1HsrTkRs2Ipm0x+YcZMKpgm7WQGCNjAWmFAyGOKossXwBJvvtbxcYDZ0G0XNY8Gp7DBXZV2tWAO5w==",
        };
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        it("should set an access token key in secure storage, the encrypted access token in disk, and clear out the token in memory", async () => {
          // Arrange:

          // For testing purposes, let's assume that the access token is already in memory
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(accessTokenJwt);

          keyGenerationService.createKey.mockResolvedValue(accessTokenKey);

          const mockEncryptedAccessToken = "encryptedAccessToken";

          encryptService.encryptString.mockResolvedValue({
            encryptedString: mockEncryptedAccessToken,
          } as any);

          // First call resolves to null to simulate no key in secure storage
          // then resolves to the key to simulate the key being set in secure storage
          // and retrieved successfully to ensure it was set.
          secureStorageService.get.mockResolvedValueOnce(null).mockResolvedValue(accessTokenKeyB64);

          // Act
          const result = await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert

          // assert that the AccessTokenKey was set in secure storage
          expect(secureStorageService.save).toHaveBeenCalledWith(
            accessTokenKeySecureStorageKey,
            accessTokenKey,
            secureStorageOptions,
          );

          // assert that the access token was encrypted and set in disk
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(mockEncryptedAccessToken);

          // assert data was migrated out of memory
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);

          // assert that the decrypted access token was returned
          expect(result).toEqual(accessTokenJwt);
        });

        it("should fallback to disk storage for the access token if the access token cannot be set in secure storage", async () => {
          // This tests the scenario where the access token key silently fails to be set in secure storage

          // Arrange:
          keyGenerationService.createKey.mockResolvedValue(accessTokenKey);

          // First call resolves to null to simulate no key in secure storage
          // and then resolves to no key after it should have been set
          secureStorageService.get.mockResolvedValueOnce(null).mockResolvedValue(null);

          // Act
          const result = await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert

          // assert that we tried to store the AccessTokenKey in secure storage
          expect(secureStorageService.save).toHaveBeenCalledWith(
            accessTokenKeySecureStorageKey,
            accessTokenKey,
            secureStorageOptions,
          );

          // assert that we logged the error
          expect(logService.error).toHaveBeenCalledWith(
            "SetAccessToken: storing encrypted access token in secure storage failed. Falling back to disk storage.",
            new Error("New Access token key unable to be retrieved from secure storage."),
          );

          // assert that the access token was put on disk unencrypted
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);

          // assert that the decrypted access token was returned
          expect(result).toEqual(accessTokenJwt);
        });

        it("should fallback to disk storage for the access token if secure storage errors on trying to get an existing access token key", async () => {
          // This tests the scenario for linux users who don't have secure storage configured.

          // Arrange:
          keyGenerationService.createKey.mockResolvedValue(accessTokenKey);

          // Mock linux secure storage error
          const secureStorageError = "Secure storage error";
          secureStorageService.get.mockRejectedValue(new Error(secureStorageError));

          // Act
          const result = await tokenService.setAccessToken(
            accessTokenJwt,
            diskVaultTimeoutAction,
            diskVaultTimeout,
          );
          // Assert

          // assert that we logged the error
          expect(logService.error).toHaveBeenCalledWith(
            "SetAccessToken: storing encrypted access token in secure storage failed. Falling back to disk storage.",
            new Error(secureStorageError),
          );

          // assert that the access token was put on disk unencrypted
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(accessTokenJwt);

          // assert that the decrypted access token was returned
          expect(result).toEqual(accessTokenJwt);
        });
      });
    });

    describe("getAccessToken", () => {
      it("returns null when no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getAccessToken();
        // Assert
        expect(result).toBeNull();
      });

      it("returns null when no access token is found in memory, disk, or secure storage", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = await tokenService.getAccessToken();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        test.each([
          ["gets the access token from memory when a user id is provided ", userIdFromAccessToken],
          ["gets the access token from memory when no user id is provided", undefined],
        ])("%s", async (_, userId) => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(accessTokenJwt);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(undefined);

          // Need to have global active id set to the user id
          if (!userId) {
            globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);
          }

          // Act
          const result = await tokenService.getAccessToken(userId);

          // Assert
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        test.each([
          ["gets the access token from disk when the user id is specified", userIdFromAccessToken],
          ["gets the access token from disk when no user id is specified", undefined],
        ])("%s", async (_, userId) => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(accessTokenJwt);

          // Need to have global active id set to the user id
          if (!userId) {
            globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);
          }

          // Act
          const result = await tokenService.getAccessToken(userId);
          // Assert
          expect(result).toEqual(accessTokenJwt);
        });
      });

      describe("Disk storage tests (secure storage supported on platform)", () => {
        beforeEach(() => {
          const supportsSecureStorage = true;
          tokenService = createTokenService(supportsSecureStorage);
        });

        test.each([
          [
            "gets the encrypted access token from disk, decrypts it, and returns it when a user id is provided",
            userIdFromAccessToken,
          ],
          [
            "gets the encrypted access token from disk, decrypts it, and returns it when no user id is provided",
            undefined,
          ],
        ])("%s", async (_, userId) => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState("encryptedAccessToken");

          secureStorageService.get.mockResolvedValue(accessTokenKeyB64);
          encryptService.decryptString.mockResolvedValue("decryptedAccessToken");

          // Need to have global active id set to the user id
          if (!userId) {
            globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);
          }

          // Act
          const result = await tokenService.getAccessToken(userId);

          // Assert
          expect(result).toEqual("decryptedAccessToken");
        });

        test.each([
          [
            "falls back and gets the unencrypted access token from disk when there isn't an access token key in secure storage and a user id is provided",
            userIdFromAccessToken,
          ],
          [
            "falls back and gets the unencrypted access token from disk when there isn't an access token key in secure storage and no user id is provided",
            undefined,
          ],
        ])("%s", async (_, userId) => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(accessTokenJwt);

          // Need to have global active id set to the user id
          if (!userId) {
            globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);
          }

          // No access token key set

          // Act
          const result = await tokenService.getAccessToken(userId);

          // Assert
          expect(result).toEqual(accessTokenJwt);
        });

        it("logs the error and logs the user out when the access token key cannot be retrieved from secure storage if the access token is encrypted", async () => {
          // This tests the intermittent windows 10/11 scenario in which the access token key was stored successfully in secure storage and the
          // access token was encrypted with it and stored on disk successfully. However, on retrieval the access token key isn't able to
          // retrieved for whatever reason.

          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);

          // No access token key set

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();

          // assert that we logged the error
          expect(logService.error).toHaveBeenCalledWith(
            "Access token key not found to decrypt encrypted access token. Logging user out.",
          );

          // assert that we logged the user out
          expect(logoutCallback).toHaveBeenCalledWith(
            "accessTokenUnableToBeDecrypted",
            userIdFromAccessToken,
          );
        });

        it("logs the error and logs the user out when secure storage errors on trying to get an access token key", async () => {
          // This tests the linux scenario where users might not have secure storage support configured.

          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);

          // Mock linux secure storage error
          const secureStorageError = "Secure storage error";
          secureStorageService.get.mockRejectedValue(new Error(secureStorageError));

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();

          // assert that we logged the error
          expect(logService.error).toHaveBeenCalledWith(
            "Access token key retrieval failed. Unable to decrypt encrypted access token. Logging user out.",
            new Error(secureStorageError),
          );

          // assert that we logged the user out
          expect(logoutCallback).toHaveBeenCalledWith(
            "accessTokenUnableToBeDecrypted",
            userIdFromAccessToken,
          );
        });
      });
    });

    describe("clearAccessToken", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
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

        test.each([
          [
            "clears the access token from all storage locations when a user id is provided",
            userIdFromAccessToken,
          ],
          [
            "clears the access token from all storage locations when there is a global active user",
            undefined,
          ],
        ])("%s", async (_, userId) => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(accessTokenJwt);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(accessTokenJwt);

          // Need to have global active id set to the user id
          if (!userId) {
            globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);
          }

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
            accessTokenKeySecureStorageKey,
            secureStorageOptions,
          );
        });
      });
    });

    describe("decodeAccessToken", () => {
      it("retrieves the requested user's token when the passed in parameter is a Guid", async () => {
        // Arrange
        tokenService.getAccessToken = jest.fn().mockResolvedValue(accessTokenJwt);

        // Act
        const result = await tokenService.decodeAccessToken(userIdFromAccessToken);

        // Assert
        expect(result).toEqual(accessTokenDecoded);
        expect(tokenService.getAccessToken).toHaveBeenCalledWith(userIdFromAccessToken);
      });

      it("decodes the given token when a string is passed in that is not a Guid", async () => {
        // Arrange
        tokenService.getAccessToken = jest.fn();

        // Act
        const result = await tokenService.decodeAccessToken(accessTokenJwt);

        // Assert
        expect(result).toEqual(accessTokenDecoded);
        expect(tokenService.getAccessToken).not.toHaveBeenCalled();
      });

      it("throws an error when no access token is provided or retrievable from state", async () => {
        // Arrange
        tokenService.getAccessToken = jest.fn().mockResolvedValue(null);

        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.decodeAccessToken();
        // Assert
        await expect(result).rejects.toThrow("Access token not found.");
      });

      it("decodes the access token when a valid one is stored", async () => {
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
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getTokenExpirationDate();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns null when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toBeNull();
        });

        it("returns null when the decoded access token does not have an expiration date", async () => {
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

        it("returns null when the decoded access token has a non numeric expiration date", async () => {
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

        it("returns the expiration date of the access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getTokenExpirationDate();

          // Assert
          expect(result).toEqual(new Date(accessTokenDecoded.exp * 1000));
        });
      });

      describe("tokenSecondsRemaining", () => {
        it("returns 0 when the tokenExpirationDate is null", async () => {
          // Arrange
          tokenService.getTokenExpirationDate = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.tokenSecondsRemaining();

          // Assert
          expect(result).toEqual(0);
        });

        it("returns the number of seconds remaining until the token expires", async () => {
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

        it("returns the number of seconds remaining until the token expires when given an offset", async () => {
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
        it("returns true when the token is within the default refresh threshold (5 min)", async () => {
          // Arrange
          const tokenSecondsRemaining = 60;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh();

          // Assert
          expect(result).toEqual(true);
        });

        it("returns false when the token is outside the default refresh threshold (5 min)", async () => {
          // Arrange
          const tokenSecondsRemaining = 600;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh();

          // Assert
          expect(result).toEqual(false);
        });

        it("returns true when the token is within the specified refresh threshold", async () => {
          // Arrange
          const tokenSecondsRemaining = 60;
          tokenService.tokenSecondsRemaining = jest.fn().mockResolvedValue(tokenSecondsRemaining);

          // Act
          const result = await tokenService.tokenNeedsRefresh(2);

          // Assert
          expect(result).toEqual(true);
        });

        it("returns false when the token is outside the specified refresh threshold", async () => {
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
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getUserId();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getUserId();
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("throws an error when the decoded access token has a non-string user id", async () => {
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

        it("returns the user id from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getUserId();

          // Assert
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getUserIdFromAccessToken", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);
          // Assert
          await expect(result).rejects.toThrow("No user id found");
        });

        it("throws an error when the decoded access token has a non-string user id", async () => {
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

        it("returns the user id from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await (tokenService as any).getUserIdFromAccessToken(accessTokenJwt);

          // Assert
          expect(result).toEqual(userIdFromAccessToken);
        });
      });

      describe("getEmail", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmail();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmail();
          // Assert
          await expect(result).rejects.toThrow("No email found");
        });

        it("throws an error when the decoded access token has a non-string email", async () => {
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

        it("returns the email from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getEmail();

          // Assert
          expect(result).toEqual(accessTokenDecoded.email);
        });
      });

      describe("getEmailVerified", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmailVerified();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getEmailVerified();
          // Assert
          await expect(result).rejects.toThrow("No email verification found");
        });

        it("throws an error when the decoded access token has a non-boolean email_verified", async () => {
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

        it("returns the email_verified from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getEmailVerified();

          // Assert
          expect(result).toEqual(accessTokenDecoded.email_verified);
        });
      });

      describe("getName", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getName();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns null when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          const result = await tokenService.getName();

          // Assert
          expect(result).toBeNull();
        });

        it("returns null when the decoded access token has a non-string name", async () => {
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

        it("returns the name from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getName();

          // Assert
          expect(result).toEqual(accessTokenDecoded.name);
        });
      });

      describe("getIssuer", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIssuer();
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("throws an error when the decoded access token is null", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(null);

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIssuer();
          // Assert
          await expect(result).rejects.toThrow("No issuer found");
        });

        it("throws an error when the decoded access token has a non-string iss", async () => {
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

        it("returns the issuer from the decoded access token when a valid access token is stored", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          const result = await tokenService.getIssuer();

          // Assert
          expect(result).toEqual(accessTokenDecoded.iss);
        });
      });

      describe("getIsExternal", () => {
        it("throws an error when the access token cannot be decoded", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockRejectedValue(new Error("Mock error"));

          // Act
          // note: don't await here because we want to test the error
          const result = tokenService.getIsExternal(null);
          // Assert
          await expect(result).rejects.toThrow("Failed to decode access token: Mock error");
        });

        it("returns false when the amr (Authentication Method Reference) claim does not contain 'external'", async () => {
          // Arrange
          const accessTokenDecodedWithoutExternalAmr = {
            ...accessTokenDecoded,
            amr: ["not-external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithoutExternalAmr);

          // Act
          const result = await tokenService.getIsExternal(null);

          // Assert
          expect(result).toEqual(false);
        });

        it("returns true when the amr (Authentication Method Reference) claim contains 'external'", async () => {
          // Arrange
          const accessTokenDecodedWithExternalAmr = {
            ...accessTokenDecoded,
            amr: ["external"],
          };
          tokenService.decodeAccessToken = jest
            .fn()
            .mockResolvedValue(accessTokenDecodedWithExternalAmr);

          // Act
          const result = await tokenService.getIsExternal(null);

          // Assert
          expect(result).toEqual(true);
        });

        it("passes the requested userId to decode", async () => {
          // Arrange
          tokenService.decodeAccessToken = jest.fn().mockResolvedValue(accessTokenDecoded);

          // Act
          await tokenService.getIsExternal(userIdFromAccessToken);

          // Assert
          expect(tokenService.decodeAccessToken).toHaveBeenCalledWith(userIdFromAccessToken);
        });
      });
    });
  });

  describe("Refresh Token methods", () => {
    const refreshToken = "refreshToken";
    const refreshTokenPartialSecureStorageKey = `_refreshToken`;
    const refreshTokenSecureStorageKey = `${userIdFromAccessToken}${refreshTokenPartialSecureStorageKey}`;

    describe("setRefreshToken", () => {
      it("throws an error when no user id is provided", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).setRefreshToken(
          refreshToken,
          VaultTimeoutAction.Lock,
          null,
          null,
        );
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save refresh token.");
      });

      it("should throw an error if the vault timeout is missing", async () => {
        // Act
        const result = (tokenService as any).setRefreshToken(
          refreshToken,
          VaultTimeoutAction.Lock,
          null,
          userIdFromAccessToken,
        );

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout is required.");
      });

      it("should throw an error if the vault timeout action is missing", async () => {
        // Act
        const result = (tokenService as any).setRefreshToken(
          refreshToken,
          null,
          VaultTimeoutStringType.Never,
          userIdFromAccessToken,
        );

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout Action is required.");
      });

      describe("Memory storage tests", () => {
        it("sets the refresh token in memory when given a user id", async () => {
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
        it("sets the refresh token in disk when given a user id", async () => {
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

        it("sets the refresh token in secure storage, removes data on disk or in memory, and sets a flag to indicate the token has been migrated when given a user id", async () => {
          // Arrange:
          // For testing purposes, let's assume that the token is already in disk and memory
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(refreshToken);

          // We immediately call to get the refresh token from secure storage after setting it to ensure it was set.
          secureStorageService.get.mockResolvedValue(refreshToken);

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

          // assert data was migrated out of disk and memory
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);
        });

        it("tries to set the refresh token in secure storage then falls back to disk storage when the refresh token cannot be read back out of secure storage", async () => {
          // Arrange:
          // We immediately call to get the refresh token from secure storage after setting it to ensure it was set.
          // So, set it to return null to mock a failure to set the refresh token in secure storage.
          // This mocks the windows 10/11 intermittent issue where the token is not set in secure storage successfully.
          secureStorageService.get.mockResolvedValue(null);

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

          // assert that we tried to set the refresh token in secure storage, but it failed, so we reverted to disk storage
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(refreshToken);
        });

        it("tries to set the refresh token in secure storage, throws an error, then falls back to disk storage when secure storage isn't supported", async () => {
          // Arrange:
          // Mock the secure storage service to throw an error when trying to save the refresh token
          // to simulate linux scenarios where a secure storage provider isn't configured.
          secureStorageService.save.mockRejectedValue(new Error("Secure storage not supported"));

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

          // assert that we tried to set the refresh token in secure storage, but it failed, so we reverted to disk storage
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(refreshToken);
        });

        it("returns the unencrypted access token when secure storage retrieval fails but the access token is still pre-migration", async () => {
          // This tests the linux scenario where users might not have secure storage support configured.

          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(accessTokenJwt);

          // Mock linux secure storage error
          const secureStorageError = "Secure storage error";
          secureStorageService.get.mockRejectedValue(new Error(secureStorageError));

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);

          // Assert
          // assert that we returned the unencrypted, pre-migration access token
          expect(result).toBe(accessTokenJwt);

          // assert that we did not log an error or log the user out
          expect(logService.error).not.toHaveBeenCalled();

          expect(logoutCallback).not.toHaveBeenCalled();
        });

        it("does not error and fallback to disk storage when passed a null value for the refresh token", async () => {
          // Arrange
          secureStorageService.get.mockResolvedValue(null);

          // Act
          await (tokenService as any).setRefreshToken(
            null,
            diskVaultTimeoutAction,
            diskVaultTimeout,
            userIdFromAccessToken,
          );

          // Assert
          expect(secureStorageService.save).toHaveBeenCalledWith(
            refreshTokenSecureStorageKey,
            null,
            secureStorageOptions,
          );

          expect(logService.error).not.toHaveBeenCalled();

          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK).nextMock,
          ).toHaveBeenCalledWith(null);

          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY).nextMock,
          ).toHaveBeenCalledWith(null);
        });

        it("logs the error and logs the user out when the access token cannot be decrypted", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);

          secureStorageService.get.mockResolvedValue(accessTokenKeyB64);
          encryptService.decryptString.mockRejectedValue(new Error("Decryption error"));

          // Act
          const result = await tokenService.getAccessToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();

          // assert that we logged the error
          expect(logService.error).toHaveBeenCalledWith(
            "Failed to decrypt access token",
            new Error("Decryption error"),
          );

          // assert that we logged the user out
          expect(logoutCallback).toHaveBeenCalledWith(
            "accessTokenUnableToBeDecrypted",
            userIdFromAccessToken,
          );
        });
      });
    });

    describe("getRefreshToken", () => {
      it("returns null when no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await (tokenService as any).getRefreshToken();
        // Assert
        expect(result).toBeNull();
      });

      it("returns null when no refresh token is found in memory, disk, or secure storage", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = await (tokenService as any).getRefreshToken();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("gets the refresh token from memory when no user id is specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(refreshToken);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();

          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("gets the refresh token from memory when a user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(refreshToken);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(refreshToken);
        });
      });

      describe("Disk storage tests (secure storage not supported on platform)", () => {
        it("gets the refresh token from disk when no user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("gets the refresh token from disk when a user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

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

        it("gets the refresh token from secure storage when no user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          secureStorageService.get.mockResolvedValue(refreshToken);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("gets the refresh token from secure storage when a user id is specified", async () => {
          // Arrange

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          secureStorageService.get.mockResolvedValue(refreshToken);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(refreshToken);
        });

        it("falls back and gets the refresh token from disk when a user id is specified even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);

          // Assert
          expect(result).toEqual(refreshToken);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });

        it("falls back and gets the refresh token from disk when no user id is specified even if the platform supports secure storage", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getRefreshToken();

          // Assert
          expect(result).toEqual(refreshToken);

          // assert that secure storage was not called
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });

        it("returns null when the refresh token is not found in memory, on disk, or in secure storage", async () => {
          // Arrange
          secureStorageService.get.mockResolvedValue(null);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();
        });

        it("returns null and logs when the refresh token is not found in secure storage when it should be", async () => {
          // This scenario mocks the case where we have intermittent windows 10/11 issues w/ secure storage not
          // returning the refresh token when it should be there.
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          secureStorageService.get.mockResolvedValue(null);

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();

          expect(logService.error).toHaveBeenCalledWith(
            "Refresh token not found in secure storage. Access token will fail to refresh upon expiration or manual refresh.",
          );
        });

        it("logs out when retrieving the refresh token out of secure storage errors", async () => {
          // This scenario mocks the case where linux users don't have secure storage configured.
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(undefined);

          const secureStorageSvcMockErrorMsg = "Secure storage retrieval error";

          secureStorageService.get.mockRejectedValue(new Error(secureStorageSvcMockErrorMsg));

          // Act
          const result = await tokenService.getRefreshToken(userIdFromAccessToken);

          // Assert
          expect(result).toBeNull();

          // expect that we logged an error and logged the user out
          expect(logService.error).toHaveBeenCalledWith(
            `Failed to retrieve refresh token from secure storage`,
            new Error(secureStorageSvcMockErrorMsg),
          );

          expect(logoutCallback).toHaveBeenCalledWith(
            "refreshTokenSecureStorageRetrievalFailure",
            userIdFromAccessToken,
          );
        });
      });
    });

    describe("clearRefreshToken", () => {
      it("throws an error when no user id is provided", async () => {
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

        it("clears the refresh token from all storage locations when given a user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_MEMORY)
            .nextState(refreshToken);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, REFRESH_TOKEN_DISK)
            .nextState(refreshToken);

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
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.setClientId(clientId, VaultTimeoutAction.Lock, null);
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save client id.");
      });

      it("should throw an error if the vault timeout is missing", async () => {
        // Arrange

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = tokenService.setClientId(clientId, VaultTimeoutAction.Lock, null);

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout is required.");
      });

      it("should throw an error if the vault timeout action is missing", async () => {
        // Arrange

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = tokenService.setClientId(clientId, null, VaultTimeoutStringType.Never);

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout Action is required.");
      });

      describe("Memory storage tests", () => {
        it("sets the client id in memory when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          await tokenService.setClientId(clientId, memoryVaultTimeoutAction, memoryVaultTimeout);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
              .nextMock,
          ).toHaveBeenCalledWith(clientId);
        });

        it("sets the client id in memory when given a user id", async () => {
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
        it("sets the client id in disk when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          await tokenService.setClientId(clientId, diskVaultTimeoutAction, diskVaultTimeout);

          // Assert
          expect(
            singleUserStateProvider.getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK).nextMock,
          ).toHaveBeenCalledWith(clientId);
        });

        it("sets the client id on disk when given a user id", async () => {
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
      it("returns undefined when no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getClientId();
        // Assert
        expect(result).toBeUndefined();
      });

      it("returns null when no client id is found in memory or disk", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = await tokenService.getClientId();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("gets the client id from memory when no user id is specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .nextState(clientId);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .nextState(undefined);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientId();

          // Assert
          expect(result).toEqual(clientId);
        });

        it("gets the client id from memory when given a user id", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .nextState(clientId);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .nextState(undefined);

          // Act
          const result = await tokenService.getClientId(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientId);
        });
      });

      describe("Disk storage tests", () => {
        it("gets the client id from disk when no user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .nextState(clientId);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientId();
          // Assert
          expect(result).toEqual(clientId);
        });

        it("gets the client id from disk when a user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
            .nextState(clientId);

          // Act
          const result = await tokenService.getClientId(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientId);
        });
      });
    });

    describe("clearClientId", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).clearClientId();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear client id.");
      });

      it("clears the client id from memory and disk when a user id is specified", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState(clientId);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
          .nextState(clientId);

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

      it("clears the client id from memory and disk when there is a global active user", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_MEMORY)
          .nextState(clientId);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_ID_DISK)
          .nextState(clientId);

        // Need to have global active id set to the user id
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

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
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.setClientSecret(
          clientSecret,
          VaultTimeoutAction.Lock,
          VaultTimeoutStringType.Never,
        );
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot save client secret.");
      });

      it("should throw an error if the vault timeout is missing", async () => {
        // Arrange

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = tokenService.setClientSecret(clientSecret, VaultTimeoutAction.Lock, null);

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout is required.");
      });

      it("should throw an error if the vault timeout action is missing", async () => {
        // Arrange

        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = tokenService.setClientSecret(
          clientSecret,
          null,
          VaultTimeoutStringType.Never,
        );

        // Assert
        await expect(result).rejects.toThrow("Vault Timeout Action is required.");
      });

      describe("Memory storage tests", () => {
        it("sets the client secret in memory when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

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

        it("sets the client secret in memory when a user id is specified", async () => {
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
        it("sets the client secret on disk when there is an active user in global state", async () => {
          // Arrange
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

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

        it("sets the client secret on disk when a user id is specified", async () => {
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
      it("returns undefined when no user id is provided and there is no active user in global state", async () => {
        // Act
        const result = await tokenService.getClientSecret();
        // Assert
        expect(result).toBeUndefined();
      });

      it("returns null when no client secret is found in memory or disk", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        const result = await tokenService.getClientSecret();
        // Assert
        expect(result).toBeNull();
      });

      describe("Memory storage tests", () => {
        it("gets the client secret from memory when no user id is specified (uses global active user)", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextState(clientSecret);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextState(undefined);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientSecret();

          // Assert
          expect(result).toEqual(clientSecret);
        });

        it("gets the client secret from memory when a user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextState(clientSecret);

          // set disk to undefined
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextState(undefined);

          // Act
          const result = await tokenService.getClientSecret(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientSecret);
        });
      });

      describe("Disk storage tests", () => {
        it("gets the client secret from disk when no user id specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextState(clientSecret);

          // Need to have global active id set to the user id
          globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

          // Act
          const result = await tokenService.getClientSecret();
          // Assert
          expect(result).toEqual(clientSecret);
        });

        it("gets the client secret from disk when a user id is specified", async () => {
          // Arrange
          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
            .nextState(undefined);

          singleUserStateProvider
            .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
            .nextState(clientSecret);

          // Act
          const result = await tokenService.getClientSecret(userIdFromAccessToken);
          // Assert
          expect(result).toEqual(clientSecret);
        });
      });
    });

    describe("clearClientSecret", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = (tokenService as any).clearClientSecret();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot clear client secret.");
      });

      it("clears the client secret from memory and disk when a user id is specified", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState(clientSecret);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
          .nextState(clientSecret);

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

      it("clears the client secret from memory and disk when there is a global active user", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_MEMORY)
          .nextState(clientSecret);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, API_KEY_CLIENT_SECRET_DISK)
          .nextState(clientSecret);

        // Need to have global active id set to the user id
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

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
    it("calls to set all tokens after deriving user id from the access token when called with valid params", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      // specific vault timeout actions and vault timeouts don't change this test so values don't matter.
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;
      const clientId = "clientId";
      const clientSecret = "clientSecret";

      // any hack allows for mocking private method.
      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn().mockReturnValue(refreshToken);
      tokenService.setClientId = jest.fn().mockReturnValue(clientId);
      tokenService.setClientSecret = jest.fn().mockReturnValue(clientSecret);

      // Act
      // Note: passing a valid access token so that a valid user id can be determined from the access token
      const result = await tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
        [clientId, clientSecret],
      );

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

      expect(result).toStrictEqual(
        new SetTokensResult(accessTokenJwt, refreshToken, [clientId, clientSecret]),
      );
    });

    it("does not try to set the refresh token when it is not passed in", async () => {
      // Arrange
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn();
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      // Act
      const result = await tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        null,
      );

      // Assert
      expect((tokenService as any)._setAccessToken).toHaveBeenCalledWith(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        userIdFromAccessToken,
      );

      // any hack allows for testing private methods
      expect((tokenService as any).setRefreshToken).not.toHaveBeenCalled();
      expect(tokenService.setClientId).not.toHaveBeenCalled();
      expect(tokenService.setClientSecret).not.toHaveBeenCalled();

      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt));
    });

    it("does not try to set client id and client secret when they are not passed in", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      (tokenService as any)._setAccessToken = jest.fn().mockReturnValue(accessTokenJwt);
      (tokenService as any).setRefreshToken = jest.fn().mockReturnValue(refreshToken);
      tokenService.setClientId = jest.fn();
      tokenService.setClientSecret = jest.fn();

      // Act
      const result = await tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

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

      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt, refreshToken));
    });

    it("throws an error when the access token is invalid", async () => {
      // Arrange
      const accessToken = "invalidToken";
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      // Act
      const result = tokenService.setTokens(
        accessToken,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

      // Assert
      await expect(result).rejects.toThrow("JWT must have 3 parts");
    });

    it("throws an error when the access token is missing", async () => {
      // Arrange
      const accessToken: string = null;
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;

      // Act
      const result = tokenService.setTokens(
        accessToken,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

      // Assert
      await expect(result).rejects.toThrow("Access token is required.");
    });

    it("should throw an error if the vault timeout is missing", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout: VaultTimeout = null;

      // Act
      const result = tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

      // Assert
      await expect(result).rejects.toThrow("Vault Timeout is required.");
    });

    it("should throw an error if the vault timeout action is missing", async () => {
      // Arrange
      const refreshToken = "refreshToken";
      const vaultTimeoutAction: VaultTimeoutAction = null;
      const vaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;

      // Act
      const result = tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

      // Assert
      await expect(result).rejects.toThrow("Vault Timeout Action is required.");
    });

    it("does not throw an error or set the refresh token when the refresh token is missing", async () => {
      // Arrange
      const refreshToken: string = null;
      const vaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout = 30;
      (tokenService as any).setRefreshToken = jest.fn();

      // Act
      const result = await tokenService.setTokens(
        accessTokenJwt,
        vaultTimeoutAction,
        vaultTimeout,
        refreshToken,
      );

      // Assert
      expect((tokenService as any).setRefreshToken).not.toHaveBeenCalled();
      expect(result).toStrictEqual(new SetTokensResult(accessTokenJwt));
    });
  });

  describe("clearTokens", () => {
    it("calls to clear all tokens when given a specified user id", async () => {
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

    it("calls to clear all tokens when there is an active user", async () => {
      // Arrange
      const userId = "userId" as UserId;

      globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userId);

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

    it("does not call to clear all tokens when no user id is provided and there is no active user in global state", async () => {
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
      it("sets the email and two factor token when there hasn't been a previous record (initializing the record)", async () => {
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

      it("sets the email and two factor token when there is an initialized value already (updating the existing record)", async () => {
        // Arrange
        const email = "testUser@email.com";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "otherUserTwoFactorToken",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        // Act
        await tokenService.setTwoFactorToken(email, twoFactorToken);

        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({ [email]: twoFactorToken, ...initialTwoFactorTokenRecord });
      });
    });

    describe("getTwoFactorToken", () => {
      it("returns the two factor token when given an email", async () => {
        // Arrange
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        // Act
        const result = await tokenService.getTwoFactorToken(email);

        // Assert
        expect(result).toEqual(twoFactorToken);
      });

      it("does not return the two factor token when given an email that doesn't exist", async () => {
        // Arrange
        const email = "testUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          otherUser: "twoFactorTokenForOtherUser",
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        // Act
        const result = await tokenService.getTwoFactorToken(email);

        // Assert
        expect(result).toEqual(undefined);
      });

      it("returns null when there is no two factor token record", async () => {
        // Arrange
        globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextState(null);

        // Act
        const result = await tokenService.getTwoFactorToken("testUser");

        // Assert
        expect(result).toEqual(null);
      });
    });

    describe("clearTwoFactorToken", () => {
      it("clears the two factor token for the given email when a record exists", async () => {
        // Arrange
        const email = "testUser";
        const twoFactorToken = "twoFactorTokenForTestUser";
        const initialTwoFactorTokenRecord: Record<string, string> = {
          [email]: twoFactorToken,
        };

        globalStateProvider
          .getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL)
          .nextState(initialTwoFactorTokenRecord);

        // Act
        await tokenService.clearTwoFactorToken(email);

        // Assert
        expect(
          globalStateProvider.getFake(EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL).nextMock,
        ).toHaveBeenCalledWith({});
      });

      it("initializes the record and deletes the value when the record doesn't exist", async () => {
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

  describe("Security Stamp methods", () => {
    const mockSecurityStamp = "securityStamp";

    describe("setSecurityStamp", () => {
      it("throws an error deletes the value no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.setSecurityStamp(mockSecurityStamp);
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot set security stamp.");
      });

      it("sets the security stamp in memory when there is an active user in global state", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        // Act
        await tokenService.setSecurityStamp(mockSecurityStamp);

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY).nextMock,
        ).toHaveBeenCalledWith(mockSecurityStamp);
      });

      it("sets the security stamp in memory when a user id is specified", async () => {
        // Act
        await tokenService.setSecurityStamp(mockSecurityStamp, userIdFromAccessToken);

        // Assert
        expect(
          singleUserStateProvider.getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY).nextMock,
        ).toHaveBeenCalledWith(mockSecurityStamp);
      });
    });

    describe("getSecurityStamp", () => {
      it("throws an error when no user id is provided and there is no active user in global state", async () => {
        // Act
        // note: don't await here because we want to test the error
        const result = tokenService.getSecurityStamp();
        // Assert
        await expect(result).rejects.toThrow("User id not found. Cannot get security stamp.");
      });

      it("returns the security stamp from memory when no user id is specified (uses global active user)", async () => {
        // Arrange
        globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID).nextState(userIdFromAccessToken);

        singleUserStateProvider
          .getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY)
          .nextState(mockSecurityStamp);

        // Act
        const result = await tokenService.getSecurityStamp();

        // Assert
        expect(result).toEqual(mockSecurityStamp);
      });

      it("returns the security stamp from memory when a user id is specified", async () => {
        // Arrange
        singleUserStateProvider
          .getFake(userIdFromAccessToken, SECURITY_STAMP_MEMORY)
          .nextState(mockSecurityStamp);

        // Act
        const result = await tokenService.getSecurityStamp(userIdFromAccessToken);
        // Assert
        expect(result).toEqual(mockSecurityStamp);
      });
    });
  });

  describe("determineStorageLocation", () => {
    it("should throw an error if the vault timeout is null", async () => {
      // Arrange
      const vaultTimeoutAction: VaultTimeoutAction = VaultTimeoutAction.Lock;
      const vaultTimeout: VaultTimeout = null;
      // Act
      const result = (tokenService as any).determineStorageLocation(
        vaultTimeoutAction,
        vaultTimeout,
        false,
      );
      // Assert
      await expect(result).rejects.toThrow(
        "TokenService - determineStorageLocation: We expect the vault timeout to always exist at this point.",
      );
    });

    it("should throw an error if the vault timeout action is null", async () => {
      // Arrange
      const vaultTimeoutAction: VaultTimeoutAction = null;
      const vaultTimeout: VaultTimeout = 0;
      // Act
      const result = (tokenService as any).determineStorageLocation(
        vaultTimeoutAction,
        vaultTimeout,
        false,
      );
      // Assert
      await expect(result).rejects.toThrow(
        "TokenService - determineStorageLocation: We expect the vault timeout action to always exist at this point.",
      );
    });

    describe("Secure storage disabled", () => {
      beforeEach(() => {
        const supportsSecureStorage = false;
        tokenService = createTokenService(supportsSecureStorage);
      });

      it.each([
        [VaultTimeoutStringType.OnRestart],
        [VaultTimeoutStringType.OnLocked],
        [VaultTimeoutStringType.OnSleep],
        [VaultTimeoutStringType.OnIdle],
        [0],
        [30],
        [60],
        [90],
        [120],
      ])(
        "returns memory when the vault timeout action is logout and the vault timeout is defined %s (not Never)",
        async (vaultTimeout: VaultTimeout) => {
          // Arrange
          const vaultTimeoutAction = VaultTimeoutAction.LogOut;
          const useSecureStorage = false;
          // Act
          const result = await (tokenService as any).determineStorageLocation(
            vaultTimeoutAction,
            vaultTimeout,
            useSecureStorage,
          );
          // Assert
          expect(result).toEqual(TokenStorageLocation.Memory);
        },
      );

      it("returns disk when the vault timeout action is logout and the vault timeout is never", async () => {
        // Arrange
        const vaultTimeoutAction = VaultTimeoutAction.LogOut;
        const vaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;
        const useSecureStorage = false;
        // Act
        const result = await (tokenService as any).determineStorageLocation(
          vaultTimeoutAction,
          vaultTimeout,
          useSecureStorage,
        );
        // Assert
        expect(result).toEqual(TokenStorageLocation.Disk);
      });

      it("returns disk when the vault timeout action is lock and the vault timeout is never", async () => {
        // Arrange
        const vaultTimeoutAction = VaultTimeoutAction.Lock;
        const vaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;
        const useSecureStorage = false;
        // Act
        const result = await (tokenService as any).determineStorageLocation(
          vaultTimeoutAction,
          vaultTimeout,
          useSecureStorage,
        );
        // Assert
        expect(result).toEqual(TokenStorageLocation.Disk);
      });
    });

    describe("Secure storage enabled", () => {
      beforeEach(() => {
        const supportsSecureStorage = true;
        tokenService = createTokenService(supportsSecureStorage);
      });

      it.each([
        [VaultTimeoutStringType.OnRestart],
        [VaultTimeoutStringType.OnLocked],
        [VaultTimeoutStringType.OnSleep],
        [VaultTimeoutStringType.OnIdle],
        [0],
        [30],
        [60],
        [90],
        [120],
      ])(
        "returns memory when the vault timeout action is logout and the vault timeout is defined %s (not Never)",
        async (vaultTimeout: VaultTimeout) => {
          // Arrange
          const vaultTimeoutAction = VaultTimeoutAction.LogOut;
          const useSecureStorage = true;
          // Act
          const result = await (tokenService as any).determineStorageLocation(
            vaultTimeoutAction,
            vaultTimeout,
            useSecureStorage,
          );
          // Assert
          expect(result).toEqual(TokenStorageLocation.Memory);
        },
      );

      it("returns secure storage when the vault timeout action is logout and the vault timeout is never", async () => {
        // Arrange
        const vaultTimeoutAction = VaultTimeoutAction.LogOut;
        const vaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;
        const useSecureStorage = true;
        // Act
        const result = await (tokenService as any).determineStorageLocation(
          vaultTimeoutAction,
          vaultTimeout,
          useSecureStorage,
        );
        // Assert
        expect(result).toEqual(TokenStorageLocation.SecureStorage);
      });

      it("returns secure storage when the vault timeout action is lock and the vault timeout is never", async () => {
        // Arrange
        const vaultTimeoutAction = VaultTimeoutAction.Lock;
        const vaultTimeout: VaultTimeout = VaultTimeoutStringType.Never;
        const useSecureStorage = true;
        // Act
        const result = await (tokenService as any).determineStorageLocation(
          vaultTimeoutAction,
          vaultTimeout,
          useSecureStorage,
        );
        // Assert
        expect(result).toEqual(TokenStorageLocation.SecureStorage);
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
      keyGenerationService,
      encryptService,
      logService,
      logoutCallback,
    );
  }
});
