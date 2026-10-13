import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CompactModeService, DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";

import { VaultListItemsContainerComponent } from "./vault-list-items-container.component";

describe("VaultListItemsContainerComponent", () => {
  let fixture: ComponentFixture<VaultListItemsContainerComponent>;
  let component: VaultListItemsContainerComponent;

  const currentTabIsOnBlocklist$ = new BehaviorSubject<boolean>(false);

  const mockCipher = {
    id: "cipher-1",
    name: "Test Login",
    type: CipherType.Login,
    login: {
      username: "user@example.com",
      uris: [{ uri: "https://example.com", match: null }],
    },
    favorite: false,
    reprompt: 0,
    organizationId: null,
    collectionIds: [],
    edit: true,
    viewPassword: true,
  } as any;

  const vaultPopupAutofillService = {
    currentTabIsOnBlocklist$: currentTabIsOnBlocklist$.asObservable(),
    doAutofill: jest.fn(),
  };

  const compactModeService = {
    enabled$: of(false),
  };

  const vaultPopupSectionService = {
    getOpenDisplayStateForSection: jest.fn().mockReturnValue(() => true),
    updateSectionOpenStoredState: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    currentTabIsOnBlocklist$.next(false);

    await TestBed.configureTestingModule({
      imports: [VaultListItemsContainerComponent, NoopAnimationsModule],
      providers: [
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
        { provide: CompactModeService, useValue: compactModeService },
        { provide: VaultPopupSectionService, useValue: vaultPopupSectionService },
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "UserId" }) } },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideProvider(DialogService, { useValue: mock<DialogService>() })
      .compileComponents();

    fixture = TestBed.createComponent(VaultListItemsContainerComponent);
    component = fixture.componentInstance;
  });

  describe("item actions", () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it("should show fill text on hover for autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      expect(component.showFillTextOnHover()).toBe(true);
    });

    it("should not show fill text on hover for non-autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      expect(component.showFillTextOnHover()).toBe(false);
    });

    it("should hide launch button for autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      expect(component.showLaunchButton()).toBe(false);
    });

    it("should show launch button for non-autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      expect(component.showLaunchButton()).toBe(true);
    });

    it("should show autofill in menu for non-autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      expect(component.showAutofillInMenu()).toBe(true);
    });

    it("should hide autofill in menu for autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      expect(component.showAutofillInMenu()).toBe(false);
    });

    it("should show view in menu for autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      expect(component.showViewInMenu()).toBe(true);
    });

    it("should hide view in menu for non-autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      expect(component.showViewInMenu()).toBe(false);
    });

    it("should autofill on select for autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      expect(component.canAutofill()).toBe(true);
    });

    it("should not autofill on select for non-autofill list items", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      expect(component.canAutofill()).toBe(false);
    });

    describe("when current URI is blocked", () => {
      beforeEach(() => {
        currentTabIsOnBlocklist$.next(true);
        fixture.detectChanges();
      });

      it("should not autofill on select even when isAutofillList is true", () => {
        fixture.componentRef.setInput("isAutofillList", true);
        fixture.detectChanges();

        expect(component.canAutofill()).toBe(false);
      });
    });
  });

  describe("cipherItemTitleKey", () => {
    it("should return autofillTitle when canAutofill is true", () => {
      fixture.componentRef.setInput("isAutofillList", true);
      fixture.detectChanges();

      const titleKeyFn = component.cipherItemTitleKey();
      const result = titleKeyFn(mockCipher);

      expect(result).toBe("autofillTitleWithField");
    });

    it("should return viewItemTitle when canAutofill is false", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      const titleKeyFn = component.cipherItemTitleKey();
      const result = titleKeyFn(mockCipher);

      expect(result).toBe("viewItemTitleWithField");
    });

    it("should return title without WithField when cipher has no username", () => {
      fixture.componentRef.setInput("isAutofillList", false);
      fixture.detectChanges();

      const cipherWithoutUsername = {
        ...mockCipher,
        login: { ...mockCipher.login, username: null },
      } as PopupCipherViewLike;

      const titleKeyFn = component.cipherItemTitleKey();
      const result = titleKeyFn(cipherWithoutUsername);

      expect(result).toBe("viewItemTitle");
    });
  });
});
