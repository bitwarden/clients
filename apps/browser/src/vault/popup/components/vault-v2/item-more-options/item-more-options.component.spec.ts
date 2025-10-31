import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
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
import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
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
  const featureFlag$ = new BehaviorSubject<boolean>(false);
  const configService = {
    getFeatureFlag$: jest.fn().mockImplementation(() => featureFlag$.asObservable()),
  };
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
    autofillAllowed$: new BehaviorSubject(true),
  };

  const passwordRepromptService = {
    passwordRepromptCheck: jest.fn().mockResolvedValue(true),
  };

  const uriMatchStrategy$ = new BehaviorSubject<UriMatchStrategySetting>(UriMatchStrategy.Domain);

  const domainSettingsService = {
    resolvedDefaultUriMatchStrategy$: uriMatchStrategy$.asObservable(),
  };

  const hasSearchText$ = new BehaviorSubject(false);
  const vaultPopupItemsService = {
    hasSearchText$: hasSearchText$.asObservable(),
  };

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

    TestBed.configureTestingModule({
      imports: [ItemMoreOptionsComponent, NoopAnimationsModule],
      providers: [
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
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        {
          provide: DomainSettingsService,
          useValue: domainSettingsService,
        },
        {
          provide: VaultPopupItemsService,
          useValue: vaultPopupItemsService,
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    TestBed.overrideProvider(DialogService, { useValue: dialogService });
    await TestBed.compileComponents();
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

  describe("doAutofill", () => {
    it("calls the autofill service to autofill without showing the confirmation dialog when the feature flag is disabled or search text is not present", async () => {
      autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });

      await component.doAutofill();

      expect(cipherService.getFullCipherView).toHaveBeenCalled();
      expect(autofillSvc.doAutofill).toHaveBeenCalledTimes(1);
      expect(autofillSvc.doAutofill).toHaveBeenCalledWith(
        expect.objectContaining({ id: "cipher-1" }),
        true,
        true,
      );
      expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("calls the passwordService to passwordRepromptCheck", async () => {
      autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
      mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofilledOnly);

      await component.doAutofill();

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalledWith(baseCipher);
    });

    it("does nothing if the user fails master password reprompt", async () => {
      baseCipher.reprompt = 2; // Master Password reprompt enabled
      autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false); // Reprompt fails
      mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofilledOnly);

      await component.doAutofill();

      expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
      expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
    });

    it("does not show the exact match dialog when the default match strategy is Exact and autofill confirmation is not to be shown", async () => {
      // autofill confirmation dialog is not shown when either the feature flag is disabled or search text is not present
      uriMatchStrategy$.next(UriMatchStrategy.Exact);
      autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com/path" });
      await component.doAutofill();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    describe("autofill confirmation dialog", () => {
      beforeEach(() => {
        // autofill confirmation dialog is shown when feature flag is enabled and search text is present
        featureFlag$.next(true);
        hasSearchText$.next(true);
        uriMatchStrategy$.next(UriMatchStrategy.Domain);
        passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
      });

      it("opens the autofill confirmation dialog with filtered saved URLs when the feature flag is enabled and search text is present", async () => {
        autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com/path" });
        const openSpy = mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);

        await component.doAutofill();

        expect(openSpy).toHaveBeenCalledTimes(1);
        const args = openSpy.mock.calls[0][1];
        expect(args.data.currentUrl).toBe("https://page.example.com/path");
        expect(args.data.savedUrls).toEqual([
          "https://one.example.com",
          "https://two.example.com/a",
        ]);
      });

      it("does nothing when the user cancels the autofill confirmation dialog", async () => {
        autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
        mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);

        await component.doAutofill();

        expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
        expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
      });

      it("calls the autofill service to autofill when the user selects 'AutofilledOnly'", async () => {
        autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
        mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofilledOnly);

        await component.doAutofill();

        expect(autofillSvc.doAutofill).toHaveBeenCalledWith(
          expect.objectContaining({ id: "cipher-1" }),
          true,
          true,
        );
        expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
      });

      it("calls the autofill service to doAutofillAndSave when the user selects 'AutofillAndUrlAdded'", async () => {
        autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
        mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofillAndUrlAdded);

        await component.doAutofill();

        expect(autofillSvc.doAutofillAndSave).toHaveBeenCalledWith(
          expect.objectContaining({ id: "cipher-1" }),
          false,
          true,
        );
        expect(autofillSvc.doAutofillAndSave.mock.calls[0][1]).toBe(false);
        expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
      });

      describe("URI match strategy handling", () => {
        describe("when the default URI match strategy is Exact", () => {
          beforeEach(() => {
            uriMatchStrategy$.next(UriMatchStrategy.Exact);
          });

          it("shows the exact match dialog and not the password dialog", async () => {
            autofillSvc.currentAutofillTab$.next({ url: "https://no-match.example.com" });

            await component.doAutofill();

            expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
            expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
              expect.objectContaining({
                title: expect.objectContaining({ key: "cannotAutofill" }),
                content: expect.objectContaining({ key: "cannotAutofillExactMatch" }),
                type: "info",
              }),
            );
            expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
            expect(passwordRepromptService.passwordRepromptCheck).not.toHaveBeenCalled();
            expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
          });
        });

        describe("when the default URI match strategy is not Exact", () => {
          beforeEach(() => {
            mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);
            uriMatchStrategy$.next(UriMatchStrategy.Domain);
          });
          it("does not show the exact match dialog", async () => {
            cipherService.getFullCipherView.mockImplementation(async (c) => ({
              ...baseCipher,
              ...c,
              login: {
                ...baseCipher.login,
                uris: [
                  { uri: "https://one.example.com", match: UriMatchStrategy.Exact },
                  { uri: "https://page.example.com", match: UriMatchStrategy.Domain },
                ],
              },
            }));

            autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });

            await component.doAutofill();

            expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
          });

          it("shows the exact match dialog when the cipher has a single uri with a match strategy of Exact", async () => {
            cipherService.getFullCipherView.mockImplementation(async (c) => ({
              ...baseCipher,
              ...c,
              login: {
                ...baseCipher.login,
                uris: [{ uri: "https://one.example.com", match: UriMatchStrategy.Exact }],
              },
            }));

            autofillSvc.currentAutofillTab$.next({ url: "https://no-match.example.com" });

            await component.doAutofill();

            expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
              expect.objectContaining({
                title: expect.objectContaining({ key: "cannotAutofill" }),
                content: expect.objectContaining({ key: "cannotAutofillExactMatch" }),
                type: "info",
              }),
            );
            expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
            expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
          });
        });

        it("does not show the exact match dialog when the cipher has no uris", async () => {
          mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);
          cipherService.getFullCipherView.mockImplementation(async (c) => ({
            ...baseCipher,
            ...c,
            login: {
              ...baseCipher.login,
              uris: [],
            },
          }));

          autofillSvc.currentAutofillTab$.next({ url: "https://no-match.example.com" });

          await component.doAutofill();

          expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        });

        it("does not show the exact match dialog when the cipher has a uri with a match strategy of Exact and a uri with a match strategy of Domain", async () => {
          mockConfirmDialogResult(AutofillConfirmationDialogResult.Canceled);
          cipherService.getFullCipherView.mockImplementation(async (c) => ({
            ...baseCipher,
            ...c,
            login: {
              ...baseCipher.login,
              uris: [
                { uri: "https://one.example.com", match: UriMatchStrategy.Exact },
                { uri: "https://page.example.com", match: UriMatchStrategy.Domain },
              ],
            },
          }));

          autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });

          await component.doAutofill();

          expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        });
      });

      it("hides the 'Fill and Save' button when showAutofillConfirmation$ is true", async () => {
        fixture.detectChanges();
        await fixture.whenStable();

        const fillAndSaveButton = fixture.nativeElement.querySelector(
          "button[bitMenuItem]:not([disabled])",
        );

        const buttonText = fillAndSaveButton?.textContent?.trim().toLowerCase() ?? "";
        expect(buttonText.includes("fillAndSave".toLowerCase())).toBe(false);
      });

      it("does nothing if the user fails master password reprompt", async () => {
        baseCipher.reprompt = 2; // Master Password reprompt enabled
        autofillSvc.currentAutofillTab$.next({ url: "https://page.example.com" });
        passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false); // Reprompt fails
        mockConfirmDialogResult(AutofillConfirmationDialogResult.AutofilledOnly);

        await component.doAutofill();

        expect(autofillSvc.doAutofill).not.toHaveBeenCalled();
        expect(autofillSvc.doAutofillAndSave).not.toHaveBeenCalled();
      });
    });
  });
});
