import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CompactModeService, DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";

import { VaultListItemsContainerComponent } from "./vault-list-items-container.component";

describe("VaultListItemsContainerComponent", () => {
  let fixture: ComponentFixture<VaultListItemsContainerComponent>;
  let component: VaultListItemsContainerComponent;

  const featureFlag$ = new BehaviorSubject<boolean>(false);
  const currentTabIsOnBlocklist$ = new BehaviorSubject<boolean>(false);
  const clickItemsToAutofillVaultView$ = new BehaviorSubject<boolean>(true);
  const autoFillCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);

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

  const configService = {
    getFeatureFlag$: jest.fn().mockImplementation((flag: FeatureFlag) => {
      if (flag === FeatureFlag.PM31039ItemActionInExtension) {
        return featureFlag$.asObservable();
      }
      return of(false);
    }),
  };

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

  const vaultSettingsService = {
    clickItemsToAutofillVaultView$: clickItemsToAutofillVaultView$.asObservable(),
  };

  const vaultPopupItemsService = {
    autoFillCiphers$: autoFillCiphers$.asObservable(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    featureFlag$.next(false);
    currentTabIsOnBlocklist$.next(false);
    clickItemsToAutofillVaultView$.next(true);
    autoFillCiphers$.next([]);

    await TestBed.configureTestingModule({
      imports: [VaultListItemsContainerComponent, NoopAnimationsModule],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: VaultPopupAutofillService, useValue: vaultPopupAutofillService },
        { provide: CompactModeService, useValue: compactModeService },
        { provide: VaultPopupSectionService, useValue: vaultPopupSectionService },
        { provide: VaultSettingsService, useValue: vaultSettingsService },
        { provide: VaultPopupItemsService, useValue: vaultPopupItemsService },
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "UserId" }) } },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: PlatformUtilsService, useValue: { getAutofillKeyboardShortcut: () => "" } },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultListItemsContainerComponent);
    component = fixture.componentInstance;
  });

  describe("Updated item action feature flag", () => {
    describe("when feature flag is OFF", () => {
      beforeEach(() => {
        featureFlag$.next(false);
        fixture.detectChanges();
      });

      it("should not show fill text on hover", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showFillTextOnHover(mockCipher)).toBe(false);
      });

      it("should show autofill badge when cipher is autofillable and click-to-view is preferred", () => {
        // When cipher is in autofill list and clickItemsToAutofillVaultView=false:
        // showAutofillButton=true, primaryActionAutofill=false → badge visible
        clickItemsToAutofillVaultView$.next(false);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showAutofillBadge(mockCipher)).toBe(true);
      });

      it("should hide autofill badge when click-to-autofill is preferred", () => {
        // When cipher is in autofill list and clickItemsToAutofillVaultView=true:
        // showAutofillButton=false (since primaryActionAutofill takes over)
        clickItemsToAutofillVaultView$.next(true);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showAutofillBadge(mockCipher)).toBe(false);
      });

      it("should show launch button when cipher is not in autofill list", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showLaunchButton(mockCipher)).toBe(true);
      });

      it("should hide launch button when cipher is autofillable and click-to-view is preferred", () => {
        // When showAutofillButton is true (cipher in autofill list && !clickItemsToAutofillVaultView)
        clickItemsToAutofillVaultView$.next(false);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showLaunchButton(mockCipher)).toBe(false);
      });

      it("should show autofill in menu when cipher is not in autofill list", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showAutofillInMenu(mockCipher)).toBe(true);
      });

      it("should hide autofill in menu when cipher is autofillable and click-to-view is preferred", () => {
        // When showAutofillButton is true, hideAutofillMenuOptions becomes true
        clickItemsToAutofillVaultView$.next(false);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showAutofillInMenu(mockCipher)).toBe(false);
      });

      it("should show view in menu when primaryActionAutofill is true", () => {
        // primaryActionAutofill = cipher in autofill list && clickItemsToAutofillVaultView
        clickItemsToAutofillVaultView$.next(true);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showViewInMenu(mockCipher)).toBe(true);
      });

      it("should hide view in menu when primaryActionAutofill is false", () => {
        // Either not in autofill list or click-to-view is preferred
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showViewInMenu(mockCipher)).toBe(false);
      });

      it("should autofill on select when primaryActionAutofill is true", () => {
        // primaryActionAutofill = cipher in autofill list && clickItemsToAutofillVaultView
        clickItemsToAutofillVaultView$.next(true);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(true);
      });

      it("should not autofill on select when cipher is not in autofill list", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(false);
      });

      it("should not autofill on select when click-to-view is preferred", () => {
        clickItemsToAutofillVaultView$.next(false);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(false);
      });
    });

    describe("when feature flag is ON", () => {
      beforeEach(() => {
        featureFlag$.next(true);
        fixture.detectChanges();
      });

      it("should show fill text on hover for autofill ciphers", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showFillTextOnHover(mockCipher)).toBe(true);
      });

      it("should not show fill text on hover for non-autofill ciphers", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showFillTextOnHover(mockCipher)).toBe(false);
      });

      it("should not show autofill badge", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showAutofillBadge(mockCipher)).toBe(false);
      });

      it("should hide launch button for autofill ciphers", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showLaunchButton(mockCipher)).toBe(false);
      });

      it("should show launch button for non-autofill ciphers", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showLaunchButton(mockCipher)).toBe(true);
      });

      it("should show autofill in menu for non-autofill ciphers", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showAutofillInMenu(mockCipher)).toBe(true);
      });

      it("should hide autofill in menu for autofill ciphers", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showAutofillInMenu(mockCipher)).toBe(false);
      });

      it("should show view in menu for autofill ciphers", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.showViewInMenu(mockCipher)).toBe(true);
      });

      it("should hide view in menu for non-autofill ciphers", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.showViewInMenu(mockCipher)).toBe(false);
      });

      it("should autofill on select for autofill ciphers", () => {
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(true);
      });

      it("should not autofill on select for non-autofill ciphers", () => {
        autoFillCiphers$.next([]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(false);
      });
    });

    describe("when current URI is blocked", () => {
      beforeEach(() => {
        currentTabIsOnBlocklist$.next(true);
        fixture.detectChanges();
      });

      it("should not autofill on select even when feature flag is ON and cipher is autofillable", () => {
        featureFlag$.next(true);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(false);
      });

      it("should not autofill on select even when cipher is autofillable and click-to-autofill is preferred", () => {
        featureFlag$.next(false);
        clickItemsToAutofillVaultView$.next(true);
        autoFillCiphers$.next([mockCipher]);
        fixture.detectChanges();

        expect(component.canAutofill(mockCipher)).toBe(false);
      });
    });
  });

  describe("cipherItemTitleKey", () => {
    it("should return autofillTitle when canAutofill is true", () => {
      featureFlag$.next(true);
      autoFillCiphers$.next([mockCipher]);
      fixture.detectChanges();

      const result = component.cipherItemTitleKey(mockCipher);

      expect(result).toBe("autofillTitleWithField");
    });

    it("should return viewItemTitle when canAutofill is false", () => {
      featureFlag$.next(true);
      autoFillCiphers$.next([]);
      fixture.detectChanges();

      const result = component.cipherItemTitleKey(mockCipher);

      expect(result).toBe("viewItemTitleWithField");
    });

    it("should return title without WithField when cipher has no username", () => {
      featureFlag$.next(true);
      autoFillCiphers$.next([]);
      fixture.detectChanges();

      const cipherWithoutUsername = {
        ...mockCipher,
        login: { ...mockCipher.login, username: null },
      } as PopupCipherViewLike;

      const result = component.cipherItemTitleKey(cipherWithoutUsername);

      expect(result).toBe("viewItemTitle");
    });
  });
});
