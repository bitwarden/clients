import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import { VaultItemCopyActionsComponent } from "./item-copy-actions.component";

describe("VaultItemCopyActionsComponent", () => {
  let fixture: ComponentFixture<VaultItemCopyActionsComponent>;
  let component: VaultItemCopyActionsComponent;

  let i18nService: jest.Mocked<I18nService>;
  let copyCipherFieldService: jest.Mocked<CopyCipherFieldService>;

  beforeEach(async () => {
    i18nService = {
      t: jest.fn((key: string) => `translated-${key}`),
    } as unknown as jest.Mocked<I18nService>;

    copyCipherFieldService = mock<CopyCipherFieldService>();
    copyCipherFieldService.totpAllowed.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        JslibModule,
        ItemModule,
        IconButtonModule,
        MenuModule,
        VaultItemCopyActionsComponent,
      ],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CopyCipherFieldService, useValue: copyCipherFieldService },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultItemCopyActionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cipher", {
      type: CipherType.Login,
      name: "My cipher",
      viewPassword: true,
      login: { username: null, password: null, totp: null },
      card: { code: null, number: null },
      identity: {
        fullAddressForCopy: null,
        email: null,
        username: null,
        phone: null,
      },
      sshKey: {
        privateKey: null,
        publicKey: null,
        keyFingerprint: null,
      },
      notes: null,
      copyableFields: [],
    } as unknown as CipherViewLike);

    jest
      .spyOn(CipherViewLikeUtils, "hasCopyableValue")
      .mockImplementation(
        (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
          return Boolean(cipher.__copyable?.[field]);
        },
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("quick copy action labels", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      fixture.componentRef.setInput("showQuickCopyActions", true);
    });

    const labelFor = (icon: string) =>
      fixture.debugElement
        .query(By.css(`button[bitIconButton="${icon}"]`))
        ?.nativeElement.getAttribute("aria-label");

    it("uses the copy labels when the login fields are populated", () => {
      (component.cipher() as any).__copyable = { username: true, password: true, totp: true };

      fixture.detectChanges();

      expect(labelFor("bwi-user")).toBe("translated-copyUsername");
      expect(labelFor("bwi-key")).toBe("translated-copyPassword");
      expect(labelFor("bwi-clock")).toBe("translated-copyVerificationCode");
    });

    it("uses the empty-state labels when the login fields are not populated", () => {
      (component.cipher() as any).__copyable = { username: false, password: false, totp: false };

      fixture.detectChanges();

      expect(labelFor("bwi-user")).toBe("translated-noUsername");
      expect(labelFor("bwi-key")).toBe("translated-noPassword");
      expect(labelFor("bwi-clock")).toBe("translated-noVerificationCode");
    });

    describe("card cipher", () => {
      beforeEach(() => {
        (component.cipher() as CipherView).type = CipherType.Card;
      });

      it("uses the copy labels when the card fields are populated", () => {
        (component.cipher() as any).__copyable = { cardNumber: true, securityCode: true };

        fixture.detectChanges();

        expect(labelFor("bwi-hashtag")).toBe("translated-copyNumber");
        expect(labelFor("bwi-key")).toBe("translated-copySecurityCode");
      });

      it("uses the empty-state labels when the card fields are not populated", () => {
        (component.cipher() as any).__copyable = { cardNumber: false, securityCode: false };

        fixture.detectChanges();

        expect(labelFor("bwi-hashtag")).toBe("translated-noNumber");
        expect(labelFor("bwi-key")).toBe("translated-noSecurityCode");
      });
    });
  });

  describe("disabled input", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      fixture.componentRef.setInput("showQuickCopyActions", true);
      (component.cipher() as any).__copyable = { username: true, password: true, totp: true };
    });

    const disabledFor = (icon: string) =>
      fixture.debugElement
        .query(By.css(`button[bitIconButton="${icon}"]`))
        ?.nativeElement.getAttribute("aria-disabled");

    it("leaves copy actions enabled by default", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(disabledFor("bwi-user")).toBeNull();
      expect(disabledFor("bwi-key")).toBeNull();
      expect(disabledFor("bwi-clock")).toBeNull();
    });

    it("disables copy actions when disabled is true", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(disabledFor("bwi-user")).toBe("true");
      expect(disabledFor("bwi-key")).toBe("true");
      expect(disabledFor("bwi-clock")).toBe("true");
    });

    it("keeps empty-value copy actions disabled after disabled toggles off (list refresh)", async () => {
      // A login with no username: the username quick-copy button should always be disabled.
      (component.cipher() as any).__copyable = { username: false, password: true, totp: true };
      fixture.detectChanges();
      await fixture.whenStable();

      // Simulate a list refresh toggling the disabled input true -> false.
      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput("disabled", false);
      fixture.detectChanges();
      await fixture.whenStable();

      // The empty username button must remain disabled; the populated ones become enabled again.
      expect(disabledFor("bwi-user")).toBe("true");
      expect(disabledFor("bwi-key")).toBeNull();
      expect(disabledFor("bwi-clock")).toBeNull();
    });
  });

  describe("findSingleCopyableItem", () => {
    it("returns the single item with value and translates its key", () => {
      const items = [
        { key: "copyUsername", field: "username" as const },
        { key: "copyPassword", field: "password" as const },
      ];

      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
      };

      const result = component.findSingleCopyableItem(component.cipher(), items);

      expect(result).toEqual({
        key: "translated-copyUsername",
        field: "username",
      });
      expect(i18nService.t).toHaveBeenCalledWith("copyUsername");
    });

    it("returns null when no items have a value", () => {
      const items = [
        { key: "copyUsername", field: "username" as const },
        { key: "copyPassword", field: "password" as const },
      ];

      (component.cipher() as any).__copyable = {
        username: false,
        password: false,
      };

      const result = component.findSingleCopyableItem(component.cipher(), items);

      expect(result).toBeNull();
    });

    it("returns null when more than one item has a value", () => {
      const items = [
        { key: "copyUsername", field: "username" as const },
        { key: "copyPassword", field: "password" as const },
      ];

      (component.cipher() as any).__copyable = {
        username: true,
        password: true,
      };

      const result = component.findSingleCopyableItem(component.cipher(), items);

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableLogin", () => {
    it("returns username with special-case logic when password is hidden and both username/password exist and no totp", () => {
      (component.cipher() as CipherView).viewPassword = false;

      (component.cipher() as any).__copyable = {
        username: true,
        password: true,
        totp: false,
      };

      const result = component.singleCopyableLogin;

      expect(result).toEqual({
        key: "translated-username",
        field: "username",
      });
      expect(i18nService.t).toHaveBeenCalledWith("username");
    });

    it("returns null when password is hidden but multiple fields exist, ensuring username and totp are shown in the menu UI", () => {
      (component.cipher() as CipherView).viewPassword = false;

      (component.cipher() as any).__copyable = {
        username: true,
        password: true,
        totp: true,
      };

      const result = component.singleCopyableLogin;

      expect(result).toBeNull();
    });

    it("returns null when password is hidden and password is the only populated login field", () => {
      (component.cipher() as CipherView).viewPassword = false;

      (component.cipher() as any).__copyable = {
        username: false,
        password: true,
        totp: false,
      };

      const result = component.singleCopyableLogin;

      expect(result).toBeNull();
    });

    it("falls back to findSingleCopyableItem when password is visible", () => {
      const findSingleCopyableItemSpy = jest.spyOn(component, "findSingleCopyableItem");
      (component.cipher() as CipherView).viewPassword = true;

      void component.singleCopyableLogin;

      expect(findSingleCopyableItemSpy).toHaveBeenCalled();
    });

    it("returns a field-name-only key so copyFieldCipherName does not produce 'Copy copy'", () => {
      (component.cipher() as CipherView).viewPassword = true;

      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
        totp: false,
      };

      const result = component.singleCopyableLogin;

      // The key should be the translated field name (e.g. "username"), NOT "Copy username",
      // because the template wraps it in copyFieldCipherName = "Copy $FIELD$, $CIPHERNAME$".
      expect(result?.key).toBe("translated-username");
      expect(result?.key).not.toContain("copy");
    });
  });

  describe("singleCopyableCard", () => {
    it("returns security code when it is the only available card value", () => {
      (component.cipher() as any).__copyable = {
        securityCode: true,
        cardNumber: false,
      };

      const result = component.singleCopyableCard;

      expect(result).toEqual({
        key: "translated-securityCode",
        field: "securityCode",
      });
      expect(i18nService.t).toHaveBeenCalledWith("securityCode");
    });

    it("returns null when both card number and security code are available", () => {
      (component.cipher() as any).__copyable = {
        securityCode: true,
        cardNumber: true,
      };

      const result = component.singleCopyableCard;

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableIdentity", () => {
    it("returns the only copyable identity field", () => {
      (component.cipher() as any).__copyable = {
        address: false,
        email: true,
        username: false,
        phone: false,
      };

      const result = component.singleCopyableIdentity;

      expect(result).toEqual({
        key: "translated-email",
        field: "email",
      });
      expect(i18nService.t).toHaveBeenCalledWith("email");
    });

    it("returns null when multiple identity fields are available", () => {
      (component.cipher() as any).__copyable = {
        address: true,
        email: true,
        username: false,
        phone: false,
      };

      const result = component.singleCopyableIdentity;

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableBankAccount", () => {
    it("returns the only copyable bank account field", () => {
      (component.cipher() as any).__copyable = {
        accountNumber: true,
        routingNumber: false,
        pin: false,
        iban: false,
      };

      const result = component.singleCopyableBankAccount;

      expect(result).toEqual({
        key: "translated-accountNumber",
        field: "accountNumber",
      });
      expect(i18nService.t).toHaveBeenCalledWith("accountNumber");
    });

    it("returns null when multiple bank account fields are available", () => {
      (component.cipher() as any).__copyable = {
        accountNumber: true,
        routingNumber: true,
        pin: false,
        iban: false,
      };

      const result = component.singleCopyableBankAccount;

      expect(result).toBeNull();
    });

    it("returns null when no bank account fields are available", () => {
      (component.cipher() as any).__copyable = {
        accountNumber: false,
        routingNumber: false,
        pin: false,
        iban: false,
      };

      const result = component.singleCopyableBankAccount;

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableDriversLicense", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns the only copyable drivers license field", () => {
      (component.cipher() as any).__copyable = {
        firstName: false,
        middleName: false,
        lastName: false,
        licenseNumber: true,
      };

      const result = component.singleCopyableDriversLicense;

      expect(result).toEqual({
        key: "translated-licenseNumber",
        field: "licenseNumber",
      });
      expect(i18nService.t).toHaveBeenCalledWith("licenseNumber");
    });

    it("returns null when multiple drivers license fields are available", () => {
      (component.cipher() as any).__copyable = {
        firstName: true,
        middleName: false,
        lastName: true,
        licenseNumber: false,
      };

      const result = component.singleCopyableDriversLicense;

      expect(result).toBeNull();
    });
  });

  describe("has Values", () => {
    // Availability always resolves through `CipherViewLikeUtils.hasCopyableValue`, which owns the
    // `CipherView` vs `CipherListView` distinction. That resolution is covered by
    // cipher-view-like-utils.spec.ts.
    const setCopyable = (copyable: Record<string, boolean>) => {
      (component.cipher() as any).__copyable = copyable;
    };

    it("computes hasLoginValues from login fields", () => {
      setCopyable({ username: true, password: false, totp: false });

      expect(component.hasLoginValues).toBe(true);

      setCopyable({ username: false, password: false, totp: false });

      expect(component.hasLoginValues).toBe(false);
    });

    it("does not count password as a login value when password is hidden", () => {
      (component.cipher() as CipherView).viewPassword = false;
      setCopyable({ username: false, password: true, totp: false });

      expect(component.hasLoginValues).toBe(false);
    });

    it("computes hasCardValues from card fields", () => {
      setCopyable({ cardNumber: false, securityCode: true });

      expect(component.hasCardValues).toBe(true);

      setCopyable({ cardNumber: false, securityCode: false });

      expect(component.hasCardValues).toBe(false);
    });

    it("computes hasIdentityValues from identity fields", () => {
      setCopyable({ address: false, email: true, username: false, phone: false });

      expect(component.hasIdentityValues).toBe(true);

      setCopyable({ address: false, email: false, username: false, phone: false });

      expect(component.hasIdentityValues).toBe(false);
    });

    it("computes hasSecureNoteValue from notes", () => {
      setCopyable({ secureNote: true });

      expect(component.hasSecureNoteValue).toBe(true);

      setCopyable({ secureNote: false });

      expect(component.hasSecureNoteValue).toBe(false);
    });

    it("computes hasSshKeyValues from sshKey fields", () => {
      setCopyable({ privateKey: true, publicKey: false, keyFingerprint: false });

      expect(component.hasSshKeyValues).toBe(true);

      setCopyable({ privateKey: false, publicKey: false, keyFingerprint: false });

      expect(component.hasSshKeyValues).toBe(false);
    });

    it("computes hasBankAccountValues from bankAccount fields", () => {
      setCopyable({ nameOnAccount: true });

      expect(component.hasBankAccountValues).toBe(true);

      setCopyable({ swiftCode: true });

      expect(component.hasBankAccountValues).toBe(true);

      setCopyable({});

      expect(component.hasBankAccountValues).toBe(false);
    });

    it("computes hasDriversLicenseValues from driversLicense fields", () => {
      setCopyable({ firstNameLicense: true });

      expect(component.hasDriversLicenseValues).toBe(true);

      setCopyable({ licenseNumber: true });

      expect(component.hasDriversLicenseValues).toBe(true);

      setCopyable({});

      expect(component.hasDriversLicenseValues).toBe(false);
    });

    it("computes hasPassportValues from passport fields", () => {
      setCopyable({ givenName: true });

      expect(component.hasPassportValues).toBe(true);

      setCopyable({ nationalIdentificationNumber: true });

      expect(component.hasPassportValues).toBe(true);

      setCopyable({});

      expect(component.hasPassportValues).toBe(false);
    });
  });

  describe("singleCopyablePassport", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns the single populated passport field", () => {
      (component.cipher() as any).__copyable = {
        givenName: false,
        surname: false,
        passportNumber: true,
        nationalIdentificationNumber: false,
      };

      const result = component.singleCopyablePassport;

      expect(result).toEqual({
        key: "translated-passportNumber",
        field: "passportNumber",
      });
    });

    it("returns null when multiple passport fields are populated", () => {
      (component.cipher() as any).__copyable = {
        givenName: false,
        surname: false,
        passportNumber: true,
        nationalIdentificationNumber: true,
      };

      const result = component.singleCopyablePassport;

      expect(result).toBeNull();
    });

    it("returns null when no passport fields are populated", () => {
      (component.cipher() as any).__copyable = {
        givenName: false,
        surname: false,
        passportNumber: false,
        nationalIdentificationNumber: false,
      };

      const result = component.singleCopyablePassport;

      expect(result).toBeNull();
    });
  });
});
