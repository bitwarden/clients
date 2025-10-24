import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import {
  AutofillConfirmationDialogComponent,
  AutofillConfirmationDialogResult,
} from "../autofill-confirmation-dialog/autofill-confirmation-dialog.component";

import { ItemMoreOptionsComponent } from "./item-more-options.component";

describe("ItemMoreOptionsComponent", () => {
  let fixture: ComponentFixture<ItemMoreOptionsComponent>;
  let component: ItemMoreOptionsComponent;

  const dialogService = {
    openSimpleDialog: jest.fn().mockResolvedValue(true),
    open: jest.fn(),
  };

  const configService = { getFeatureFlag$: jest.fn() };
  const cipherService = {
    getFullCipherView: jest.fn(),
    encrypt: jest.fn(),
    updateWithServer: jest.fn(),
    softDeleteWithServer: jest.fn(),
  };
  const autofillSvc = {
    doAutofill: jest.fn(),
    doAutofillAndSave: jest.fn(),
    currentAutofillTab$: new BehaviorSubject<{ url?: string | null } | null>(null),
    autofillAllowed$: new BehaviorSubject<boolean>(true),
  };

  const featureFlag$ = new BehaviorSubject<boolean>(true);
  configService.getFeatureFlag$.mockImplementation(() => featureFlag$.asObservable());

  const baseCipher = {
    id: "cipher-1",
    login: {
      uris: [
        { uri: "https://one.example.com" },
        { uri: "" },
        { uri: undefined as unknown as string },
        { uri: "https://two.example.com/a" },
      ],
      username: "user",
    },
    favorite: false,
    reprompt: 0,
    type: CipherType.Login,
    viewPassword: true,
    edit: true,
  } as any;

  beforeEach(waitForAsync(async () => {
    jest.clearAllMocks();

    cipherService.getFullCipherView.mockImplementation(async (c) => ({ ...baseCipher, ...c }));

    await TestBed.configureTestingModule({
      imports: [ItemMoreOptionsComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogService, useValue: dialogService },
        { provide: ConfigService, useValue: configService },
        { provide: CipherService, useValue: cipherService },
        { provide: VaultPopupAutofillService, useValue: autofillSvc },

        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "UserId" }) } },
        { provide: OrganizationService, useValue: { hasOrganizations: () => of(false) } },
        {
          provide: CipherAuthorizationService,
          useValue: { canDeleteCipher$: () => of(true), canCloneCipher$: () => of(true) },
        },
        { provide: CollectionService, useValue: { decryptedCollections$: () => of([]) } },
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        { provide: CipherArchiveService, useValue: { userCanArchive$: () => of(true) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: PasswordRepromptService, useValue: mock<PasswordRepromptService>() },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemMoreOptionsComponent);
    component = fixture.componentInstance;
    component.cipher = baseCipher;
  }));

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockConfirmDialogResult(result: string) {
    const openSpy = jest
      .spyOn(AutofillConfirmationDialogComponent, "open")
      .mockReturnValue({ closed: of(result) } as any);
    return openSpy;
  }

  it("calls doAutofill without showing the confirmation dialog when the feature flag is disabled", async () => {
    featureFlag$.next(false);
    autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });

    await component.doAutofill();

    expect(cipherService.getFullCipherView).toHaveBeenCalled();
    expect(autofillSvc.doAutofill).toHaveBeenCalledTimes(1);
    expect(autofillSvc.doAutofill).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cipher-1" }),
      false,
    );
    expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("opens the confirmation dialog with filtered saved URLs when the feature flag is enabled", async () => {
    featureFlag$.next(true);
    autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com/path" });
    const openSpy = mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);

    await component.doAutofill();

    expect(openSpy).toHaveBeenCalledTimes(1);
    const args = openSpy.mock.calls[0][1];
    expect(args.data.currentUrl).toBe("https://page.example.com/path");
    expect(args.data.savedUrls).toEqual(["https://one.example.com", "https://two.example.com/a"]);
  });

  it("does nothing when the user cancels the autofill confirmation dialog", async () => {
    featureFlag$.next(true);
    autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
    mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);

    await component.doAutofill();

    expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
    expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
  });

  it("autofills the item without adding the URL when the user selects 'AutofilledOnly'", async () => {
    featureFlag$.next(true);
    autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
    mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofilledOnly);

    await component.doAutofill();

    expect(autofillSvc.doAutofill).toHaveBeenCalledTimes(1);
    expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
  });

  it("autofills the item and adds the URL when the user selects 'AutofillAndUrlAdded'", async () => {
    featureFlag$.next(true);
    autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
    mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofillAndUrlAdded);

    await component.doAutofill();

    expect(autofillSvc.doAutofillAndSave).toHaveBeenCalledTimes(1);
    expect(autofillSvc.doAutofillAndSave.mock.calls[0][1]).toBe(false);
    expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
  });
});
