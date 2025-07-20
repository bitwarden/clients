import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BitIconButtonComponent, MenuItemDirective } from "@bitwarden/components";
import { CopyCipherFieldService } from "@bitwarden/vault";

import { CopyCipherFieldDirective } from "./copy-cipher-field.directive";

describe("CopyCipherFieldDirective", () => {
  const copyFieldService = {
    copy: jest.fn().mockResolvedValue(null),
    totpAllowed: jest.fn().mockResolvedValue(true),
  };
  let mockAccountService: AccountService;
  let mockCipherService: CipherService;

  let copyCipherFieldDirective: CopyCipherFieldDirective;

  beforeEach(() => {
    copyFieldService.copy.mockClear();
    copyFieldService.totpAllowed.mockClear();
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = of({ id: "test-account-id" } as Account);
    mockCipherService = mock<CipherService>();

    copyCipherFieldDirective = new CopyCipherFieldDirective(
      copyFieldService as unknown as CopyCipherFieldService,
      mockAccountService,
      mockCipherService,
    );
    copyCipherFieldDirective.cipher = new CipherView();
    copyCipherFieldDirective.cipher.type = CipherType.Login;
  });

  describe("disabled state", () => {
    it("should be enabled when the field is available", async () => {
      copyCipherFieldDirective.action = "username";
      (copyCipherFieldDirective.cipher as CipherView).login.username = "test-username";

      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["disabled"]).toBe(null);
    });

    it("should be disabled when the field is not available", async () => {
      // create empty cipher
      copyCipherFieldDirective.cipher = new CipherView();
      copyCipherFieldDirective.cipher.type = CipherType.Login;

      copyCipherFieldDirective.action = "username";

      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["disabled"]).toBe(true);
    });

    it("updates icon button disabled state", async () => {
      const iconButton = {
        disabled: {
          set: jest.fn(),
        },
      };

      copyCipherFieldDirective = new CopyCipherFieldDirective(
        copyFieldService as unknown as CopyCipherFieldService,
        mockAccountService,
        mockCipherService,
        undefined,
        iconButton as unknown as BitIconButtonComponent,
      );

      copyCipherFieldDirective.action = "password";
      copyCipherFieldDirective.cipher = new CipherView();
      copyCipherFieldDirective.cipher.type = CipherType.Login;

      await copyCipherFieldDirective.ngOnChanges();

      expect(iconButton.disabled.set).toHaveBeenCalledWith(true);
    });

    it("updates menuItemDirective disabled state", async () => {
      const menuItemDirective = {
        disabled: false,
      };

      copyCipherFieldDirective = new CopyCipherFieldDirective(
        copyFieldService as unknown as CopyCipherFieldService,
        mockAccountService,
        mockCipherService,
        menuItemDirective as unknown as MenuItemDirective,
      );

      copyCipherFieldDirective.action = "totp";

      await copyCipherFieldDirective.ngOnChanges();

      expect(menuItemDirective.disabled).toBe(true);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.Login;
      cipher.login.username = "test-username";
      cipher.login.password = "test-password";
      cipher.login.totp = "test-totp";
    });

    it.each([
      ["username", "test-username"],
      ["password", "test-password"],
      ["totp", "test-totp"],
    ])("copies %s field from login to clipboard", async (action, value) => {
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        value,
        action,
        copyCipherFieldDirective.cipher,
      );
    });
  });

  describe("identity", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.Identity;
      cipher.identity.username = "test-username";
      cipher.identity.email = "test-email";
      cipher.identity.phone = "test-phone";
      cipher.identity.address1 = "test-address-1";
    });

    it.each([
      ["username", "test-username"],
      ["email", "test-email"],
      ["phone", "test-phone"],
      ["address", "test-address-1"],
    ])("copies %s field from identity to clipboard", async (action, value) => {
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        value,
        action,
        copyCipherFieldDirective.cipher,
      );
    });
  });

  describe("card", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.Card;
      cipher.card.number = "test-card-number";
      cipher.card.code = "test-card-code";
    });

    it.each([
      ["cardNumber", "test-card-number"],
      ["securityCode", "test-card-code"],
    ])("copies %s field from card to clipboard", async (action, value) => {
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        value,
        action,
        copyCipherFieldDirective.cipher,
      );
    });
  });

  describe("secure note", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.SecureNote;
      cipher.notes = "test-secure-note";
    });

    it("copies secure note field to clipboard", async () => {
      copyCipherFieldDirective.action = "secureNote";

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        "test-secure-note",
        "secureNote",
        copyCipherFieldDirective.cipher,
      );
    });
  });

  describe("ssh key", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.SshKey;
      cipher.sshKey.privateKey = "test-private-key";
      cipher.sshKey.publicKey = "test-public-key";
      cipher.sshKey.keyFingerprint = "test-key-fingerprint";
    });

    it.each([
      ["privateKey", "test-private-key"],
      ["publicKey", "test-public-key"],
      ["keyFingerprint", "test-key-fingerprint"],
    ])("copies %s field from ssh key to clipboard", async (action, value) => {
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        value,
        action,
        copyCipherFieldDirective.cipher,
      );
    });
  });
});
