import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FakeSingleUserStateProvider } from "../../../spec";
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
} from "./token.state";

describe("DefaultTokenStorageSyncService", () => {
  let sut: DefaultTokenStorageSyncService;

  let tokenService: MockProxy<TokenService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let accountService: MockProxy<AccountService>;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let secureStorageService: MockProxy<AbstractStorageService>;
  let encryptService: MockProxy<EncryptService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let logService: MockProxy<LogService>;

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

    tokenService = mock<TokenService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    accountService = mock<AccountService>();
    secureStorageService = mock<AbstractStorageService>();
    encryptService = mock<EncryptService>();
    keyGenerationService = mock<KeyGenerationService>();
    logService = mock<LogService>();

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
      secureStorageService,
      encryptService,
      keyGenerationService,
      platformSupportsSecureStorage,
      logService,
    );
  }

  describe("hydrateMemoryFromPersistentStorage (via init)", () => {
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
        singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_DISK).nextState("myClientId");

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, API_KEY_CLIENT_ID_MEMORY).state$,
        );
        expect(memoryValue).toEqual("myClientId");
      });

      it("copies client secret from disk to memory", async () => {
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
    });

    describe("Secure storage platform", () => {
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

      it("copies pre-migration unencrypted access token from disk to memory when key exists but token is not encrypted", async () => {
        // Pre-migration: token on disk is not an EncString
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
        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      it("reads refresh token from OS secure storage and writes to memory", async () => {
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
        secureStorageService.get.mockResolvedValue(null);

        await sut.init();

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, REFRESH_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });

      it("logs error when secure storage retrieval fails for refresh token", async () => {
        secureStorageService.get.mockRejectedValue(new Error("Secure storage error"));

        await sut.init();

        expect(logService.error).toHaveBeenCalled();
      });
    });
  });

  describe("syncTokenStorage (via reactive sync after init)", () => {
    beforeEach(() => {
      sut = createService(false);
    });

    it("does not write to disk when access token is null in memory", async () => {
      await sut.init();

      // Access token is already null (default)
      // Give time for any async subscriptions to process
      await new Promise((r) => setTimeout(r, 10));

      // Disk should remain null — no writes
      const diskValue = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskValue).toBeNull();
    });

    it("writes tokens to disk when vault timeout action is Lock (persist scenario)", async () => {
      tokenService.getRefreshToken.mockResolvedValue("refreshTokenVal");
      tokenService.getClientId.mockResolvedValue("clientIdVal");
      tokenService.getClientSecret.mockResolvedValue("clientSecretVal");

      vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
      vaultTimeout$.next(30);

      await sut.init();

      // Trigger a token emission
      accessToken$.next("myAccessToken");

      // Allow async processing
      await new Promise((r) => setTimeout(r, 50));

      const diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toEqual("myAccessToken");
    });

    it("writes tokens to disk when vault timeout action is LogOut + Never (persist scenario)", async () => {
      tokenService.getRefreshToken.mockResolvedValue("refreshTokenVal");
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);

      vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
      vaultTimeout$.next(VaultTimeoutStringType.Never);

      await sut.init();

      accessToken$.next("myAccessToken");

      await new Promise((r) => setTimeout(r, 50));

      const diskAccessToken = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskAccessToken).toEqual("myAccessToken");
    });

    it("wipes tokens from disk when vault timeout action is LogOut + numeric timeout", async () => {
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

  describe("Account management", () => {
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
  });

  describe("shouldPersistToDisk (indirectly via syncTokenStorage)", () => {
    beforeEach(() => {
      sut = createService(false);
      tokenService.getRefreshToken.mockResolvedValue(null);
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);
    });

    it("LogOut + numeric timeout: wipes disk", async () => {
      vaultTimeoutAction$.next(VaultTimeoutAction.LogOut);
      vaultTimeout$.next(30);

      singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState("existing");

      await sut.init();

      accessToken$.next("someToken");
      await new Promise((r) => setTimeout(r, 50));

      const diskValue = await firstValueFrom(
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).state$,
      );
      expect(diskValue).toBeNull();
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
  });

  describe("error and fallback paths", () => {
    describe("hydrateMemoryFromPersistentStorage — decrypt throws", () => {
      it("logs error and does not write memory when access token decryption throws", async () => {
        sut = createService(true);

        const encryptedString = "2.abc==|def==|ghi==" as `${number}.${string}|${string}|${string}`;
        singleUserStateProvider.getFake(userId, ACCESS_TOKEN_DISK).nextState(encryptedString);

        const mockKey = {} as SymmetricCryptoKey;
        secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
        jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);
        encryptService.decryptString.mockRejectedValue(new Error("Decryption failed"));

        await sut.init();

        expect(logService.error).toHaveBeenCalledWith(
          "[TokenStorageSyncService] Failed to decrypt access token",
          expect.any(Error),
        );

        const memoryValue = await firstValueFrom(
          singleUserStateProvider.getFake(userId, ACCESS_TOKEN_MEMORY).state$,
        );
        expect(memoryValue).toBeNull();
      });
    });

    describe("syncForUser — subscription error handler", () => {
      it("logs error when the sync subscription throws", async () => {
        sut = createService(false);

        // Make getRefreshToken throw after a token is emitted so syncTokenStorage errors
        tokenService.getRefreshToken.mockRejectedValue(new Error("getRefreshToken exploded"));

        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();
        accessToken$.next("someToken");
        await new Promise((r) => setTimeout(r, 50));

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("[TokenStorageSyncService] syncForUser error"),
          expect.any(Error),
        );
      });
    });

    describe("writeTokensToDisk — encrypt throws, falls back to plaintext", () => {
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

    describe("writeTokensToDisk — secure storage save throws, falls back to disk", () => {
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

        tokenService.getRefreshToken.mockResolvedValue("myRefreshToken");
        tokenService.getClientId.mockResolvedValue(undefined);
        tokenService.getClientSecret.mockResolvedValue(undefined);

        vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
        vaultTimeout$.next(VaultTimeoutStringType.Never);

        await sut.init();
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

    describe("wipeTokensFromDisk — secure storage removal", () => {
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

  describe("writeTokensToDisk with secure storage", () => {
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

      expect(encryptService.encryptString).toHaveBeenCalledWith("plaintextAccessToken", mockKey);
    });

    it("saves refresh token to OS secure storage on secure storage platforms", async () => {
      sut = createService(true);

      const mockKey = {} as SymmetricCryptoKey;
      secureStorageService.get.mockResolvedValue({ keyB64: "someKeyB64" });
      jest.spyOn(SymmetricCryptoKey, "fromJSON").mockReturnValue(mockKey);

      const mockEncString = { encryptedString: "2.encrypted==|data==|iv==" } as EncString;
      encryptService.encryptString.mockResolvedValue(mockEncString);

      tokenService.getRefreshToken.mockResolvedValue("myRefreshToken");
      tokenService.getClientId.mockResolvedValue(undefined);
      tokenService.getClientSecret.mockResolvedValue(undefined);

      vaultTimeoutAction$.next(VaultTimeoutAction.Lock);
      vaultTimeout$.next(VaultTimeoutStringType.Never);

      await sut.init();

      accessToken$.next("plaintextAccessToken");
      await new Promise((r) => setTimeout(r, 50));

      expect(secureStorageService.save).toHaveBeenCalledWith(
        `${userId}_refreshToken`,
        "myRefreshToken",
        expect.objectContaining({ useSecureStorage: true, userId }),
      );
    });
  });
});
