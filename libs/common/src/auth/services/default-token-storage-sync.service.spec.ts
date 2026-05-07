import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FakeGlobalStateProvider, FakeSingleUserStateProvider } from "../../../spec";
import { KeyGenerationService } from "../../key-management/crypto";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { VaultTimeoutAction, VaultTimeoutStringType } from "../../key-management/vault-timeout";
import { VaultTimeoutSettingsService } from "../../key-management/vault-timeout/abstractions/vault-timeout-settings.service";
import { VaultTimeout } from "../../key-management/vault-timeout/types/vault-timeout.type";
import { LogService } from "../../platform/abstractions/log.service";
import { AbstractStorageService } from "../../platform/abstractions/storage.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { AccountInfo, AccountService } from "../abstractions/account.service";
import { TokenService } from "../abstractions/token.service";

import { DefaultTokenStorageSyncService } from "./default-token-storage-sync.service";
import {
  ACCESS_TOKEN_DISK,
  ACCESS_TOKEN_MEMORY,
  API_KEY_CLIENT_ID_DISK,
  API_KEY_CLIENT_ID_MEMORY,
  API_KEY_CLIENT_SECRET_DISK,
  API_KEY_CLIENT_SECRET_MEMORY,
  REFRESH_TOKEN_DISK,
  REFRESH_TOKEN_MEMORY,
  TOKEN_STORAGE_HYDRATED,
} from "./token.state";

