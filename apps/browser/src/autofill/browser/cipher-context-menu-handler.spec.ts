import { mock, MockProxy } from "jest-mock-extended";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { CipherContextMenuHandler } from "./cipher-context-menu-handler";
import { MainContextMenuHandler } from "./main-context-menu-handler";

describe("CipherContextMenuHandler", () => {
  let mainContextMenuHandler: MockProxy<MainContextMenuHandler>;
  let authService: MockProxy<AuthService>;
  let cipherService: MockProxy<CipherService>;

  const mockUserId = "UserId" as UserId;
  const accountService = mockAccountServiceWith(mockUserId);

  let sut: CipherContextMenuHandler;

  beforeEach(() => {
    mainContextMenuHandler = mock();
    mainContextMenuHandler.initRunning = false;
    authService = mock();
    cipherService = mock();

    jest.spyOn(MainContextMenuHandler, "removeAll").mockResolvedValue();

    sut = new CipherContextMenuHandler(
      mainContextMenuHandler,
      authService,
      cipherService,
      accountService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  describe("update", () => {
    it("skips updating if the init process for the mainContextMenuHandler is running", async () => {
      mainContextMenuHandler.initRunning = true;

      await sut.update("https://test.com");

      expect(authService.getAuthStatus).not.toHaveBeenCalled();
    });

    it("locked, updates for no access", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);

      await sut.update("https://test.com");

      expect(mainContextMenuHandler.noAccess).toHaveBeenCalledTimes(1);
    });

    it("logged out, updates for no access", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

      await sut.update("https://test.com");

      expect(mainContextMenuHandler.noAccess).toHaveBeenCalledTimes(1);
    });

    it("has menu disabled, does not load anything", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

      await sut.update("https://test.com");

      expect(mainContextMenuHandler.loadOptions).not.toHaveBeenCalled();

      expect(mainContextMenuHandler.noAccess).not.toHaveBeenCalled();

      expect(mainContextMenuHandler.noLogins).not.toHaveBeenCalled();
    });

    it("has no ciphers, add no ciphers item", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

      mainContextMenuHandler.init.mockResolvedValue(true);

      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);

      await sut.update("https://test.com");

      expect(mainContextMenuHandler.noLogins).toHaveBeenCalledTimes(1);
    });

    it("only adds autofill ciphers including ciphers that require reprompt", async () => {
      authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

      mainContextMenuHandler.init.mockResolvedValue(true);

      const loginCipher = {
        id: "5",
        type: CipherType.Login,
        reprompt: CipherRepromptType.None,
        name: "Test Cipher",
        login: { username: "Test Username" },
      };

      const repromptLoginCipher = {
        id: "6",
        type: CipherType.Login,
        reprompt: CipherRepromptType.Password,
        name: "Test Reprompt Cipher",
        login: { username: "Test Username" },
      };

      const cardCipher = {
        id: "7",
        type: CipherType.Card,
        name: "Test Card Cipher",
        card: { username: "Test Username" },
      };

      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        null, // invalid cipher
        undefined, // invalid cipher
        { type: CipherType.SecureNote }, // invalid cipher
        loginCipher, // valid cipher
        repromptLoginCipher,
        cardCipher, // valid cipher
      ] as any[]);

      await sut.update("https://test.com");

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(1);

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://test.com",
        mockUserId,
        [CipherType.Card, CipherType.Identity],
      );

      expect(mainContextMenuHandler.loadOptions).toHaveBeenCalledTimes(3);

      expect(mainContextMenuHandler.loadOptions).toHaveBeenCalledWith(
        "Test Cipher (Test Username)",
        "5",
        loginCipher,
      );

      expect(mainContextMenuHandler.loadOptions).toHaveBeenCalledWith(
        "Test Reprompt Cipher (Test Username)",
        "6",
        repromptLoginCipher,
      );

      expect(mainContextMenuHandler.loadOptions).toHaveBeenCalledWith(
        "Test Card Cipher",
        "7",
        cardCipher,
      );
    });
  });
});
