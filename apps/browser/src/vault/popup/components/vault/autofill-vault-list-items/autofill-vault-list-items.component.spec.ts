import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CompactModeService, DialogService, ToastService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { PasswordRepromptService } from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
import { SimplifiedAutofillInfoComponent } from "../simplified-autofill-info/simplified-autofill-info.component";

import { AutofillVaultListItemsComponent } from "./autofill-vault-list-items.component";

describe("AutofillVaultListItemsComponent", () => {
  let fixture: ComponentFixture<AutofillVaultListItemsComponent>;

  const autoFillCiphers$ = new BehaviorSubject<PopupCipherViewLike[]>([]);
  const hasFilterApplied$ = new BehaviorSubject<boolean>(false);
  const autofillAllowed$ = new BehaviorSubject<boolean>(true);
  const currentTabIsOnBlocklist$ = new BehaviorSubject<boolean>(false);
  const clickItemsToAutofillVaultView$ = new BehaviorSubject<boolean>(true);

  beforeEach(async () => {
    // Mock getAnimations for all span elements before any components are created
    if (!HTMLSpanElement.prototype.getAnimations) {
      HTMLSpanElement.prototype.getAnimations = jest.fn().mockReturnValue([]);
    }

    jest.spyOn(BrowserPopupUtils, "inSidebar").mockReturnValue(false);
    jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [AutofillVaultListItemsComponent],
      providers: [
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: GlobalStateProvider, useValue: mock<GlobalStateProvider>() },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "acct-id" }) },
        },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: CompactModeService, useValue: { enabled$: new BehaviorSubject(false) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => new BehaviorSubject(true) } },
        {
          provide: StateProvider,
          useValue: {
            getUserState$: jest.fn().mockReturnValue(of(null)),
            getUser: jest.fn().mockReturnValue({ update: jest.fn().mockResolvedValue(undefined) }),
            getGlobal: jest.fn().mockReturnValue({
              update: jest.fn().mockResolvedValue(undefined),
              state$: new BehaviorSubject(undefined),
            }),
          },
        },
        {
          provide: VaultPopupItemsService,
          useValue: { autoFillCiphers$, hasFilterApplied$ },
        },
        {
          provide: VaultPopupAutofillService,
          useValue: {
            autofillAllowed$,
            currentTabIsOnBlocklist$,
            refreshCurrentTab: jest.fn(),
            currentAutofillTab$: of(null),
          },
        },
        {
          provide: VaultSettingsService,
          useValue: { clickItemsToAutofillVaultView$ },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AutofillVaultListItemsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe("app-simplified-autofill-info visibility", () => {
    it("is not rendered when the ciphers list is empty", async () => {
      autoFillCiphers$.next([]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.debugElement.query(By.directive(SimplifiedAutofillInfoComponent))).toBeNull();
    });

    it("is rendered when ciphers are present", async () => {
      autoFillCiphers$.next([{ type: CipherType.Login } as PopupCipherViewLike]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        fixture.debugElement.query(By.directive(SimplifiedAutofillInfoComponent)),
      ).not.toBeNull();
    });
  });
});
