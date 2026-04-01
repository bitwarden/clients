import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, ItemModule, MenuModule } from "@bitwarden/components";
import { CipherListView, CopyableCipherFields } from "@bitwarden/sdk-internal";

import { VaultPopupCopyButtonsService } from "../../../services/vault-popup-copy-buttons.service";

import { ItemCopyActionsComponent } from "./item-copy-actions.component";

describe("ItemCopyActionsComponent", () => {
  let fixture: ComponentFixture<ItemCopyActionsComponent>;
  let component: ItemCopyActionsComponent;

  let i18nService: jest.Mocked<I18nService>;

  beforeEach(async () => {
    i18nService = {
      t: jest.fn((key: string) => `translated-${key}`),
    } as unknown as jest.Mocked<I18nService>;

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        JslibModule,
        ItemModule,
        IconButtonModule,
        MenuModule,
        ItemCopyActionsComponent, // standalone
      ],
      providers: [
        { provide: I18nService, useValue: i18nService },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: {
            showQuickCopyActions$: of(true),
          } satisfies Partial<VaultPopupCopyButtonsService>,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemCopyActionsComponent);
    component = fixture.componentInstance;

    // Default cipher so tests can override as needed
    component.cipher = {
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
    } as unknown as CipherViewLike;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findSingleCopyableItem", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns the single item with value and translates its key", () => {
      const items = [
        { key: "copyUsername", field: "username" as const },
        { key: "copyPassword", field: "password" as const },
      ];

      (component.cipher as any).__copyable = {
        username: true,
        password: false,
      };

      const result = component.findSingleCopyableItem(items);

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

      (component.cipher as any).__copyable = {
        username: false,
        password: false,
      };

      const result = component.findSingleCopyableItem(items);

      expect(result).toBeNull();
    });

    it("returns null when more than one item has a value", () => {
      const items = [
        { key: "copyUsername", field: "username" as const },
        { key: "copyPassword", field: "password" as const },
      ];

      (component.cipher as any).__copyable = {
        username: true,
        password: true,
      };

      const result = component.findSingleCopyableItem(items);

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableLogin", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns username with special-case logic when password is hidden and both username/password exist and no totp", () => {
      (component.cipher as CipherView).viewPassword = false;

      (component.cipher as any).__copyable = {
        username: true,
        password: true,
        totp: false,
      };

      const result = component.singleCopyableLogin;

      expect(result).toEqual({
        key: "translated-copyUsername",
        field: "username",
      });
      expect(i18nService.t).toHaveBeenCalledWith("copyUsername");
    });

    it("returns null when password is hidden but multiple fields exist, ensuring username and totp are shown in the menu UI ", () => {
      (component.cipher as CipherView).viewPassword = false;

      (component.cipher as any).__copyable = {
        username: true,
        password: true,
        totp: true,
      };

      const result = component.singleCopyableLogin;

      expect(result).toBeNull();
    });

    it("falls back to findSingleCopyableItem when password is visible", () => {
      const findSingleCopyableItemSpy = jest.spyOn(component, "findSingleCopyableItem");
      (component.cipher as CipherView).viewPassword = true;

      void component.singleCopyableLogin;
      expect(findSingleCopyableItemSpy).toHaveBeenCalled();
    });
  });

  describe("singleCopyableCard", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns security code when it is the only available card value", () => {
      (component.cipher as any).__copyable = {
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
      (component.cipher as any).__copyable = {
        securityCode: true,
        cardNumber: true,
      };

      const result = component.singleCopyableCard;

      expect(result).toBeNull();
    });
  });

  describe("singleCopyableIdentity", () => {
    beforeEach(() => {
      jest
        .spyOn(CipherViewLikeUtils, "hasCopyableValue")
        .mockImplementation(
          (cipher: CipherViewLike & { __copyable?: Record<string, boolean> }, field) => {
            return Boolean(cipher.__copyable?.[field]);
          },
        );
    });

    it("returns the only copyable identity field", () => {
      (component.cipher as any).__copyable = {
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
      (component.cipher as any).__copyable = {
        address: true,
        email: true,
        username: false,
        phone: false,
      };

      const result = component.singleCopyableIdentity;

      expect(result).toBeNull();
    });
  });

  describe("has*Values in non-list view", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(false);
    });

    it("computes hasLoginValues from login fields", () => {
      (component.cipher as CipherView).login = {
        username: "user",
        password: null,
        totp: null,
      } as any;

      expect(component.hasLoginValues).toBe(true);

      (component.cipher as CipherView).login = {
        username: null,
        password: null,
        totp: null,
      } as any;

      expect(component.hasLoginValues).toBe(false);
    });

    it("computes hasCardValues from card fields", () => {
      (component.cipher as CipherView).card = { code: "123", number: null } as any;

      expect(component.hasCardValues).toBe(true);

      (component.cipher as CipherView).card = { code: null, number: null } as any;

      expect(component.hasCardValues).toBe(false);
    });

    it("computes hasIdentityValues from identity fields", () => {
      (component.cipher as CipherView).identity = {
        fullAddressForCopy: null,
        email: "test@example.com",
        username: null,
        phone: null,
      } as any;

      expect(component.hasIdentityValues).toBe(true);

      (component.cipher as CipherView).identity = {
        fullAddressForCopy: null,
        email: null,
        username: null,
        phone: null,
      } as any;

      expect(component.hasIdentityValues).toBe(false);
    });

    it("computes hasSecureNoteValue from notes", () => {
      (component.cipher as CipherView).notes = "Some note" as any;
      expect(component.hasSecureNoteValue).toBe(true);

      (component.cipher as CipherView).notes = null as any;
      expect(component.hasSecureNoteValue).toBe(false);
    });

    it("computes hasSshKeyValues from sshKey fields", () => {
      (component.cipher as CipherView).sshKey = {
        privateKey: "priv",
        publicKey: null,
        keyFingerprint: null,
      } as any;

      expect(component.hasSshKeyValues).toBe(true);

      (component.cipher as CipherView).sshKey = {
        privateKey: null,
        publicKey: null,
        keyFingerprint: null,
      } as any;

      expect(component.hasSshKeyValues).toBe(false);
    });
  });

  describe("has*Values in list view", () => {
    beforeEach(() => {
      jest.spyOn(CipherViewLikeUtils, "isCipherListView").mockReturnValue(true);
    });

    it("uses copyableFields for login values", () => {
      (component.cipher as CipherListView).copyableFields = [
        "LoginUsername",
        "CardNumber",
      ] as CopyableCipherFields[];

      expect(component.hasLoginValues).toBe(true);

      (component.cipher as CipherListView).copyableFields = [
        "CardNumber",
      ] as CopyableCipherFields[];

      expect(component.hasLoginValues).toBe(false);
    });

    it("uses copyableFields for card values", () => {
      (component.cipher as CipherListView).copyableFields = [
        "CardSecurityCode",
      ] as CopyableCipherFields[];

      expect(component.hasCardValues).toBe(true);

      (component.cipher as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasCardValues).toBe(false);
    });

    it("uses copyableFields for identity values", () => {
      (component.cipher as CipherListView).copyableFields = [
        "IdentityEmail",
      ] as CopyableCipherFields[];

      expect(component.hasIdentityValues).toBe(true);

      (component.cipher as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];

      expect(component.hasIdentityValues).toBe(false);
    });

    it("uses copyableFields for secure note value", () => {
      (component.cipher as CipherListView).copyableFields = [
        "SecureNotes",
      ] as CopyableCipherFields[];
      expect(component.hasSecureNoteValue).toBe(true);

      (component.cipher as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];
      expect(component.hasSecureNoteValue).toBe(false);
    });

    it("uses copyableFields for ssh key values", () => {
      (component.cipher as CipherListView).copyableFields = ["SshKey"] as CopyableCipherFields[];
      expect(component.hasSshKeyValues).toBe(true);

      (component.cipher as CipherListView).copyableFields = [
        "LoginUsername",
      ] as CopyableCipherFields[];
      expect(component.hasSshKeyValues).toBe(false);
    });
  });
});
