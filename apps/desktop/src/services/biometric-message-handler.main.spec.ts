import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountInfoWith, FakeAccountService } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricsCommands } from "@bitwarden/key-management";

import { DesktopBiometricsService } from "../key-management/biometrics/desktop.biometrics.service";
import { NativeMessagingMain } from "../main/native-messaging.main";
import { WindowMain } from "../main/window.main";

import { BiometricMessageHandlerMain } from "./biometric-message-handler.main";

jest.mock("@bitwarden/sdk-internal", () => ({
  PureCrypto: {
    make_aes256_cbc_hmac_key: jest.fn(),
  },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

jest.mock("../utils", () => ({
  isDev: jest.fn(() => false),
}));

const makeAes256CbcHmacKey = jest.requireMock("@bitwarden/sdk-internal").PureCrypto
  .make_aes256_cbc_hmac_key as jest.Mock;
const isDevMock = jest.requireMock("../utils").isDev as jest.Mock;

const CLIENT_ID = 1;
const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts = {
  [SomeUser]: mockAccountInfoWith({
    name: "some user",
    email: "some.user@example.com",
  }),
  [AnotherUser]: mockAccountInfoWith({
    name: "some other user",
    email: "some.other.user@example.com",
  }),
};

describe("BiometricMessageHandlerMain", () => {
  let service: BiometricMessageHandlerMain;

  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;
  let biometricsService: MockProxy<BiometricsService & DesktopBiometricsService>;
  let accountService: AccountService;
  let userKeyStateService: MockProxy<UserKeyStateService>;
  let nativeMessagingMain: MockProxy<NativeMessagingMain>;
  let windowMain: MockProxy<WindowMain>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();
    biometricsService = mock<BiometricsService & DesktopBiometricsService>();
    accountService = new FakeAccountService(accounts);
    userKeyStateService = mock<UserKeyStateService>();
    nativeMessagingMain = mock<NativeMessagingMain>();
    windowMain = mock<WindowMain>();

    isDevMock.mockReturnValue(false);
    cryptoFunctionService.randomBytes.mockResolvedValue(new Uint8Array(64) as CsprngArray);
    makeAes256CbcHmacKey.mockReturnValue(Utils.fromBufferToB64(new Uint8Array(64)));
    cryptoFunctionService.rsaEncrypt.mockResolvedValue(
      Utils.fromUtf8ToArray("encrypted") as CsprngArray,
    );

    service = new BiometricMessageHandlerMain(
      cryptoFunctionService,
      encryptService,
      logService,
      biometricsService,
      accountService,
      userKeyStateService,
      nativeMessagingMain,
      windowMain,
    );
  });

  describe("setup encryption", () => {
    it("should ignore when public key missing in message", async () => {
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "setupEncryption",
            messageId: 0,
            userId: "unknownUser" as UserId,
          },
        },
        CLIENT_ID,
      );
      expect(nativeMessagingMain.sendTo).not.toHaveBeenCalled();
    });

    it("should ignore when user id missing in message", async () => {
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "setupEncryption",
            messageId: 0,
            publicKey: Utils.fromUtf8ToB64("publicKey"),
          },
        },
        CLIENT_ID,
      );
      expect(nativeMessagingMain.sendTo).not.toHaveBeenCalled();
    });

    it("should reject when user is not in app", async () => {
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "setupEncryption",
            messageId: 0,
            userId: "unknownUser" as UserId,
            publicKey: Utils.fromUtf8ToB64("publicKey"),
          },
        },
        CLIENT_ID,
      );
      expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(CLIENT_ID, {
        appId: "appId",
        command: "wrongUserId",
      });
    });

    it("should setup secure communication", async () => {
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "setupEncryption",
            messageId: 0,
            userId: SomeUser,
            publicKey: Utils.fromUtf8ToB64("publicKey"),
          },
        },
        CLIENT_ID,
      );
      expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(CLIENT_ID, {
        appId: "appId",
        command: "setupEncryption",
        messageId: -1,
        sharedSecret: Utils.fromUtf8ToB64("encrypted"),
      });
    });

    it("should invalidate encryption if connection is not secured", async () => {
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "biometricUnlock",
            messageId: 0,
            userId: SomeUser,
          },
        },
        CLIENT_ID,
      );
      expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(CLIENT_ID, {
        appId: "appId",
        command: "invalidateEncryption",
      });
    });
  });

  describe("routing", () => {
    it("ignores versioned (DuckDuckGo) messages", async () => {
      await (service as any).dispatch({
        clientId: CLIENT_ID,
        message: JSON.stringify({ version: 1, command: "bw-handshake" }),
      });
      expect(nativeMessagingMain.sendTo).not.toHaveBeenCalled();
    });

    it("ignores malformed messages", async () => {
      await (service as any).dispatch({ clientId: CLIENT_ID, message: "not json" });
      expect(nativeMessagingMain.sendTo).not.toHaveBeenCalled();
    });
  });

  describe("biometric unlock", () => {
    beforeEach(async () => {
      // Establish a secure channel so subsequent encrypted commands are processed.
      await service.handleMessage(
        {
          appId: "appId",
          message: {
            command: "setupEncryption",
            messageId: 0,
            userId: SomeUser,
            publicKey: Utils.fromUtf8ToB64("publicKey"),
          },
        },
        CLIENT_ID,
      );
      nativeMessagingMain.sendTo.mockClear();
      encryptService.encryptString.mockResolvedValue("encrypted-reply" as unknown as EncString);
    });

    it("unlocks with biometrics and replies for a valid message", async () => {
      const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(userKey);
      encryptService.decryptString.mockResolvedValue(
        JSON.stringify({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 3,
          timestamp: Date.now(),
          userId: SomeUser,
        }),
      );

      await service.handleMessage({ appId: "appId", message: {} as EncString }, CLIENT_ID);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(SomeUser);
      expect(nativeMessagingMain.sendTo).toHaveBeenCalledWith(CLIENT_ID, {
        appId: "appId",
        messageId: 3,
        message: "encrypted-reply",
      });
    });

    it("ignores messages that are too old", async () => {
      encryptService.decryptString.mockResolvedValue(
        JSON.stringify({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          messageId: 4,
          timestamp: Date.now() - 60 * 1000,
          userId: SomeUser,
        }),
      );

      await service.handleMessage({ appId: "appId", message: {} as EncString }, CLIENT_ID);

      expect(biometricsService.unlockWithBiometricsForUser).not.toHaveBeenCalled();
      expect(nativeMessagingMain.sendTo).not.toHaveBeenCalled();
    });
  });

  describe("process reload", () => {
    // activeUser, isUnlocked (userKey present), messageUser, isDev, shouldReload
    const testCases: [UserId | null, boolean, UserId, boolean, boolean][] = [
      [SomeUser, true, SomeUser, false, false],
      [SomeUser, false, SomeUser, false, true],
      [SomeUser, true, AnotherUser, false, true],
      [SomeUser, false, AnotherUser, false, true],
      [null, true, AnotherUser, false, false],

      // don't reload in dev mode
      [SomeUser, true, SomeUser, true, false],
      [SomeUser, false, SomeUser, true, false],
      [SomeUser, true, AnotherUser, true, false],
      [SomeUser, false, AnotherUser, true, false],
      [null, true, AnotherUser, true, false],
    ];

    it.each(testCases)(
      "active user %s, unlocked %s, message user %s, isDev %s -> reload %s",
      async (activeUser, isUnlocked, messageUser, isDev, shouldReload) => {
        await accountService.switchAccount(activeUser as UserId);
        userKeyStateService.getUserKey.mockResolvedValue(
          isUnlocked ? (new SymmetricCryptoKey(new Uint8Array(64)) as UserKey) : null,
        );
        isDevMock.mockReturnValue(isDev);
        windowMain.reloadProcess.mockClear();

        await service.processReloadWhenRequired(messageUser);

        if (shouldReload) {
          expect(windowMain.reloadProcess).toHaveBeenCalled();
        } else {
          expect(windowMain.reloadProcess).not.toHaveBeenCalled();
        }
      },
    );
  });
});
