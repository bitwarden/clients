import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule, ToastService } from "@bitwarden/components";
import { CipherListView, CopyableCipherFields } from "@bitwarden/sdk-internal";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import { CustomFieldItem, VaultItemCopyActionsComponent } from "./item-copy-actions.component";

// uuidAsString is called internally by copyCustomField when decrypting CipherListView ciphers.
// Mock it so the tests do not depend on the Rust SDK's UUID parsing implementation.
jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk.service", () => ({
  uuidAsString: jest.fn(() => "mock-uuid"),
}));

describe("VaultItemCopyActionsComponent", () => {
  let fixture: ComponentFixture<VaultItemCopyActionsComponent>;
  let component: VaultItemCopyActionsComponent;

  let i18nService: jest.Mocked<I18nService>;
  let copyCipherFieldService: jest.Mocked<CopyCipherFieldService>;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;
  let toastService: jest.Mocked<ToastService>;
  let accountService: jest.Mocked<AccountService>;
  let cipherService: jest.Mocked<CipherService>;

  beforeEach(async () => {
    i18nService = {
      t: jest.fn((key: string) => `translated-${key}`),
    } as unknown as jest.Mocked<I18nService>;

    copyCipherFieldService = mock<CopyCipherFieldService>();
    copyCipherFieldService.totpAllowed.mockResolvedValue(true);

    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    accountService = mock<AccountService>();
    cipherService = mock<CipherService>();

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
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
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
    it("returns the single item with value", () => {
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
        key: "copyUsername",
        field: "username",
      });
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
        key: "copyUsername",
        field: "username",
      });
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

    it("returns a full copy-action translation key rather than a bare field name", () => {
      (component.cipher() as CipherView).viewPassword = true;

      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
        totp: false,
      };

      const result = component.singleCopyableLogin;

      // The key must be the existing full-phrase key ("Copy username"), not a lowercased
      // noun fragment composed into a sentence at render time — fragments localize poorly.
      expect(result?.key).toBe("copyUsername");
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
        key: "copySecurityCode",
        field: "securityCode",
      });
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
        key: "copyEmail",
        field: "email",
      });
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
        key: "copyAccountNumber",
        field: "accountNumber",
      });
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
        key: "copyLicenseNumber",
        field: "licenseNumber",
      });
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

  describe("has Values in non-list view", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("computes hasLoginValues from login fields", () => {
      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
        totp: false,
      };

      (component.cipher() as CipherView).login = {
        username: "user",
        password: null,
        totp: null,
      } as any;

      expect(component.hasLoginValues).toBe(true);

      (component.cipher() as any).__copyable = {
        username: false,
        password: false,
        totp: false,
      };

      (component.cipher() as CipherView).login = {
        username: null,
        password: null,
        totp: null,
      } as any;

      expect(component.hasLoginValues).toBe(false);
    });

    it("does not count password as a login value when password is hidden", () => {
      (component.cipher() as CipherView).viewPassword = false;
      (component.cipher() as any).__copyable = {
        username: false,
        password: true,
        totp: false,
      };

      expect(component.hasLoginValues).toBe(false);
    });

    it("computes hasCardValues from card fields", () => {
      (component.cipher() as CipherView).card = { code: "123", number: null } as any;

      expect(component.hasCardValues).toBe(true);

      (component.cipher() as CipherView).card = { code: null, number: null } as any;

      expect(component.hasCardValues).toBe(false);
    });

    it("computes hasIdentityValues from identity fields", () => {
      (component.cipher() as CipherView).identity = {
        fullAddressForCopy: null,
        email: "test@example.com",
        username: null,
        phone: null,
      } as any;

      expect(component.hasIdentityValues).toBe(true);

      (component.cipher() as CipherView).identity = {
        fullAddressForCopy: null,
        email: null,
        username: null,
        phone: null,
      } as any;

      expect(component.hasIdentityValues).toBe(false);
    });

    it("computes hasSecureNoteValue from notes", () => {
      (component.cipher() as CipherView).notes = "Some note" as any;

      expect(component.hasSecureNoteValue).toBe(true);

      (component.cipher() as CipherView).notes = null as any;

      expect(component.hasSecureNoteValue).toBe(false);
    });

    it("computes hasSshKeyValues from sshKey fields", () => {
      (component.cipher() as CipherView).sshKey = {
        privateKey: "priv",
        publicKey: null,
        keyFingerprint: null,
      } as any;

      expect(component.hasSshKeyValues).toBe(true);

      (component.cipher() as CipherView).sshKey = {
        privateKey: null,
        publicKey: null,
        keyFingerprint: null,
      } as any;

      expect(component.hasSshKeyValues).toBe(false);
    });

    it("computes hasBankAccountValues from bankAccount fields", () => {
      (component.cipher() as CipherView).bankAccount = {
        accountNumber: "123456",
        routingNumber: null,
        pin: null,
        iban: null,
      } as any;

      expect(component.hasBankAccountValues).toBe(true);

      (component.cipher() as CipherView).bankAccount = {
        accountNumber: null,
        routingNumber: null,
        pin: null,
        iban: null,
      } as any;

      expect(component.hasBankAccountValues).toBe(false);
    });

    it("computes hasDriversLicenseValues from driversLicense fields", () => {
      (component.cipher() as CipherView).driversLicense = {
        firstName: "John",
        middleName: null,
        lastName: null,
        licenseNumber: null,
      } as any;

      expect(component.hasDriversLicenseValues).toBe(true);

      (component.cipher() as CipherView).driversLicense = {
        firstName: null,
        middleName: null,
        lastName: null,
        licenseNumber: null,
      } as any;

      expect(component.hasDriversLicenseValues).toBe(false);
    });

    it("computes hasBankAccountValues from bankAccount fields", () => {
      (component.cipher() as CipherView).bankAccount = {
        nameOnAccount: "Jane Doe",
        accountNumber: null,
        routingNumber: null,
        branchNumber: null,
        pin: null,
        iban: null,
        swiftCode: null,
      } as any;

      expect(component.hasBankAccountValues).toBe(true);

      (component.cipher() as CipherView).bankAccount = {
        nameOnAccount: null,
        accountNumber: null,
        routingNumber: null,
        branchNumber: null,
        pin: null,
        iban: null,
        swiftCode: null,
      } as any;

      expect(component.hasBankAccountValues).toBe(false);
    });

    it("computes hasPassportValues from passport fields", () => {
      (component.cipher() as CipherView).passport = {
        givenName: "Jane",
        surname: null,
        passportNumber: null,
        nationalIdentificationNumber: null,
      } as any;

      expect(component.hasPassportValues).toBe(true);

      (component.cipher() as CipherView).passport = {
        givenName: null,
        surname: null,
        passportNumber: null,
        nationalIdentificationNumber: null,
      } as any;

      expect(component.hasPassportValues).toBe(false);
    });
  });

  describe("has Values in list view", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
    });

    it("uses hasCopyableValue for login values", () => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation((_cipher, field) => field === "username" || field === "password");

      expect(component.hasLoginValues).toBe(true);

      jest.spyOn(CipherViewLikeUtils, "hasCopyableValue").mockImplementation(() => false);

      expect(component.hasLoginValues).toBe(false);
    });

    it("uses copyableFields for card values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "CardSecurityCode",
      ] as CopyableCipherFields[];

      expect(component.hasCardValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasCardValues).toBe(false);
    });

    it("uses copyableFields for identity values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "IdentityEmail",
      ] as CopyableCipherFields[];

      expect(component.hasIdentityValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasIdentityValues).toBe(false);
    });

    it("uses copyableFields for secure note value", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "SecureNotes",
      ] as CopyableCipherFields[];

      expect(component.hasSecureNoteValue).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasSecureNoteValue).toBe(false);
    });

    it("uses copyableFields for ssh key values", () => {
      (component.cipher() as CipherListView).copyableFields = ["SshKey"] as CopyableCipherFields[];

      expect(component.hasSshKeyValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasSshKeyValues).toBe(false);
    });

    it("uses copyableFields for bank account values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "BankAccountAccountNumber",
      ] as CopyableCipherFields[];

      expect(component.hasBankAccountValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasBankAccountValues).toBe(false);
    });

    it("uses copyableFields for drivers license values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "DriversLicenseLicenseNumber",
      ] as CopyableCipherFields[];

      expect(component.hasDriversLicenseValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "DriversLicenseFirstName",
      ] as CopyableCipherFields[];

      expect(component.hasDriversLicenseValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasDriversLicenseValues).toBe(false);
    });

    it("uses copyableFields for bank account values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "BankAccountSwift",
      ] as CopyableCipherFields[];

      expect(component.hasBankAccountValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "BankAccountNameOnAccount",
      ] as CopyableCipherFields[];

      expect(component.hasBankAccountValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasBankAccountValues).toBe(false);
    });

    it("uses copyableFields for passport values", () => {
      (component.cipher() as CipherListView).copyableFields = [
        "PassportNationalIdentificationNumber",
      ] as CopyableCipherFields[];

      expect(component.hasPassportValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "PassportGivenName",
      ] as CopyableCipherFields[];

      expect(component.hasPassportValues).toBe(true);

      (component.cipher() as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

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
        key: "copyPassportNumber",
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

  describe("copyableCustomFields", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    const makeField = (name: string, value: string | undefined, type: FieldType): FieldView => {
      const f = new FieldView();
      f.name = name;
      f.value = value;
      f.type = type;
      return f;
    };

    it("returns text fields that have a name", () => {
      (component.cipher() as CipherView).fields = [makeField("企業ID", "ACME-001", FieldType.Text)];

      expect(component.copyableCustomFields).toEqual([
        { name: "企業ID", value: "ACME-001", isHidden: false, index: 0 },
      ]);
    });

    it("returns hidden fields when viewPassword is true", () => {
      (component.cipher() as CipherView).viewPassword = true;
      (component.cipher() as CipherView).fields = [
        makeField("シークレット", "s3cr3t", FieldType.Hidden),
      ];

      expect(component.copyableCustomFields).toEqual([
        { name: "シークレット", value: "s3cr3t", isHidden: true, index: 0 },
      ]);
    });

    it("filters out hidden fields when viewPassword is false", () => {
      (component.cipher() as CipherView).viewPassword = false;
      (component.cipher() as CipherView).fields = [
        makeField("シークレット", "s3cr3t", FieldType.Hidden),
      ];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("filters out boolean fields", () => {
      (component.cipher() as CipherView).fields = [makeField("フラグ", "true", FieldType.Boolean)];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("filters out linked fields", () => {
      (component.cipher() as CipherView).fields = [makeField("リンク", "value", FieldType.Linked)];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("filters out fields with no name", () => {
      const f = new FieldView();
      f.name = undefined;
      f.value = "some-value";
      f.type = FieldType.Text;
      (component.cipher() as CipherView).fields = [f];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("returns empty array when cipher has no fields", () => {
      (component.cipher() as CipherView).fields = [];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("preserves original index even when earlier fields are filtered out", () => {
      (component.cipher() as CipherView).viewPassword = true;
      (component.cipher() as CipherView).fields = [
        makeField("有効", "true", FieldType.Boolean), // index 0: filtered
        makeField("企業ID", "ACME-001", FieldType.Text), // index 1: kept
        makeField("APIキー", "key", FieldType.Hidden), // index 2: kept
      ];

      const result = component.copyableCustomFields;
      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(1);
      expect(result[1].index).toBe(2);
    });

    it("filters out hidden fields with empty string value on CipherView (B1)", () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      (component.cipher() as CipherView).viewPassword = true;
      (component.cipher() as CipherView).fields = [
        makeField("空シークレット", "", FieldType.Hidden),
      ];

      expect(component.copyableCustomFields).toHaveLength(0);
    });

    it("keeps hidden fields with a value on CipherView (B1 — positive case)", () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      (component.cipher() as CipherView).viewPassword = true;
      (component.cipher() as CipherView).fields = [
        makeField("シークレット", "s3cr3t", FieldType.Hidden),
      ];

      expect(component.copyableCustomFields).toHaveLength(1);
      expect(component.copyableCustomFields[0].name).toBe("シークレット");
    });

    it("keeps hidden fields with undefined value on CipherListView (B1 — list-view normal case)", () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
      (component.cipher() as CipherView).viewPassword = true;
      (component.cipher() as CipherView).fields = [
        makeField("シークレット", undefined, FieldType.Hidden),
      ];

      expect(component.copyableCustomFields).toHaveLength(1);
    });
  });

  describe("singleCopyableLogin with custom fields", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("returns null when custom fields are present, even if only one login field exists", () => {
      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
        totp: false,
      };
      const f = new FieldView();
      f.name = "企業ID";
      f.value = "ACME-001";
      f.type = FieldType.Text;
      (component.cipher() as CipherView).fields = [f];

      expect(component.singleCopyableLogin).toBeNull();
    });

    it("still returns single item when no custom fields exist", () => {
      (component.cipher() as any).__copyable = {
        username: true,
        password: false,
        totp: false,
      };
      (component.cipher() as CipherView).fields = [];

      expect(component.singleCopyableLogin).toEqual({
        key: "copyUsername",
        field: "username",
      });
    });
  });

  describe("hasLoginValues with custom fields", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("returns true when custom fields exist even if no standard login fields", () => {
      (component.cipher() as any).__copyable = {
        username: false,
        password: false,
        totp: false,
      };
      const f = new FieldView();
      f.name = "企業ID";
      f.value = "ACME-001";
      f.type = FieldType.Text;
      (component.cipher() as CipherView).fields = [f];

      expect(component.hasLoginValues).toBe(true);
    });
  });

  describe("copyCustomField", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("copies text field value and shows toast", async () => {
      const field = { name: "企業ID", value: "ACME-001", isHidden: false, index: 0 };

      await component.copyCustomField(field);

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("ACME-001");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("does nothing when text field value is empty string", async () => {
      const field = { name: "企業ID", value: "", isHidden: false, index: 0 };

      await component.copyCustomField(field);

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("does nothing when hidden field value is null on a CipherView (field truly has no value)", async () => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
      const field: CustomFieldItem = {
        name: "シークレット",
        value: undefined,
        isHidden: true,
        index: 0,
      };

      await component.copyCustomField(field);

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
    });

    it("routes hidden field copy through CopyCipherFieldService for reprompt and audit events", async () => {
      copyCipherFieldService.copy.mockResolvedValue(undefined);

      const field: CustomFieldItem = {
        name: "シークレット",
        value: "secret",
        isHidden: true,
        index: 0,
      };

      await component.copyCustomField(field);

      expect(copyCipherFieldService.copy).toHaveBeenCalledWith(
        "secret",
        "hiddenField",
        expect.anything(),
        false,
        "シークレット",
      );
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("does not call CopyCipherFieldService for text fields", async () => {
      const field = { name: "企業ID", value: "ACME-001", isHidden: false, index: 0 };

      await component.copyCustomField(field);

      expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("ACME-001");
    });

    it("does not decrypt when field is text type even if value is null (text has no value)", async () => {
      // Text fields in CipherListView have their value populated; null means the field is empty.
      // We should NOT decrypt just because value is null — only hidden fields need decryption.
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
      const field: CustomFieldItem = {
        name: "企業ID",
        value: undefined,
        isHidden: false,
        index: 0,
      };

      await component.copyCustomField(field);

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
    });

    describe("CipherListView hidden field decryption", () => {
      beforeEach(() => {
        jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
        // Provide a fake account so getUserId can emit a UserId.
        accountService.activeAccount$ = of({ id: "test-user-id" } as any);
        // Give the cipher an id so uuidAsString has something to work with.
        (component.cipher() as any).id = "test-cipher-uuid";
      });

      it("decrypts the cipher and copies the hidden field value via CopyCipherFieldService", async () => {
        const encryptedCipher = {} as any;
        const decryptedCipher = {
          viewPassword: true,
          fields: [{ name: "シークレット", type: FieldType.Hidden, value: "decrypted-secret" }],
        } as any;
        cipherService.get.mockResolvedValue(encryptedCipher);
        cipherService.decrypt.mockResolvedValue(decryptedCipher);
        copyCipherFieldService.copy.mockResolvedValue(true);

        const field: CustomFieldItem = {
          name: "シークレット",
          value: undefined,
          isHidden: true,
          index: 0,
        };

        await component.copyCustomField(field);

        expect(copyCipherFieldService.copy).toHaveBeenCalledWith(
          "decrypted-secret",
          "hiddenField",
          expect.anything(),
          false,
          "シークレット",
        );
        expect(toastService.showToast).not.toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
      });

      it("shows error toast when decrypted field name or type does not match (concurrent edit)", async () => {
        const encryptedCipher = {} as any;
        // Simulate a concurrent edit that renamed or changed the field at index 0.
        const decryptedCipher = {
          viewPassword: true,
          fields: [{ name: "別のフィールド", type: FieldType.Hidden, value: "some-value" }],
        } as any;
        cipherService.get.mockResolvedValue(encryptedCipher);
        cipherService.decrypt.mockResolvedValue(decryptedCipher);

        const field: CustomFieldItem = {
          name: "シークレット",
          value: undefined,
          isHidden: true,
          index: 0,
        };

        await component.copyCustomField(field);

        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
        expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
      });

      it("shows error toast when cipherService.get throws an exception", async () => {
        cipherService.get.mockRejectedValue(new Error("Network error"));

        const field: CustomFieldItem = {
          name: "シークレット",
          value: undefined,
          isHidden: true,
          index: 0,
        };

        await component.copyCustomField(field);

        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
        expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
      });

      it("shows error toast and skips copy when viewPassword is false after decryption (B2/B4)", async () => {
        const encryptedCipher = {} as any;
        const decryptedCipher = {
          viewPassword: false,
          fields: [{ name: "シークレット", type: FieldType.Hidden, value: "decrypted-secret" }],
        } as any;
        cipherService.get.mockResolvedValue(encryptedCipher);
        cipherService.decrypt.mockResolvedValue(decryptedCipher);

        const field: CustomFieldItem = {
          name: "シークレット",
          value: undefined,
          isHidden: true,
          index: 0,
        };

        await component.copyCustomField(field);

        expect(copyCipherFieldService.copy).not.toHaveBeenCalled();
        expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "error" }),
        );
      });
    });
  });

  describe("hasPassportValues in non-list view", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("returns true when at least one passport field is populated", () => {
      (component.cipher() as any).passport = { passportNumber: "AB123456" };

      expect(component.hasPassportValues).toBe(true);
    });

    it("returns false when all passport fields are empty", () => {
      (component.cipher() as any).passport = {
        givenName: null,
        surname: null,
        passportNumber: null,
        nationalIdentificationNumber: null,
      };

      expect(component.hasPassportValues).toBe(false);
    });
  });
});
