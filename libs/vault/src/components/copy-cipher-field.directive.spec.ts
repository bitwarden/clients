import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BitIconButtonComponent, MenuItemComponent } from "@bitwarden/components";
import { CipherListView } from "@bitwarden/sdk-internal";

import { CopyCipherFieldService } from "..";

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

      expect(copyCipherFieldDirective["hostDisabled"]).toBe(null);
    });

    it("should be disabled when the field is not available", async () => {
      // create empty cipher
      copyCipherFieldDirective.cipher = new CipherView();
      copyCipherFieldDirective.cipher.type = CipherType.Login;

      copyCipherFieldDirective.action = "username";

      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["hostDisabled"]).toBe(true);
    });

    it("should be disabled when externally disabled even if the field is available", async () => {
      copyCipherFieldDirective.action = "username";
      (copyCipherFieldDirective.cipher as CipherView).login.username = "test-username";
      copyCipherFieldDirective.disabled = true;

      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["hostDisabled"]).toBe(true);
    });

    it("stays disabled for an unavailable field when the external disabled state is toggled off", async () => {
      // Empty cipher, so the field has no value to copy.
      copyCipherFieldDirective.cipher = new CipherView();
      copyCipherFieldDirective.cipher.type = CipherType.Login;
      copyCipherFieldDirective.action = "username";

      // Simulate a list refresh toggling the external disabled state true -> false.
      copyCipherFieldDirective.disabled = true;
      await copyCipherFieldDirective.ngOnChanges();
      copyCipherFieldDirective.disabled = false;
      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["hostDisabled"]).toBe(true);
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
      const menuItemComponent = {
        disabled: false,
      };

      copyCipherFieldDirective = new CopyCipherFieldDirective(
        copyFieldService as unknown as CopyCipherFieldService,
        mockAccountService,
        mockCipherService,
        menuItemComponent as unknown as MenuItemComponent,
      );

      copyCipherFieldDirective.action = "totp";

      await copyCipherFieldDirective.ngOnChanges();

      expect(menuItemComponent.disabled).toBe(true);
    });
  });

  describe("copy guard", () => {
    it("does not copy when the field has no value", async () => {
      copyCipherFieldDirective.cipher = new CipherView();
      copyCipherFieldDirective.cipher.type = CipherType.Login;
      copyCipherFieldDirective.action = "username";

      await copyCipherFieldDirective.ngOnChanges();
      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).not.toHaveBeenCalled();
    });

    it("does not copy when externally disabled", async () => {
      copyCipherFieldDirective.action = "username";
      (copyCipherFieldDirective.cipher as CipherView).login.username = "test-username";
      copyCipherFieldDirective.disabled = true;

      await copyCipherFieldDirective.ngOnChanges();
      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).not.toHaveBeenCalled();
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
      cipher.card.cardholderName = "Jane Doe";
      cipher.card.expMonth = "5";
      cipher.card.expYear = "2030";
    });

    it.each([
      ["cardNumber", "test-card-number"],
      ["securityCode", "test-card-code"],
      ["cardholderName", "Jane Doe"],
      ["cardExpiration", "05 / 2030"],
    ])("copies %s field from card to clipboard", async (action, value) => {
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        value,
        action,
        copyCipherFieldDirective.cipher,
      );
    });

    it.each(["30", "2030"])("normalizes expiration year %s when copying", async (year) => {
      (copyCipherFieldDirective.cipher as CipherView).card.expYear = year;
      copyCipherFieldDirective.action = "cardExpiration";

      await copyCipherFieldDirective.ngOnChanges();
      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).toHaveBeenCalledWith(
        "05 / 2030",
        "cardExpiration",
        copyCipherFieldDirective.cipher,
      );
    });

    it.each([
      ["5", undefined],
      [undefined, "2030"],
      ["", "2030"],
      ["5", ""],
    ])("does not copy an incomplete expiration (%s, %s)", async (month, year) => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.card.expMonth = month;
      cipher.card.expYear = year;
      copyCipherFieldDirective.action = "cardExpiration";

      await copyCipherFieldDirective.ngOnChanges();
      await copyCipherFieldDirective.copy();

      expect(copyFieldService.copy).not.toHaveBeenCalled();
    });

    it.each([
      ["cardholderName", "CardCardholderName", "Jane Doe"],
      ["cardExpiration", "CardExpiration", "05 / 2030"],
    ])("decrypts a card list view before copying %s", async (action, field, value) => {
      const fullCipher = copyCipherFieldDirective.cipher as CipherView;
      const encryptedCipher = {} as Awaited<ReturnType<CipherService["get"]>>;
      const listCipher = {
        id: "test-cipher-id",
        type: { card: { brand: "Visa" } },
        copyableFields: [field],
      } as unknown as CipherListView;
      jest.mocked(mockCipherService.get).mockResolvedValue(encryptedCipher);
      jest.mocked(mockCipherService.decrypt).mockResolvedValue(fullCipher);
      copyCipherFieldDirective.cipher = listCipher;
      copyCipherFieldDirective.action = action as CopyCipherFieldDirective["action"];

      await copyCipherFieldDirective.ngOnChanges();
      await copyCipherFieldDirective.copy();

      expect(mockCipherService.get).toHaveBeenCalledWith("test-cipher-id", "test-account-id");
      expect(mockCipherService.decrypt).toHaveBeenCalledWith(encryptedCipher, "test-account-id");
      expect(copyFieldService.copy).toHaveBeenCalledWith(value, action, listCipher);
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

  describe("bank account", () => {
    beforeEach(() => {
      const cipher = copyCipherFieldDirective.cipher as CipherView;
      cipher.type = CipherType.BankAccount;
      cipher.bankAccount.accountNumber = "test-account-number";
      cipher.bankAccount.routingNumber = "test-routing-number";
      cipher.bankAccount.pin = "test-pin";
      cipher.bankAccount.iban = "test-iban";
    });

    it.each([
      ["accountNumber", "test-account-number"],
      ["routingNumber", "test-routing-number"],
      ["pin", "test-pin"],
      ["iban", "test-iban"],
    ])("copies %s field from bank account to clipboard", async (action, value) => {
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