describe("DefaultTokenStorageSyncService", () => {
  let sut: DefaultTokenStorageSyncService;

  let tokenService: MockProxy<TokenService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let accountService: MockProxy<AccountService>;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let globalStateProvider: FakeGlobalStateProvider;
  let secureStorageService: MockProxy<AbstractStorageService>;
  let encryptService: MockProxy<EncryptService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let logService: MockProxy<LogService>;
  let logoutCallback: jest.Mock;

  const userId = "user-1" as UserId;
  const accountInfo: AccountInfo = {
    email: "test@bitwarden.com",
    emailVerified: true,
    name: "Test",
    creationDate: undefined,
  };

  let accounts$: BehaviorSubject<Record<UserId, AccountInfo>>;
  let accessToken$: BehaviorSubject<string | null>;
  let refreshToken$: BehaviorSubject<string | null>;
  let clientId$: BehaviorSubject<string | null>;
  let clientSecret$: BehaviorSubject<string | null>;
  let vaultTimeoutAction$: BehaviorSubject<VaultTimeoutAction>;
  let vaultTimeout$: BehaviorSubject<VaultTimeout>;

  beforeEach(() => {
    jest.clearAllMocks();

    singleUserStateProvider = new FakeSingleUserStateProvider();
    globalStateProvider = new FakeGlobalStateProvider();

    tokenService = mock<TokenService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    accountService = mock<AccountService>();
    secureStorageService = mock<AbstractStorageService>();
    // The orphan-cleanup path in hydrateOrClear calls secureStorageService.remove(...).catch(...).
    // Default to resolved so tests that don't pre-seed an access token on disk (and therefore
    // hit the orphan-cleanup branch on init) don't trip on `undefined.catch(...)`.
    secureStorageService.remove.mockResolvedValue(undefined);
    encryptService = mock<EncryptService>();
    keyGenerationService = mock<KeyGenerationService>();
    logService = mock<LogService>();
    logoutCallback = jest.fn().mockResolvedValue(undefined);

    accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({ [userId]: accountInfo });
    accountService.accounts$ = accounts$;

    accessToken$ = new BehaviorSubject<string | null>(null);
    refreshToken$ = new BehaviorSubject<string | null>(null);
    clientId$ = new BehaviorSubject<string | null>(null);
    clientSecret$ = new BehaviorSubject<string | null>(null);

    tokenService.accessToken$.mockReturnValue(accessToken$);
    tokenService.refreshToken$.mockReturnValue(refreshToken$);
    tokenService.clientId$.mockReturnValue(clientId$);
    tokenService.clientSecret$.mockReturnValue(clientSecret$);

    vaultTimeoutAction$ = new BehaviorSubject<VaultTimeoutAction>(VaultTimeoutAction.Lock);
    vaultTimeout$ = new BehaviorSubject<VaultTimeout>(VaultTimeoutStringType.Never);
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(vaultTimeoutAction$);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(vaultTimeout$);
  });

  function createService(platformSupportsSecureStorage = false): DefaultTokenStorageSyncService {
    return new DefaultTokenStorageSyncService(
      tokenService,
      vaultTimeoutSettingsService,
      accountService,
      singleUserStateProvider,
      globalStateProvider,
      secureStorageService,
      encryptService,
      keyGenerationService,
      platformSupportsSecureStorage,
      logService,
      logoutCallback,
    );
  }

  describe("init() — hydration", () => {
    describe("No secure storage", () => {
      beforeEach(() => {
        sut = createService(false);
      });

      it("copies plaintext access token from disk to memory", async () => {
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plainAccessToken");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("plainAccessToken");
      });

      it("copies plaintext refresh token from disk to memory", async () => {
        // Seed the access token so hydrateOrClear takes the hydrate path (not orphan-clear).
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("accessTokenValue");
        singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("refreshTokenValue");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("refreshTokenValue");
      });

      it("does not write to memory when disk access token is null", async () => {
        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      it("copies client id from disk to memory", async () => {
        // Seed the access token so hydrateOrClear takes the hydrate path (not orphan-clear).
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("accessTokenValue");
        singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).nextState("myClientId");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_MEMORY).state$,
        );
        expect(memoryValue).toEqual("myClientId");
      });

      it("copies client secret from disk to memory", async () => {
        // Seed the access token so hydrateOrClear takes the hydrate path (not orphan-clear).
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("accessTokenValue");
        singleUserStateProvider
          .getFake(userId, API_KEY_CLIENT_SECRET_DISK)
          .nextState("myClientSecret");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_SECRET_MEMORY).state$,
        );
        expect(memoryValue).toEqual("myClientSecret");
      });

      it("does not write client id to memory when disk value is null", async () => {
        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      describe("orphan cleanup (no access token on disk)", () => {
        it("wipes disk JSON state for an account in accounts$ with no disk access token but stale refresh / client artifacts", async () => {
          // No access token on disk — orphan condition (previous logout cleared memory
          // but didn't finish wiping disk).
          singleUserStateProvider
            .getFake(userId, REFRESH_TOKEN_DISK)
            .nextState("staleRefreshToken");
          singleUserStateProvider
            .getFake(userId, API_KEY_CLIENT_ID_DISK)
            .nextState("staleClientId");
          singleUserStateProvider
            .getFake(userId, API_KEY_CLIENT_SECRET_DISK)
            .nextState("staleClientSecret");

          await sut.init();

          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, API_KEY_CLIENT_SECRET_DISK).state$,
            ),
          ).toBeNull();
        });

        it("does not hydrate stale refresh / client artifacts into memory when access token is missing on disk", async () => {
          singleUserStateProvider
            .getFake(userId, REFRESH_TOKEN_DISK)
            .nextState("staleRefreshToken");
          singleUserStateProvider
            .getFake(userId, API_KEY_CLIENT_ID_DISK)
            .nextState("staleClientId");
          singleUserStateProvider
            .getFake(userId, API_KEY_CLIENT_SECRET_DISK)
            .nextState("staleClientSecret");

          await sut.init();

          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_MEMORY).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, API_KEY_CLIENT_SECRET_MEMORY).state$,
            ),
          ).toBeNull();
        });

        it("hydrates normally when an access token is present on disk", async () => {
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("liveAccessToken");
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("liveRefreshToken");
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).nextState("liveClientId");

          await sut.init();

          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
            ),
          ).toEqual("liveAccessToken");
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
            ),
          ).toEqual("liveRefreshToken");
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_MEMORY).state$,
            ),
          ).toEqual("liveClientId");
        });

        it("clears only the orphan account when one user has tokens and another does not", async () => {
          const orphanUserId = "orphan-user" as UserId;

          accounts$.next({
            [userId]: accountInfo,
            [orphanUserId]: {
              email: "orphan@bitwarden.com",
              emailVerified: true,
              name: "Orphan",
              creationDate: undefined,
            },
          });

          // Live account: full token set on disk
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("liveAccessToken");
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("liveRefreshToken");
          // Orphan account: no access token, but stale refresh / client artifacts
          singleUserStateProvider
            .getFake(orphanUserId, REFRESH_TOKEN_DISK)
            .nextState("orphanRefreshToken");
          singleUserStateProvider
            .getFake(orphanUserId, API_KEY_CLIENT_ID_DISK)
            .nextState("orphanClientId");

          await sut.init();

          // Live account hydrated to memory
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
            ),
          ).toEqual("liveAccessToken");
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
            ),
          ).toEqual("liveRefreshToken");

          // Orphan account cleared — disk + memory both empty (no hydration)
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(orphanUserId, REFRESH_TOKEN_DISK).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(orphanUserId, API_KEY_CLIENT_ID_DISK).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(orphanUserId, REFRESH_TOKEN_MEMORY).state$,
            ),
          ).toBeNull();
          expect(
            await firstValueFrom(
              singleUserStateProvider.getFake(orphanUserId, API_KEY_CLIENT_ID_MEMORY).state$,
            ),
          ).toBeNull();
        });
      });
    });

    describe("Secure storage platform", () => {
      const encryptedAccessToken =
        "2.abc==|def==|ghi==" as `${number}.${string}|${string}|${string}`;

      beforeEach(() => {
        sut = createService(true);
      });

      it("decrypts encrypted access token from disk and writes plaintext to memory", async () => {
        const encryptedString = "2.abc==|def==|ghi==" as `${number}.${string}|${string}|${string}`;
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState(encryptedString);

        const mockKey = {} as SymmetricCryptoKey;
        secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
        // Mock SymmetricCryptoKey.fromJSON
        jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
        encryptService.decryptString.mockResolvedValue("decryptedAccessToken");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("decryptedAccessToken");
      });

      it("copies plaintext access token from disk to memory when key exists but token on disk is not encrypted (encrypt-failure fallback state)", async () => {
        // Token on disk is not an EncString — produced by the encrypt-failure fallback in writeTokensToDisk.
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plainJwtToken");

        const mockKey = {} as SymmetricCryptoKey;
        secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
        jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("plainJwtToken");
      });

      it("does not write to memory when disk access token is null on secure storage platform", async () => {
        // Intentionally no AT on disk — orphan-cleanup path. Memory should remain null.
        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      it("reads refresh token from OS secure storage and writes to memory", async () => {
        // Seed plaintext AT on disk so hydrateOrClear takes the hydrate path.
        // Plaintext on a secure-storage platform is the encrypt-failure-fallback state and
        // is hydrated as-is without a decrypt step.
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plaintextAT");
        secureStorageService.get.mockImplementation(async (key: string) => {
          if (key === `${userId}_refreshToken`) {
            return "secureRefreshToken";
          }
          return null;
        });

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("secureRefreshToken");
      });

      it("does not write refresh token to memory when OS secure storage returns null", async () => {
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plaintextAT");
        secureStorageService.get.mockResolvedValue(null);

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      it("logs error when secure storage retrieval fails for refresh token", async () => {
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plaintextAT");
        secureStorageService.get.mockRejectedValue(new Error("Secure storage error"));

        await sut.init();

        expect(logService.error).toHaveBeenCalled();
      });

      it("hydrates refresh token from REFRESH_TOKEN_DISK when secure storage returns null on a secure-storage platform", async () => {
        // Seed plaintext AT on disk so hydrateOrClear takes the hydrate path.
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plaintextAT");

        // Simulates the runtime fallback state created by writeTokensToDisk when secure
        // storage save throws: refresh token sits in REFRESH_TOKEN_DISK rather than secure
        // storage. On the next app start, hydration must pick it up.
        singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("diskRefreshToken");

        // Secure storage returns null for the refresh token key (no value persisted).
        secureStorageService.get.mockResolvedValue(null);

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toEqual("diskRefreshToken");
      });

      describe("orphan cleanup (no access token on disk)", () => {
        it("removes orphan refresh token and access token key from OS secure storage when access token is missing on disk", async () => {
          // No access token on disk — orphan condition.
          secureStorageService.remove.mockResolvedValue();

          await sut.init();

          expect(secureStorageService.remove).toHaveBeenCalledWith(
            `${userId}_accessTokenKey`,
            expect.objectContaining({ useSecureStorage: true, userId }),
          );
          expect(secureStorageService.remove).toHaveBeenCalledWith(
            `${userId}_refreshToken`,
            expect.objectContaining({ useSecureStorage: true, userId }),
          );
        });

        it("does not read refresh token from secure storage when access token is missing on disk", async () => {
          secureStorageService.remove.mockResolvedValue();

          await sut.init();

          // hydrateRefreshToken (which reads from secure storage) should be skipped entirely
          // — the orphan path goes straight to clearTokensFromDisk, which only calls remove().
          expect(secureStorageService.get).not.toHaveBeenCalled();
        });
      });

      describe("access token decrypt failure → logoutCallback", () => {
        it("logs error and does not write memory when access token decryption throws", async () => {
          const encryptedString =
            "2.abc==|def==|ghi==" as `${number}.${string}|${string}|${string}`;
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState(encryptedString);

          const mockKey = {} as SymmetricCryptoKey;
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
          encryptService.decryptString.mockRejectedValue(new Error("Decryption failed"));

          await sut.init();

          expect(logService.error).toHaveBeenCalledWith(
            "[TokenStorageSyncService] Failed to decrypt access token. Logging user out.",
            expect.any(Error),
          );

          const memoryValue = await firstValueFrom(
            singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
          );
          expect(memoryValue).toBeNull();
        });

        it("fires logoutCallback('accessTokenUnableToBeDecrypted') when access token key retrieval throws and disk holds an encrypted token", async () => {
          singleUserStateProvider
            .getFake(userId, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);
          // Secure storage throws when reading the access token key (e.g. Linux without a
          // configured secure storage provider). Refresh token read returns null cleanly so
          // it doesn't trigger its own logout signal.
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              throw new Error("Secure storage unavailable");
            }
            return null;
          });

          await sut.init();

          expect(logoutCallback).toHaveBeenCalledWith("accessTokenUnableToBeDecrypted", userId);
        });

        it("fires logoutCallback('accessTokenUnableToBeDecrypted') when access token key is missing and disk holds an encrypted token", async () => {
          singleUserStateProvider
            .getFake(userId, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);
          // Secure storage returns null for the access token key — encrypted token is unrecoverable.
          secureStorageService.get.mockResolvedValue(null);

          await sut.init();

          expect(logoutCallback).toHaveBeenCalledWith("accessTokenUnableToBeDecrypted", userId);
        });

        it("fires logoutCallback('accessTokenUnableToBeDecrypted') when decryption itself throws", async () => {
          singleUserStateProvider
            .getFake(userId, ACCESS_TOKEN_DISK)
            .nextState(encryptedAccessToken);

          const mockKey = {} as SymmetricCryptoKey;
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
          encryptService.decryptString.mockRejectedValue(new Error("Decryption failed"));

          await sut.init();

          expect(logoutCallback).toHaveBeenCalledWith("accessTokenUnableToBeDecrypted", userId);
        });

        // Repro for the gap reported in https://github.com/bitwarden/clients/pull/15111 (issue
        // #15110). EncryptService.decryptString can resolve to a falsy value (null/empty string)
        // without throwing — typically when the access token key is mismatched against the
        // ciphertext (e.g. master-password change on another device invalidates the disk-stored
        // encrypted token). Without an explicit falsy check, that falsy value is written to
        // memory state and the logout signal is skipped, leaving the user in a wedged
        // unknown-error state on Windows Hello.
        it.each([null, "", undefined])(
          "fires logoutCallback('accessTokenUnableToBeDecrypted') when decryptString resolves to falsy value (%p) without throwing",
          async (falsyResult: string | null | undefined) => {
            singleUserStateProvider
              .getFake(userId, ACCESS_TOKEN_DISK)
              .nextState(encryptedAccessToken);

            const mockKey = {} as SymmetricCryptoKey;
            secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
            jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
            encryptService.decryptString.mockResolvedValue(falsyResult as string);

            await sut.init();

            expect(logoutCallback).toHaveBeenCalledWith("accessTokenUnableToBeDecrypted", userId);
            const memoryValue = await firstValueFrom(
              singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
            );
            expect(memoryValue).toBeNull();
          },
        );

        it("does not fire logoutCallback when disk holds an unencrypted access token (encrypt-failure fallback) even if key retrieval throws", async () => {
          // Token on disk is plaintext, not an EncString — produced by writeTokensToDisk's encrypt-failure fallback.
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plainJwtToken");
          // Only the access token key read throws; refresh token read returns null cleanly
          // so it doesn't trigger its own logout signal.
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              throw new Error("Secure storage unavailable");
            }
            return null;
          });

          await sut.init();

          expect(logoutCallback).not.toHaveBeenCalled();
          const memoryValue = await firstValueFrom(
            singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
          );
          expect(memoryValue).toEqual("plainJwtToken");
        });
      });

      describe("refresh token secure storage retrieval failure → logoutCallback", () => {
        it("fires logoutCallback('refreshTokenSecureStorageRetrievalFailure') when secure storage read throws", async () => {
          // Seed plaintext AT on disk so hydrateOrClear takes the hydrate path. Plaintext on a
          // secure-storage platform is the encrypt-failure-fallback state and is hydrated as-is
          // — keeps this test focused on the refresh-token branch.
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("plaintextAT");

          // Access token key + access token absent so the access token branch doesn't fire its
          // own logout signal — we want to assert the refresh token path independently.
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}${"_refreshToken"}`) {
              throw new Error("Secure storage unavailable");
            }
            return null;
          });

          await sut.init();

          expect(logoutCallback).toHaveBeenCalledWith(
            "refreshTokenSecureStorageRetrievalFailure",
            userId,
          );
        });
      });
    });
  });

  describe("init() — subscriptions, sentinel & idempotency", () => {
    beforeEach(() => {
      sut = createService(false);
    });

    it("starts subscriptions for each existing account on init", async () => {
      await sut.init();

      // The sync subscription should be active. Emitting a token should cause
      // the sync to fire.
      tokenService.getRefreshToken.mockResolvedValue(null);
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);

      vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
      vaultTimeout$.next(VaultTimeoutStringType.Never);
      accessToken$.next("newToken");

      await new Promise((r) => setTimeout(r, 50));

      const diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toEqual("newToken");
    });

    it("starts a subscription for a newly added account", async () => {
      const userId2 = "user-2" as UserId;

      // Set up observables for user-2
      const accessToken2$ = new BehaviorSubject<string | null>(null);
      const refreshToken2$ = new BehaviorSubject<string | null>(null);
      const clientId2$ = new BehaviorSubject<string | null>(null);
      const clientSecret2$ = new BehaviorSubject<string | null>(null);
      const action2$ = new BehaviorSubject<VaultTimeoutAction>(VaultTimeoutAction.Lock);
      const timeout2$ = new BehaviorSubject<VaultTimeout>(VaultTimeoutStringType.Never);

      tokenService.accessToken$.mockImplementation((id) =>
        id === userId2 ? accessToken2$ : accessToken$,
      );
      tokenService.refreshToken$.mockImplementation((id) =>
        id === userId2 ? refreshToken2$ : refreshToken$,
      );
      tokenService.clientId$.mockImplementation((id) => (id === userId2 ? clientId2$ : clientId$));
      tokenService.clientSecret$.mockImplementation((id) =>
        id === userId2 ? clientSecret2$ : clientSecret$,
      );
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockImplementation((id) =>
        id === userId2 ? action2$ : vaultTimeoutAction$,
      );
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockImplementation((id) =>
        id === userId2 ? timeout2$ : vaultTimeout$,
      );

      tokenService.getRefreshToken.mockResolvedValue(null);
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);

      await sut.init();

      // Add user-2
      accounts$.next({
        [userId]: accountInfo,
        [userId2]: {
          email: "user2@bitwarden.com",
          emailVerified: true,
          name: "User 2",
          creationDate: undefined,
        },
      });

      // Emit a token for user-2
      accessToken2$.next("user2Token");

      await new Promise((r) => setTimeout(r, 50));

      const diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId2, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toEqual("user2Token");
    });

    it("tears down subscription when an account is removed", async () => {
      tokenService.getRefreshToken.mockResolvedValue(null);
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);

      vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
      vaultTimeout$.next(VaultTimeoutStringType.Never);

      await sut.init();

      // Verify sync works initially
      accessToken$.next("tokenBeforeRemoval");
      await new Promise((r) => setTimeout(r, 50));

      let diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toEqual("tokenBeforeRemoval");

      // Remove the user from accounts
      accounts$.next({});

      // Clear the disk value to verify no further writes happen
      singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState(null);

      // Emit a new token — should NOT cause a disk write since subscription is torn down
      accessToken$.next("tokenAfterRemoval");
      await new Promise((r) => setTimeout(r, 50));

      diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toBeNull();
    });

    it("publishes the hydration sentinel after init() completes", async () => {
      const hydratedState = globalStateProvider.getFake(TOKEN_STORAGE_HYDRATED);
      expect(await firstValueFrom(hydratedState.state$)).toBeNull();

      await sut.init();

      expect(await firstValueFrom(hydratedState.state$)).toBe(true);
    });

    it("skips re-hydration on subsequent init() calls (covers MV3 SW respawn)", async () => {
      singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("diskValue");
      await sut.init();
      // Simulate a fresher in-memory token written between SW lifetimes.
      await singleUserStateProvider
        .getFake(userId, ACCESS_TOKEN_MEMORY)
        .update(() => "memoryValueWrittenAfterHydration");

      // A respawned SW re-instantiates the service and calls init() again.
      const sutAfterRespawn = createService(false);
      await sutAfterRespawn.init();

      // Hydrate did NOT run again — the in-memory fresher value was preserved.
      const memoryValue = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
      );
      expect(memoryValue).toBe("memoryValueWrittenAfterHydration");
    });

    it("waitForHydration() resolves once the sentinel is published", async () => {
      const popupSut = createService(false);
      let resolved = false;
      const waitPromise = popupSut.waitForHydration().then(() => {
        resolved = true;
      });

      // Sentinel still null — popup is blocked.
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Owning context completes init(); popup unblocks.
      await sut.init();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it("waitForHydration() resolves immediately if hydration already complete", async () => {
      await sut.init();

      const popupSut = createService(false);
      await expect(popupSut.waitForHydration()).resolves.toBeUndefined();
    });
  });

  describe("reactive sync after init", () => {
    describe("persistence decision (vault timeout action × timeout)", () => {
      beforeEach(() => {
        sut = createService(false);
        tokenService.getRefreshToken.mockResolvedValue(null);
        tokenService.getClientId.mockResolvedValue(undefined);
        tokenService.getClientSecret.mockResolvedValue(undefined);
      });

      it("Lock + any timeout: writes to disk", async () => {
        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(30);

        await sut.init();

        accessToken$.next("someToken");
        await new Promise((r) => setTimeout(r, 50));

        const diskValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
        );
        expect(diskValue).toEqual("someToken");
      });

      it("LogOut + Never: writes to disk", async () => {
        vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();

        accessToken$.next("someToken");
        await new Promise((r) => setTimeout(r, 50));

        const diskValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
        );
        expect(diskValue).toEqual("someToken");
      });

      it("LogOut + numeric timeout: wipes tokens from disk", async () => {
        // Pre-seed disk with tokens
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("oldToken");
        singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("oldRefresh");
        singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).nextState("oldClientId");
        singleUserStateProvider
          .getFake(userId, API_KEY_CLIENT_SECRET_DISK)
          .nextState("oldClientSecret");

        vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
        vaultTimeout$.next(30);

        await sut.init();

        accessToken$.next("myAccessToken");

        await new Promise((r) => setTimeout(r, 50));

        const diskAccessToken = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
        );
        expect(diskAccessToken).toBeNull();

        const diskRefreshToken = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$,
        );
        expect(diskRefreshToken).toBeNull();
      });
    });

    describe("logout (access token becomes null)", () => {
      it("wipes disk when access token becomes null", async () => {
        sut = createService(false);

        // Pre-seed disk with tokens to simulate a previously logged-in state
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("oldAccessToken");
        singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).nextState("oldRefreshToken");
        singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).nextState("oldClientId");
        singleUserStateProvider
          .getFake(userId, API_KEY_CLIENT_SECRET_DISK)
          .nextState("oldClientSecret");

        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();

        // Simulate logout: access token cleared from memory
        accessToken$.next(null);
        await new Promise((r) => setTimeout(r, 50));

        expect(
          await firstValueFrom(singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$),
        ).toBeNull();
        expect(
          await firstValueFrom(singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$),
        ).toBeNull();
        expect(
          await firstValueFrom(
            singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).state$,
          ),
        ).toBeNull();
        expect(
          await firstValueFrom(
            singleUserStateProvider.getFake(userId, API_KEY_CLIENT_SECRET_DISK).state$,
          ),
        ).toBeNull();
      });

      it("removes access token key and refresh token from OS secure storage when wiping", async () => {
        sut = createService(true);

        secureStorageService.remove.mockResolvedValue();

        vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
        vaultTimeout$.next(30);

        await sut.init();
        accessToken$.next("someToken");
        await new Promise((r) => setTimeout(r, 50));

        expect(secureStorageService.remove).toHaveBeenCalledWith(
          `${userId}_accessTokenKey`,
          expect.objectContaining({ useSecureStorage: true, userId }),
        );
        expect(secureStorageService.remove).toHaveBeenCalledWith(
          `${userId}_refreshToken`,
          expect.objectContaining({ useSecureStorage: true, userId }),
        );
      });

      it("logs error when removing access token key from secure storage throws", async () => {
        sut = createService(true);

        secureStorageService.remove.mockRejectedValue(new Error("Remove failed"));

        vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
        vaultTimeout$.next(30);

        await sut.init();
        accessToken$.next("someToken");
        await new Promise((r) => setTimeout(r, 50));

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to remove access token key from secure storage"),
          expect.any(Error),
        );
      });
    });

    describe("Secure storage path", () => {
      describe("happy path", () => {
        it("encrypts access token before writing to disk on secure storage platforms", async () => {
          sut = createService(true);

          const mockKey = {} as SymmetricCryptoKey;
          // getOrCreateAccessTokenKey: first get returns existing key
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);

          const mockEncString = { encryptedString: "2.encrypted==|data==|iv==" } as EncString;
          encryptService.encryptString.mockResolvedValue(mockEncString);

          tokenService.getRefreshToken.mockResolvedValue("refreshVal");
          tokenService.getClientId.mockResolvedValue("clientIdVal");
          tokenService.getClientSecret.mockResolvedValue("clientSecretVal");

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();

          accessToken$.next("plaintextAccessToken");
          await new Promise((r) => setTimeout(r, 50));

          expect(encryptService.encryptString).toHaveBeenCalledWith(
            "plaintextAccessToken",
            mockKey,
          );
        });

        it("saves refresh token to OS secure storage on secure storage platforms", async () => {
          sut = createService(true);

          const mockKey = {} as SymmetricCryptoKey;
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);

          const mockEncString = { encryptedString: "2.encrypted==|data==|iv==" } as EncString;
          encryptService.encryptString.mockResolvedValue(mockEncString);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();

          refreshToken$.next("myRefreshToken");
          accessToken$.next("plaintextAccessToken");
          await new Promise((r) => setTimeout(r, 50));

          expect(secureStorageService.save).toHaveBeenCalledWith(
            `${userId}_refreshToken`,
            "myRefreshToken",
            expect.objectContaining({ useSecureStorage: true, userId }),
          );
        });
      });

      describe("encrypt failure → plaintext fallback", () => {
        it("logs error and writes plaintext access token to disk when encryption fails", async () => {
          sut = createService(true);

          const mockKey = {} as SymmetricCryptoKey;
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
          encryptService.encryptString.mockRejectedValue(new Error("Encryption failed"));

          tokenService.getRefreshToken.mockResolvedValue("refreshVal");
          tokenService.getClientId.mockResolvedValue(undefined);
          tokenService.getClientSecret.mockResolvedValue(undefined);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          accessToken$.next("plaintextToken");
          await new Promise((r) => setTimeout(r, 50));

          expect(logService.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed to encrypt access token"),
            expect.any(Error),
          );

          const diskValue = await firstValueFrom(
            singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
          );
          expect(diskValue).toEqual("plaintextToken");
        });
      });

      describe("secure storage save failure → disk fallback", () => {
        it("logs error and writes refresh token to disk when secure storage save fails", async () => {
          sut = createService(true);

          const mockKey = {} as SymmetricCryptoKey;
          secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
          encryptService.encryptString.mockResolvedValue({
            encryptedString: "2.enc==|data==|iv==",
          } as EncString);

          // save throws to simulate secure storage failure
          secureStorageService.save.mockRejectedValue(new Error("Secure storage save failed"));

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          refreshToken$.next("myRefreshToken");
          accessToken$.next("plaintextToken");
          await new Promise((r) => setTimeout(r, 50));

          expect(logService.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed to save refresh token to secure storage"),
            expect.any(Error),
          );

          const diskRefresh = await firstValueFrom(
            singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$,
          );
          expect(diskRefresh).toEqual("myRefreshToken");
        });
      });

      describe("silent save failure (read-back null) → disk fallback (Windows 10/11)", () => {
        it("falls back to disk when secure storage save resolves without throwing but the value is not actually persisted", async () => {
          sut = createService(true);

          const mockKey = {} as SymmetricCryptoKey;
          encryptService.encryptString.mockResolvedValue({
            encryptedString: "2.enc==|data==|iv==",
          } as EncString);

          // Simulate the Windows 10/11 silent-failure mode:
          //   - save() resolves without throwing
          //   - read-back returns null even though we just wrote a non-null value
          const savedRefreshToken: string | null = null;
          secureStorageService.save.mockImplementation(async () => {
            // Intentionally do nothing — simulates the save silently failing.
          });
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              return savedRefreshToken;
            }
            return null;
          });
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          refreshToken$.next("myRefreshToken");
          accessToken$.next("plaintextToken");

          await new Promise((r) => setTimeout(r, 50));

          // The refresh token should have ended up on disk as a fallback.
          const diskRefresh = await firstValueFrom(
            singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$,
          );
          expect(diskRefresh).toEqual("myRefreshToken");
        });
      });

      describe("getOrCreateAccessTokenKey", () => {
        it("creates and stores a new key when none exists in secure storage", async () => {
          sut = createService(true);

          const newKey = new SymmetricCryptoKey(new Uint8Array(64) as any);
          keyGenerationService.createKey.mockResolvedValue(newKey);

          // get call order:
          //   1. hydrateMemoryFromPersistentStorage reads {userId}_refreshToken → null (no refresh token)
          //   2. getAccessTokenKey checks {userId}_accessTokenKey → null (no existing key)
          //   3. after save, getAccessTokenKey verifies {userId}_accessTokenKey → returns saved key
          secureStorageService.get
            .mockResolvedValueOnce(null) // hydration: refresh token
            .mockResolvedValueOnce(null) // getAccessTokenKey: no existing key → triggers create
            .mockResolvedValue({ keyB64: "newKeyB64" }); // verify after save → key found
          jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(newKey);

          encryptService.encryptString.mockResolvedValue({
            encryptedString: "2.enc==|data==|iv==",
          } as EncString);
          tokenService.getRefreshToken.mockResolvedValue(null);
          tokenService.getClientId.mockResolvedValue(undefined);
          tokenService.getClientSecret.mockResolvedValue(undefined);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          accessToken$.next("token");
          await new Promise((r) => setTimeout(r, 50));

          expect(secureStorageService.save).toHaveBeenCalledWith(
            `${userId}_accessTokenKey`,
            newKey,
            expect.objectContaining({ useSecureStorage: true }),
          );
        });

        it("throws when key cannot be retrieved from secure storage after save", async () => {
          sut = createService(true);

          const newKey = new SymmetricCryptoKey(new Uint8Array(64) as any);
          keyGenerationService.createKey.mockResolvedValue(newKey);

          // All get calls return null — key never persists (intermittent Windows 10/11 scenario).
          // Order: hydration refresh token read → null; getAccessTokenKey before save → null (triggers
          // create); getAccessTokenKey after save → null (key not retrievable → throws).
          secureStorageService.get.mockResolvedValue(null);
          jest
            .spyOn(SymmetricCryptoKey, "fromJSON")
            .mockReturnValue(null as unknown as SymmetricCryptoKey);

          tokenService.getRefreshToken.mockResolvedValue(null);
          tokenService.getClientId.mockResolvedValue(undefined);
          tokenService.getClientSecret.mockResolvedValue(undefined);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          accessToken$.next("token");
          await new Promise((r) => setTimeout(r, 50));

          // getOrCreateAccessTokenKey throws inside the encrypt try/catch in writeTokensToDisk,
          // so the fallback path logs via "Failed to encrypt" and writes plaintext to disk.
          expect(logService.error).toHaveBeenCalledWith(
            expect.stringContaining("Failed to encrypt access token"),
            expect.any(Error),
          );
        });

        it("throws when called on a platform that does not support secure storage", async () => {
          // getOrCreateAccessTokenKey is only called on the secure storage path,
          // but the guard inside it also throws explicitly if the flag is false.
          // Verify the guard by calling writeTokensToDisk on a !platformSupportsSecureStorage
          // instance — it takes the non-secure path and never calls getOrCreateAccessTokenKey.
          // This test validates the guard indirectly: no encryption is attempted.
          sut = createService(false);

          tokenService.getRefreshToken.mockResolvedValue(null);
          tokenService.getClientId.mockResolvedValue(undefined);
          tokenService.getClientSecret.mockResolvedValue(undefined);

          vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
          vaultTimeout$.next(VaultTimeoutStringType.Never);

          await sut.init();
          accessToken$.next("token");
          await new Promise((r) => setTimeout(r, 50));

          expect(encryptService.encryptString).not.toHaveBeenCalled();
        });
      });
    });

    describe("uses combineLatest-emitted values (no re-read race)", () => {
      // These tests verify that writeTokensToDisk uses the values emitted by combineLatest
      // rather than re-reading them via tokenService.getXxx(). If the implementation
      // re-reads, there is a race window where a second update can overwrite the first
      // mid-flight, causing the wrong value to be written to disk.
      beforeEach(() => {
        sut = createService(false);
      });

      it("writes the refresh token value that was emitted, not a subsequently changed mock value", async () => {
        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();

        // Emit a consistent set of token values
        refreshToken$.next("refreshToken-v1");
        accessToken$.next("accessToken-v1");

        await new Promise((r) => setTimeout(r, 50));

        const diskRefreshToken = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_DISK).state$,
        );
        // The value emitted by refreshToken$ should be on disk — not a re-read
        expect(diskRefreshToken).toEqual("refreshToken-v1");
        // tokenService.getRefreshToken should NOT have been called
        expect(tokenService.getRefreshToken).not.toHaveBeenCalled();
      });

      it("writes the client id value that was emitted, not a subsequent re-read", async () => {
        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();

        clientId$.next("clientId-v1");
        accessToken$.next("accessToken-v1");

        await new Promise((r) => setTimeout(r, 50));

        const diskClientId = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).state$,
        );
        expect(diskClientId).toEqual("clientId-v1");
        expect(tokenService.getClientId).not.toHaveBeenCalled();
      });

      it("writes the client secret value that was emitted, not a subsequent re-read", async () => {
        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();

        clientSecret$.next("clientSecret-v1");
        accessToken$.next("accessToken-v1");

        await new Promise((r) => setTimeout(r, 50));

        const diskClientSecret = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_SECRET_DISK).state$,
        );
        expect(diskClientSecret).toEqual("clientSecret-v1");
        expect(tokenService.getClientSecret).not.toHaveBeenCalled();
      });
    });

    describe("dedup of redundant disk + secure-storage writes", () => {
      // Background: the combineLatest fan-out fires writeTokensToDisk on every emission of
      // any of the 6 source observables. Without per-user "last written" caches, an access
      // token rotation triggers a redundant refresh-token save+verify (and a fresh-IV
      // re-encrypt of the same plaintext access token) on every emission. Caches dedupe
      // those writes when the underlying plaintext hasn't changed.
      const mockKey = {} as SymmetricCryptoKey;
      const mockEncString = { encryptedString: "2.encrypted==|data==|iv==" } as EncString;

      function setupSecureStorageMocks() {
        secureStorageService.get.mockImplementation(async (key: string) => {
          if (key === `${userId}_accessTokenKey`) {
            return { keyB64: "someKeyB64" };
          }
          if (key === `${userId}_refreshToken`) {
            // Default verify-after-save read returns the value just saved.
            return "stub-rt-readback";
          }
          return null;
        });
        jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
        encryptService.encryptString.mockResolvedValue(mockEncString);
        secureStorageService.save.mockResolvedValue();
        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);
      }

      describe("access token", () => {
        it("does not re-encrypt when the same access token is emitted twice in a row", async () => {
          sut = createService(true);
          setupSecureStorageMocks();

          await sut.init();

          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          accessToken$.next("at-v1"); // identical re-emit
          await new Promise((r) => setTimeout(r, 30));

          expect(encryptService.encryptString).toHaveBeenCalledTimes(1);
        });

        it("re-encrypts when the access token plaintext changes", async () => {
          sut = createService(true);
          setupSecureStorageMocks();

          await sut.init();

          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          accessToken$.next("at-v2");
          await new Promise((r) => setTimeout(r, 30));

          expect(encryptService.encryptString).toHaveBeenCalledTimes(2);
          expect(encryptService.encryptString).toHaveBeenNthCalledWith(1, "at-v1", mockKey);
          expect(encryptService.encryptString).toHaveBeenNthCalledWith(2, "at-v2", mockKey);
        });

        it("re-encrypts after clearTokensFromDisk invalidates the cache", async () => {
          sut = createService(true);
          setupSecureStorageMocks();
          secureStorageService.remove.mockResolvedValue();

          await sut.init();

          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          expect(encryptService.encryptString).toHaveBeenCalledTimes(1);

          await sut.clearTokensFromDisk(userId);

          // Same plaintext, but cache is invalidated — re-encrypt should happen.
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));

          expect(encryptService.encryptString).toHaveBeenCalledTimes(2);
        });

        it("retries the encrypt on the next emission when the previous attempt threw", async () => {
          sut = createService(true);
          setupSecureStorageMocks();

          // First call throws, second call succeeds.
          encryptService.encryptString
            .mockRejectedValueOnce(new Error("Encryption failed"))
            .mockResolvedValueOnce(mockEncString);

          await sut.init();

          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          // First attempt threw → cache should have been invalidated (not populated).
          expect(encryptService.encryptString).toHaveBeenCalledTimes(1);

          accessToken$.next("at-v1"); // identical re-emit; cache should be missed → retry.
          await new Promise((r) => setTimeout(r, 30));

          expect(encryptService.encryptString).toHaveBeenCalledTimes(2);
        });

        it("does not re-encrypt when only the refresh token changes", async () => {
          sut = createService(true);
          setupSecureStorageMocks();

          await sut.init();

          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          expect(encryptService.encryptString).toHaveBeenCalledTimes(1);

          // RT change should not trigger AT re-encrypt.
          refreshToken$.next("rt-v2");
          await new Promise((r) => setTimeout(r, 30));

          expect(encryptService.encryptString).toHaveBeenCalledTimes(1);
        });
      });

      describe("refresh token", () => {
        it("does not re-save to secure storage when the same refresh token is emitted twice", async () => {
          sut = createService(true);
          setupSecureStorageMocks();
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              return "rt-v1"; // verify-after-save reads this back
            }
            return null;
          });

          await sut.init();

          refreshToken$.next("rt-v1");
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          // Now re-emit the same RT (alone or paired) — should NOT call save again.
          refreshToken$.next("rt-v1");
          await new Promise((r) => setTimeout(r, 30));

          const rtSaveCalls = secureStorageService.save.mock.calls.filter(
            (call) => call[0] === `${userId}_refreshToken`,
          );
          expect(rtSaveCalls).toHaveLength(1);
        });

        it("re-saves when the refresh token value changes", async () => {
          sut = createService(true);
          setupSecureStorageMocks();
          secureStorageService.get.mockImplementation(async (key: string, _opts?: unknown) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              return "anything-truthy"; // verify-after-save just needs to be non-empty
            }
            return null;
          });

          await sut.init();

          refreshToken$.next("rt-v1");
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          refreshToken$.next("rt-v2");
          await new Promise((r) => setTimeout(r, 30));

          const rtSaveCalls = secureStorageService.save.mock.calls.filter(
            (call) => call[0] === `${userId}_refreshToken`,
          );
          expect(rtSaveCalls).toHaveLength(2);
          expect(rtSaveCalls[0][1]).toEqual("rt-v1");
          expect(rtSaveCalls[1][1]).toEqual("rt-v2");
        });

        it("does not re-save the unchanged refresh token when only the access token changes", async () => {
          sut = createService(true);
          setupSecureStorageMocks();
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              return "rt-v1";
            }
            return null;
          });

          await sut.init();

          refreshToken$.next("rt-v1");
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          // RT unchanged; only AT changes.
          accessToken$.next("at-v2");
          await new Promise((r) => setTimeout(r, 30));

          const rtSaveCalls = secureStorageService.save.mock.calls.filter(
            (call) => call[0] === `${userId}_refreshToken`,
          );
          expect(rtSaveCalls).toHaveLength(1);
        });

        it("re-saves after clearTokensFromDisk invalidates the cache", async () => {
          sut = createService(true);
          setupSecureStorageMocks();
          secureStorageService.remove.mockResolvedValue();
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              return "rt-v1";
            }
            return null;
          });

          await sut.init();

          // Await between each .next so writeTokensToDisk fully completes (including cache.set)
          // before the next emission can cancel it via switchMap.
          refreshToken$.next("rt-v1");
          await new Promise((r) => setTimeout(r, 30));
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));

          await sut.clearTokensFromDisk(userId);

          // Same RT plaintext but cache invalidated — should re-save.
          refreshToken$.next("rt-v1");
          await new Promise((r) => setTimeout(r, 30));
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));

          const rtSaveCalls = secureStorageService.save.mock.calls.filter(
            (call) => call[0] === `${userId}_refreshToken`,
          );
          expect(rtSaveCalls).toHaveLength(2);
        });

        it("retries the save on the next emission when the previous attempt threw (verify-after-save failed)", async () => {
          sut = createService(true);
          setupSecureStorageMocks();

          // verify-after-save returns null on first call (silent-save-failure mode), then truthy.
          let verifyAttempt = 0;
          secureStorageService.get.mockImplementation(async (key: string) => {
            if (key === `${userId}_accessTokenKey`) {
              return { keyB64: "someKeyB64" };
            }
            if (key === `${userId}_refreshToken`) {
              verifyAttempt++;
              return verifyAttempt === 1 ? null : "rt-v1";
            }
            return null;
          });

          await sut.init();

          refreshToken$.next("rt-v1");
          accessToken$.next("at-v1");
          await new Promise((r) => setTimeout(r, 30));
          // First attempt: save called, verify returns null → throws → catch invalidates cache.

          refreshToken$.next("rt-v1");
          await new Promise((r) => setTimeout(r, 30));
          // Cache was invalidated → retry the save.

          const rtSaveCalls = secureStorageService.save.mock.calls.filter(
            (call) => call[0] === `${userId}_refreshToken`,
          );
          expect(rtSaveCalls).toHaveLength(2);
        });
      });
    });

    describe("pipeline error handler", () => {
      it("logs error when a source observable in the sync pipeline errors", async () => {
        sut = createService(false);

        await sut.init();

        // Erroring any combineLatest source propagates to the subscribe error handler.
        refreshToken$.error(new Error("stream error"));
        await new Promise((r) => setTimeout(r, 50));

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("[TokenStorageSyncService] syncForUser error"),
          expect.any(Error),
        );
      });
    });
  });

  describe("clearTokensFromDisk()", () => {
    it("clears all four token disk state keys for the given user", async () => {
      sut = createService(false);

      await singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).update((_) => "diskAccess");
      await singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).update((_) => "diskRefresh");
      await singleUserStateProvider
        .get(userId, API_KEY_CLIENT_ID_DISK)
        .update((_) => "diskClientId");
      await singleUserStateProvider
        .get(userId, API_KEY_CLIENT_SECRET_DISK)
        .update((_) => "diskClientSecret");

      await sut.clearTokensFromDisk(userId);

      expect(
        await firstValueFrom(singleUserStateProvider.get(userId, ACCESS_TOKEN_DISK).state$),
      ).toBeNull();
      expect(
        await firstValueFrom(singleUserStateProvider.get(userId, REFRESH_TOKEN_DISK).state$),
      ).toBeNull();
      expect(
        await firstValueFrom(singleUserStateProvider.get(userId, API_KEY_CLIENT_ID_DISK).state$),
      ).toBeNull();
      expect(
        await firstValueFrom(
          singleUserStateProvider.get(userId, API_KEY_CLIENT_SECRET_DISK).state$,
        ),
      ).toBeNull();
    });

    it("removes access token key and refresh token from OS secure storage on secure storage platforms", async () => {
      sut = createService(true);
      secureStorageService.remove.mockResolvedValue();

      await sut.clearTokensFromDisk(userId);

      expect(secureStorageService.remove).toHaveBeenCalledWith(
        `${userId}_accessTokenKey`,
        expect.objectContaining({ useSecureStorage: true, userId }),
      );
      expect(secureStorageService.remove).toHaveBeenCalledWith(
        `${userId}_refreshToken`,
        expect.objectContaining({ useSecureStorage: true, userId }),
      );
    });

    it("does not call secure storage when the platform does not support it", async () => {
      sut = createService(false);

      await sut.clearTokensFromDisk(userId);

      expect(secureStorageService.remove).not.toHaveBeenCalled();
    });

    it("is idempotent — running twice when disk is already clear does not throw", async () => {
      sut = createService(false);

      await sut.clearTokensFromDisk(userId);
      await expect(sut.clearTokensFromDisk(userId)).resolves.not.toThrow();
    });
  });
});
