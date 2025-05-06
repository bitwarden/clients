import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BitIconButtonComponent, MenuItemDirective } from "@bitwarden/components";
import { CopyCipherFieldService } from "@bitwarden/vault";

import { CopyCipherFieldDirective } from "./copy-cipher-field.directive";

describe("CopyCipherFieldDirective", () => {
  const copyFieldService = {
    copy: jest.fn().mockResolvedValue(null),
    totpAllowed: jest.fn().mockResolvedValue(true),
  };

  let copyCipherFieldDirective: CopyCipherFieldDirective;

  beforeEach(() => {
    copyFieldService.copy.mockClear();
    copyFieldService.totpAllowed.mockClear();

    copyCipherFieldDirective = new CopyCipherFieldDirective(
      copyFieldService as unknown as CopyCipherFieldService,
    );
    copyCipherFieldDirective.cipher = new CipherView();
  });

  describe("disabled state", () => {
    it("should be enabled when the field is available", async () => {
      copyCipherFieldDirective.action = "username";
      copyCipherFieldDirective.cipher.login.username = "test-username";

      await copyCipherFieldDirective.ngOnChanges();

      expect(copyCipherFieldDirective["disabled"]).toBe(null);
    });

    it("should be disabled when the field is not available", async () => {
      // create empty cipher
      copyCipherFieldDirective.cipher = new CipherView();

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
        undefined,
        iconButton as unknown as BitIconButtonComponent,
      );

      copyCipherFieldDirective.action = "password";

      await copyCipherFieldDirective.ngOnChanges();

      expect(iconButton.disabled.set).toHaveBeenCalledWith(true);
    });

    it("updates menuItemDirective disabled state", async () => {
      const menuItemDirective = {
        disabled: false,
      };

      copyCipherFieldDirective = new CopyCipherFieldDirective(
        copyFieldService as unknown as CopyCipherFieldService,
        menuItemDirective as unknown as MenuItemDirective,
      );

      copyCipherFieldDirective.action = "totp";

      await copyCipherFieldDirective.ngOnChanges();

      expect(menuItemDirective.disabled).toBe(true);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      copyCipherFieldDirective.cipher.login.username = "test-username";
      copyCipherFieldDirective.cipher.login.password = "test-password";
      copyCipherFieldDirective.cipher.login.totp = "test-totp";
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
      copyCipherFieldDirective.cipher.identity.username = "test-username";
      copyCipherFieldDirective.cipher.identity.email = "test-email";
      copyCipherFieldDirective.cipher.identity.phone = "test-phone";
      copyCipherFieldDirective.cipher.identity.address1 = "test-address-1";
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
      copyCipherFieldDirective.cipher.card.number = "test-card-number";
      copyCipherFieldDirective.cipher.card.code = "test-card-code";
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
      copyCipherFieldDirective.cipher.notes = "test-secure-note";
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
      copyCipherFieldDirective.cipher.sshKey.privateKey = "test-private-key";
      copyCipherFieldDirective.cipher.sshKey.publicKey = "test-public-key";
      copyCipherFieldDirective.cipher.sshKey.keyFingerprint = "test-key-fingerprint";
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
