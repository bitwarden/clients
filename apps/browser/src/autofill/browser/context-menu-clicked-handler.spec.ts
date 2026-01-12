import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import {
  AUTOFILL_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
} from "@bitwarden/common/autofill/constants";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  CopyToClipboardAction,
  ContextMenuClickedHandler,
  CopyToClipboardOptions,
  GeneratePasswordToClipboardAction,
  AutofillAction,
} from "./context-menu-clicked-handler";

describe("ContextMenuClickedHandler", () => {
  const createData = (
    menuItemId: chrome.contextMenus.OnClickData["menuItemId"],
    parentMenuItemId?: chrome.contextMenus.OnClickData["parentMenuItemId"],
  ): chrome.contextMenus.OnClickData => {
    return {
      menuItemId: menuItemId,
      parentMenuItemId: parentMenuItemId,
      editable: false,
      pageUrl: "something",
    };
  };

  const createCipher = (data?: {
    id?: CipherView["id"];
    username?: CipherView["login"]["username"];
    password?: CipherView["login"]["password"];
    totp?: CipherView["login"]["totp"];
  }): CipherView => {
    const { id, username, password, totp } = data || {};
    const cipherView = new CipherView(
      new Cipher({
        id: id ?? "1",
        type: CipherType.Login,
      } as any),
    );

    cipherView.login.username = username ?? "USERNAME";
    cipherView.login.password = password ?? "PASSWORD";
    cipherView.login.totp = totp ?? "TOTP";
    return cipherView;
  };

  const mockUserId = "UserId" as UserId;

  let copyToClipboard: CopyToClipboardAction;
  let generatePasswordToClipboard: GeneratePasswordToClipboardAction;
  let autofill: AutofillAction;
  let authService: MockProxy<AuthService>;
  let cipherService: MockProxy<CipherService>;
  let accountService: FakeAccountService;
  let totpService: MockProxy<TotpService>;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let userVerificationService: MockProxy<UserVerificationService>;

  let sut: ContextMenuClickedHandler;

  beforeEach(() => {
    copyToClipboard = jest.fn<void, [CopyToClipboardOptions]>();
    generatePasswordToClipboard = jest.fn<Promise<void>, [tab: chrome.tabs.Tab]>();
    autofill = jest.fn<Promise<void>, [tab: chrome.tabs.Tab, cipher: CipherView]>();
    authService = mock();
    cipherService = mock();
    accountService = mockAccountServiceWith(mockUserId as UserId);
    totpService = mock();
    eventCollectionService = mock();

    sut = new ContextMenuClickedHandler(
      copyToClipboard,
      generatePasswordToClipboard,
      autofill,
      authService,
      cipherService,
      totpService,
      eventCollectionService,
      userVerificationService,
      accountService,
    );
  });

  afterEach(() => jest.resetAllMocks());

  describe("run", () => {
    it("can generate password", async () => {
      await sut.run(createData(GENERATE_PASSWORD_ID), { id: 5 } as any);

      expect(generatePasswordToClipboard).toBeCalledTimes(1);

      expect(generatePasswordToClipboard).toBeCalledWith({
        id: 5,
      });
    });

    it("attempts to autofill the correct cipher", async () => {
      const cipher = createCipher();
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);

      await sut.run(createData(`${AUTOFILL_ID}_1`, AUTOFILL_ID), { id: 5 } as any);

      expect(autofill).toBeCalledTimes(1);

      expect(autofill).toBeCalledWith({ id: 5 }, cipher);
    });

    it("copies username to clipboard", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([
        createCipher({ username: "TEST_USERNAME" }),
      ]);

      await sut.run(createData(`${COPY_USERNAME_ID}_1`, COPY_USERNAME_ID), {
        url: "https://test.com",
      } as any);

      expect(copyToClipboard).toBeCalledTimes(1);

      expect(copyToClipboard).toHaveBeenCalledWith({
        text: "TEST_USERNAME",
        tab: { url: "https://test.com" },
      });
    });

    it("copies password to clipboard", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([
        createCipher({ password: "TEST_PASSWORD" }),
      ]);

      await sut.run(createData(`${COPY_PASSWORD_ID}_1`, COPY_PASSWORD_ID), {
        url: "https://test.com",
      } as any);

      expect(copyToClipboard).toBeCalledTimes(1);

      expect(copyToClipboard).toHaveBeenCalledWith({
        text: "TEST_PASSWORD",
        tab: { url: "https://test.com" },
      });
    });

    it("copies totp code to clipboard", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([createCipher({ totp: "TEST_TOTP_SEED" })]);

      jest.spyOn(totpService, "getCode$").mockImplementation((seed: string) => {
        if (seed === "TEST_TOTP_SEED") {
          return of({
            code: "123456",
            period: 30,
          });
        }

        return of({
          code: "654321",
          period: 30,
        });
      });

      await sut.run(createData(`${COPY_VERIFICATION_CODE_ID}_1`, COPY_VERIFICATION_CODE_ID), {
        url: "https://test.com",
      } as any);

      expect(totpService.getCode$).toHaveBeenCalledTimes(1);

      expect(copyToClipboard).toHaveBeenCalledWith({
        text: "123456",
        tab: { url: "https://test.com" },
      });
    });

    it("attempts to find a cipher when noop but unlocked", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        {
          ...createCipher({ username: "NOOP_USERNAME" }),
          reprompt: CipherRepromptType.None,
        } as any,
      ]);

      await sut.run(createData(`${COPY_USERNAME_ID}_${NOOP_COMMAND_SUFFIX}`, COPY_USERNAME_ID), {
        url: "https://test.com",
      } as any);

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(1);

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://test.com",
        mockUserId,
        [],
      );

      expect(copyToClipboard).toHaveBeenCalledTimes(1);

      expect(copyToClipboard).toHaveBeenCalledWith({
        text: "NOOP_USERNAME",
        tab: { url: "https://test.com" },
      });
    });

    it("attempts to find a cipher when noop but unlocked", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([
        {
          ...createCipher({ username: "NOOP_USERNAME" }),
          reprompt: CipherRepromptType.Password,
        } as any,
      ]);

      await sut.run(createData(`${COPY_USERNAME_ID}_${NOOP_COMMAND_SUFFIX}`, COPY_USERNAME_ID), {
        url: "https://test.com",
      } as any);

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledTimes(1);

      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        "https://test.com",
        mockUserId,
        [],
      );
    });
  });
});
