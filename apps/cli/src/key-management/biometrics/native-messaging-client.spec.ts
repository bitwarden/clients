import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";

import { NativeMessagingClient } from "./native-messaging-client";

describe("NativeMessagingClient", () => {
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let appIdService: MockProxy<AppIdService>;
  let logService: MockProxy<LogService>;
  let accountService: MockProxy<AccountService>;

  let client: NativeMessagingClient;

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    appIdService = mock<AppIdService>();
    logService = mock<LogService>();
    accountService = mock<AccountService>();

    client = new NativeMessagingClient(
      keyService,
      encryptService,
      cryptoFunctionService,
      appIdService,
      logService,
      accountService,
    );
  });

  describe("isDesktopAppAvailable", () => {
    it("should return false when socket does not exist", async () => {
      // The socket won't exist in test environment
      const result = await client.isDesktopAppAvailable();
      expect(result).toBe(false);
    });
  });

  describe("connect", () => {
    it("should throw when desktop app is not available", async () => {
      await expect(client.connect()).rejects.toThrow();
    });
  });
});

