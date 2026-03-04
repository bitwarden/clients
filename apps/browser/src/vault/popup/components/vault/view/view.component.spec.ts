import { ComponentFixture, fakeAsync, flush, TestBed, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AUTOFILL_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
} from "@bitwarden/common/autofill/constants";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventType } from "@bitwarden/common/enums";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  ArchiveCipherUtilitiesService,
  CopyCipherFieldService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";
import { VaultPopupAfterDeletionNavigationService } from "../../../services/vault-popup-after-deletion-navigation.service";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import {
  AutofillConfirmationDialogComponent,
  AutofillConfirmationDialogResult,
} from "../autofill-confirmation-dialog/autofill-confirmation-dialog.component";

import { ViewComponent } from "./view.component";

// 'qrcode-parser' is used by `BrowserTotpCaptureService` but is an es6 module that jest can't compile.
// Mock the entire module here to prevent jest from throwing an error. I wasn't able to find a way to mock the
// `BrowserTotpCaptureService` where jest would not load the file in the first place.
jest.mock("qrcode-parser", () => {});

describe("ViewComponent", () => {
  let component: ViewComponent;
  let fixture: ComponentFixture<ViewComponent>;
  const params$ = new Subject();
  const mockNavigate = jest.fn();
  const collect = jest.fn().mockResolvedValue(null);
  const doAutofill = jest.fn().mockResolvedValue(true);
  const doAutofillAndSave = jest.fn().mockResolvedValue(true);
  const copy = jest.fn().mockResolvedValue(true);
  const back = jest.fn().mockResolvedValue(null);
  const openSimpleDialog = jest.fn().mockResolvedValue(true);
  const navigateAfterDeletion = jest.fn().mockResolvedValue(undefined);
  const showToast = jest.fn();
  const showPasswordPrompt = jest.fn().mockResolvedValue(true);
  const getFeatureFlag$ = jest.fn().mockReturnValue(of(true));
  const getFeatureFlag = jest.fn().mockResolvedValue(true);
  const currentAutofillTab$ = of({ url: "https://example.com", id: 1 });

  const mockCipher = {
    id: "122-333-444",
    type: CipherType.Login,
    orgId: "222-444-555",
    login: {
      username: "test-username",
      password: "test-password",
      totp: "123",
      uris: ["https://example.com"],
    },
    permissions: {},
    card: {},
  } as unknown as CipherView;

  const mockPasswordRepromptService = {
    showPasswordPrompt,
  };
  const autofillAllowed$ = new BehaviorSubject<boolean>(true);
  const mockVaultPopupAutofillService = {
    doAutofill,
    doAutofillAndSave,
    currentAutofillTab$,
    autofillAllowed$,
  };
  const mockCopyCipherFieldService = {
    copy,
  };
  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  const mockCipherService = {
    cipherViews$: jest.fn().mockImplementation((userId) => of([mockCipher])),
    getKeyForCipherKeyDecryption: jest.fn().mockResolvedValue({}),
    deleteWithServer: jest.fn().mockResolvedValue(undefined),
    softDeleteWithServer: jest.fn().mockResolvedValue(undefined),
  };

  const cipherArchiveService = mock<CipherArchiveService>();

  beforeEach(async () => {
    mockCipherService.cipherViews$.mockClear();
    mockCipherService.deleteWithServer.mockClear();
    mockCipherService.softDeleteWithServer.mockClear();
    mockNavigate.mockClear();
    collect.mockClear();
    doAutofill.mockClear();
    doAutofillAndSave.mockClear();
    copy.mockClear();
    navigateAfterDeletion.mockClear();
    openSimpleDialog.mockClear();
    back.mockClear();
    showToast.mockClear();
    showPasswordPrompt.mockClear();
    getFeatureFlag.mockClear();
    autofillAllowed$.next(true);
    cipherArchiveService.hasArchiveFlagEnabled$ = of(true);
    cipherArchiveService.userCanArchive$.mockReturnValue(of(false));
    cipherArchiveService.archiveWithServer.mockResolvedValue({ id: "122-333-444" } as CipherData);
    cipherArchiveService.unarchiveWithServer.mockResolvedValue({ id: "122-333-444" } as CipherData);

    await TestBed.configureTestingModule({
      imports: [ViewComponent],
      providers: [
        { provide: Router, useValue: { navigate: mockNavigate } },
        { provide: CipherService, useValue: mockCipherService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>({ back }) },
        { provide: ActivatedRoute, useValue: { queryParams: params$ } },
        { provide: EventCollectionService, useValue: { collect } },
        {
          provide: VaultPopupAfterDeletionNavigationService,
          useValue: { navigateAfterDeletion },
        },
        { provide: VaultPopupAutofillService, useValue: mockVaultPopupAutofillService },
        { provide: ToastService, useValue: { showToast } },
        { provide: ConfigService, useValue: { getFeatureFlag$, getFeatureFlag } },
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...rest: string[]) => {
              if (rest?.length) {
                return `${key} ${rest.join(" ")}`;
              }
              return key;
            },
          },
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: CipherAuthorizationService,
          useValue: {
            canDeleteCipher$: jest.fn().mockReturnValue(of(true)),
          },
        },
        {
          provide: CopyCipherFieldService,
          useValue: mockCopyCipherFieldService,
        },
        {
          provide: PasswordRepromptService,
          useValue: mockPasswordRepromptService,
        },
        {
          provide: CipherArchiveService,
          useValue: cipherArchiveService,
        },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>(),
        },
        {
          provide: CollectionService,
          useValue: mock<CollectionService>(),
        },
        {
          provide: FolderService,
          useValue: mock<FolderService>(),
        },
        {
          provide: TaskService,
          useValue: mock<TaskService>(),
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({
              getIconsUrl: () => "https://example.com",
            }),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: {
            showFavicons$: of(true),
            resolvedDefaultUriMatchStrategy$: of(UriMatchStrategy.Domain),
            getUrlEquivalentDomains: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: {
            hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
          },
        },
        {
          provide: ArchiveCipherUtilitiesService,
          useValue: {
            archiveCipher: jest.fn().mockResolvedValue(null),
            unarchiveCipher: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CipherRiskService,
          useValue: mock<CipherRiskService>(),
        },
      ],
    })
      .overrideProvider(DialogService, {
        useValue: {
          openSimpleDialog,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    (component as any).showFooter$ = of(true);
  });

  describe("queryParams", () => {
    it("loads an existing cipher", fakeAsync(() => {
      params$.next({ cipherId: "122-333-444" });

      flush(); // Resolve all promises

      expect(mockCipherService.cipherViews$).toHaveBeenCalledWith(mockUserId);
      expect(component.cipher).toEqual(mockCipher);
    }));

    it("sets the correct header text", fakeAsync(() => {
      // Set header text for a login
      mockCipher.type = CipherType.Login;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderLogin");

      // Set header text for a card
      mockCipher.type = CipherType.Card;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderCard");

      // Set header text for an identity
      mockCipher.type = CipherType.Identity;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderIdentity");

      // Set header text for a secure note
      mockCipher.type = CipherType.SecureNote;
      params$.next({ cipherId: mockCipher.id });
      flush(); // Resolve all promises

      expect(component.headerText).toEqual("viewItemHeaderNote");
    }));

    it("sends viewed event", fakeAsync(() => {
      params$.next({ cipherId: "122-333-444" });

      flush(); // Resolve all promises

      expect(collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientViewed,
        mockCipher.id,
        false,
        undefined,
      );
    }));

    it('invokes `doAutofill` when action="AUTOFILL_ID"', fakeAsync(() => {
      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(doAutofill).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-username"', fakeAsync(() => {
      params$.next({ action: COPY_USERNAME_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-password"', fakeAsync(() => {
      params$.next({ action: COPY_PASSWORD_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it('invokes `copy` when action="copy-totp"', fakeAsync(() => {
      params$.next({ action: COPY_VERIFICATION_CODE_ID, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(copy).toHaveBeenCalledTimes(1);
    }));

    it("does not set the cipher until reprompt is complete", fakeAsync(() => {
      let promptPromise: (val?: unknown) => void;
      mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
        of([
          {
            ...mockCipher,
            reprompt: CipherRepromptType.Password,
          },
        ]),
      );
      doAutofill.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          // store the promise resolver to manually trigger the promise resolve
          promptPromise = resolve;
        });
      });

      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Flush all pending actions

      expect(component.cipher).toBeUndefined();
      expect(doAutofill).toHaveBeenCalled();

      promptPromise!(true); // resolve the password prompt

      flush();
      expect(component.cipher).toEqual({ ...mockCipher, reprompt: CipherRepromptType.Password });
    }));

    it("does not set the cipher at all if doAutofill fails and reprompt is active", fakeAsync(() => {
      let promptPromise: (val?: unknown) => void;
      mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
        of([
          {
            ...mockCipher,
            reprompt: CipherRepromptType.Password,
          },
        ]),
      );
      doAutofill.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          // store the promise resolver to manually trigger the promise resolve
          promptPromise = resolve;
        });
      });

      params$.next({ action: AUTOFILL_ID, cipherId: mockCipher.id });

      flush(); // Flush all pending actions

      expect(component.cipher).toBeUndefined();
      expect(doAutofill).toHaveBeenCalled();

      promptPromise!(false); // resolve the password prompt

      flush();
      expect(component.cipher).toBeUndefined();
    }));

    it.each([COPY_PASSWORD_ID, COPY_VERIFICATION_CODE_ID])(
      "does not set cipher when copy fails for %s",
      fakeAsync((action: string) => {
        let promptPromise: (val?: unknown) => void;
        mockCipherService.cipherViews$.mockImplementationOnce((userId) =>
          of([
            {
              ...mockCipher,
              reprompt: CipherRepromptType.Password,
            },
          ]),
        );
        copy.mockImplementationOnce(() => {
          return new Promise((resolve) => {
            // store the promise resolver to manually trigger the promise resolve
            promptPromise = resolve;
          });
        });

        params$.next({ action, cipherId: mockCipher.id });

        flush(); // Flush all pending actions

        expect(component.cipher).toBeUndefined();
        expect(copy).toHaveBeenCalled();

        promptPromise!(false); // resolve the password prompt

        flush();
        expect(component.cipher).toBeUndefined();
      }),
    );

    it("closes the popout after a load action", fakeAsync(() => {
      jest.spyOn(BrowserPopupUtils, "inPopout").mockReturnValueOnce(true);
      jest.spyOn(BrowserPopupUtils, "inSingleActionPopout").mockReturnValueOnce(true);
      const closeSpy = jest.spyOn(BrowserPopupUtils, "closeSingleActionPopout");
      const focusSpy = jest
        .spyOn(BrowserApi, "focusTab")
        .mockImplementation(() => Promise.resolve());

      params$.next({ action: AUTOFILL_ID, senderTabId: 99, cipherId: mockCipher.id });

      flush(); // Resolve all promises

      expect(doAutofill).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalledWith(99);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    }));
  });

  describe("archive button", () => {
    it("shows the archive button when the user can archive and the cipher can be archived", fakeAsync(() => {
      jest.spyOn(component["archiveService"], "userCanArchive$").mockReturnValueOnce(of(true));
      component.cipher = { ...mockCipher, canBeArchived: true } as CipherView;
      tick();
      fixture.detectChanges();

      const archiveBtn = fixture.debugElement.query(By.css("button[biticonbutton='bwi-archive']"));
      expect(archiveBtn).toBeTruthy();
    }));

    it("does not show the archive button when the user cannot archive", fakeAsync(() => {
      jest.spyOn(component["archiveService"], "userCanArchive$").mockReturnValueOnce(of(false));
      component.cipher = { ...mockCipher, canBeArchived: true, isDeleted: false } as CipherView;

      tick();
      fixture.detectChanges();

      const archiveBtn = fixture.debugElement.query(By.css("button[biticonbutton='bwi-archive']"));
      expect(archiveBtn).toBeFalsy();
    }));

    it("does not show the archive button when the cipher cannot be archived", fakeAsync(() => {
      jest.spyOn(component["archiveService"], "userCanArchive$").mockReturnValueOnce(of(true));
      component.cipher = { ...mockCipher, archivedDate: new Date(), edit: true } as CipherView;

      tick();
      fixture.detectChanges();

      const archiveBtn = fixture.debugElement.query(By.css("button[biticonbutton='bwi-archive']"));
      expect(archiveBtn).toBeFalsy();
    }));
  });

  describe("unarchive button", () => {
    it("shows the unarchive button when the cipher is archived", fakeAsync(() => {
      component.cipher = { ...mockCipher, isArchived: true, isDeleted: false } as CipherView;

      tick();
      fixture.detectChanges();

      const unarchiveBtn = fixture.debugElement.query(
        By.css("button[biticonbutton='bwi-unarchive']"),
      );
      expect(unarchiveBtn).toBeTruthy();
    }));

    it("does not show the unarchive button when the cipher is not archived", fakeAsync(() => {
      component.cipher = { ...mockCipher, archivedDate: undefined } as CipherView;

      tick();
      fixture.detectChanges();

      const unarchiveBtn = fixture.debugElement.query(
        By.css("button[biticonbutton='bwi-unarchive']"),
      );
      expect(unarchiveBtn).toBeFalsy();
    }));

    it("does not show the unarchive button when the cipher is deleted", fakeAsync(() => {
      component.cipher = { ...mockCipher, isArchived: true, isDeleted: true } as CipherView;

      tick();
      fixture.detectChanges();

      const unarchiveBtn = fixture.debugElement.query(
        By.css("button[biticonbutton='bwi-unarchive']"),
      );
      expect(unarchiveBtn).toBeFalsy();
    }));
  });

  describe("archive", () => {
    beforeEach(() => {
      component.cipher = { ...mockCipher, canBeArchived: true } as CipherView;
    });

    it("calls archive service to archive the cipher", async () => {
      await component.archive();

      expect(component["archiveCipherUtilsService"].archiveCipher).toHaveBeenCalledWith(
        expect.objectContaining({ id: "122-333-444" }),
        true,
      );
    });
  });

  describe("unarchive", () => {
    it("calls archive service to unarchive the cipher", async () => {
      component.cipher = { ...mockCipher, isArchived: true } as CipherView;

      await component.unarchive();

      expect(component["archiveCipherUtilsService"].unarchiveCipher).toHaveBeenCalledWith(
        expect.objectContaining({ id: "122-333-444" }),
      );
    });
  });

  describe("delete", () => {
    beforeEach(() => {
      component.cipher = mockCipher;
    });

    it("opens confirmation modal", async () => {
      await component.delete();

      expect(openSimpleDialog).toHaveBeenCalledTimes(1);
    });

    it("navigates after deletion", async () => {
      await component.delete();

      expect(navigateAfterDeletion).toHaveBeenCalledTimes(1);
    });

    describe("deny confirmation", () => {
      beforeEach(() => {
        openSimpleDialog.mockResolvedValue(false);
      });

      it("does not delete the cipher", async () => {
        await component.delete();

        expect(mockCipherService.deleteWithServer).not.toHaveBeenCalled();
        expect(mockCipherService.softDeleteWithServer).not.toHaveBeenCalled();
      });

      it("does not interact with side effects", () => {
        expect(navigateAfterDeletion).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
      });
    });

    describe("accept confirmation", () => {
      beforeEach(() => {
        openSimpleDialog.mockResolvedValue(true);
      });

      describe("soft delete", () => {
        beforeEach(() => {
          (mockCipher as any).isDeleted = null;
        });

        it("opens confirmation dialog", async () => {
          await component.delete();

          expect(openSimpleDialog).toHaveBeenCalledTimes(1);
          expect(openSimpleDialog).toHaveBeenCalledWith({
            content: {
              key: "deleteItemConfirmation",
            },
            title: {
              key: "deleteItem",
            },
            type: "warning",
          });
        });

        it("calls soft delete", async () => {
          await component.delete();

          expect(mockCipherService.softDeleteWithServer).toHaveBeenCalled();
          expect(mockCipherService.deleteWithServer).not.toHaveBeenCalled();
        });

        it("shows toast", async () => {
          await component.delete();

          expect(showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: "deletedItem",
          });
        });
      });

      describe("hard delete", () => {
        beforeEach(() => {
          (mockCipher as any).isDeleted = true;
        });

        it("opens confirmation dialog", async () => {
          await component.delete();

          expect(openSimpleDialog).toHaveBeenCalledTimes(1);
          expect(openSimpleDialog).toHaveBeenCalledWith({
            content: {
              key: "permanentlyDeleteItemConfirmation",
            },
            title: {
              key: "deleteItem",
            },
            type: "warning",
          });
        });

        it("calls soft delete", async () => {
          await component.delete();

          expect(mockCipherService.deleteWithServer).toHaveBeenCalled();
          expect(mockCipherService.softDeleteWithServer).not.toHaveBeenCalled();
        });

        it("shows toast", async () => {
          await component.delete();

          expect(showToast).toHaveBeenCalledWith({
            variant: "success",
            title: null,
            message: "permanentlyDeletedItem",
          });
        });
      });
    });
  });

  describe("archived badge", () => {
    it("shows archived badge if the cipher is archived", fakeAsync(() => {
      component.cipher = { ...mockCipher, isArchived: true } as CipherView;
      mockCipherService.cipherViews$.mockImplementationOnce(() =>
        of([
          {
            ...mockCipher,
            isArchived: true,
          },
        ]),
      );

      params$.next({ action: "view", cipherId: mockCipher.id });

      flush();

      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector("span[bitBadge]");
      expect(badge).toBeTruthy();
    }));

    it("does not show archived badge if the cipher is not archived", () => {
      component.cipher = { ...mockCipher, isArchived: false } as CipherView;
      mockCipherService.cipherViews$.mockImplementationOnce(() =>
        of([
          {
            ...mockCipher,
            archivedDate: new Date(),
          },
        ]),
      );

      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector("span[bitBadge]");
      expect(badge).toBeFalsy();
    });
  });

  describe("showAutofillButton", () => {
    beforeEach(() => {
      component.cipher = { ...mockCipher, type: CipherType.Login } as CipherView;
    });

    it("returns true when feature flag is enabled, cipher is a login, and not archived/deleted", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(true);
    }));

    it("returns true for Card type when conditions are met", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Card,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(true);
    }));

    it("returns true for Identity type when conditions are met", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Identity,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(true);
    }));

    it("returns false when feature flag is disabled", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(false));

      // Recreate component to pick up the new feature flag value
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));

    it("returns false when autofill is not allowed", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(false);

      // Recreate component to pick up the new autofillAllowed value
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));

    it("returns false for SecureNote type", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.SecureNote,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));

    it("returns false for SshKey type", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.SshKey,
        isArchived: false,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));

    it("returns false when cipher is archived", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        isArchived: true,
        isDeleted: false,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));

    it("returns false when cipher is deleted", fakeAsync(() => {
      getFeatureFlag$.mockReturnValue(of(true));
      autofillAllowed$.next(true);

      // Recreate component to pick up the signal values
      fixture = TestBed.createComponent(ViewComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        isArchived: false,
        isDeleted: true,
      } as CipherView;

      flush();

      const result = component.showAutofillButton();

      expect(result).toBe(false);
    }));
  });

  describe("doAutofill", () => {
    let dialogService: DialogService;
    const originalCurrentAutofillTab$ = currentAutofillTab$;

    beforeEach(() => {
      dialogService = TestBed.inject(DialogService);

      component.cipher = {
        ...mockCipher,
        type: CipherType.Login,
        login: {
          username: "test",
          password: "test",
          uris: [
            {
              uri: "https://example.com",
              match: null,
            } as LoginUriView,
          ],
        },
        edit: true,
      } as CipherView;
    });

    afterEach(() => {
      // Restore original observable to prevent test pollution
      mockVaultPopupAutofillService.currentAutofillTab$ = originalCurrentAutofillTab$;
    });

    it("returns early when feature flag is disabled", async () => {
      getFeatureFlag.mockResolvedValue(false);

      await component.doAutofill();

      expect(doAutofill).not.toHaveBeenCalled();
      expect(openSimpleDialog).not.toHaveBeenCalled();
    });

    it("shows exact match dialog when no URIs and default strategy is Exact", async () => {
      getFeatureFlag.mockResolvedValue(true);
      component.cipher.login.uris = [];
      (component as any).uriMatchStrategy$ = of(UriMatchStrategy.Exact);

      await component.doAutofill();

      expect(openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "cannotAutofill" },
        content: { key: "cannotAutofillExactMatch" },
        type: "info",
        acceptButtonText: { key: "okay" },
        cancelButtonText: null,
      });
      expect(doAutofill).not.toHaveBeenCalled();
    });

    it("shows exact match dialog when all URIs have exact match strategy", async () => {
      getFeatureFlag.mockResolvedValue(true);
      component.cipher.login.uris = [
        { uri: "https://example.com", match: UriMatchStrategy.Exact } as LoginUriView,
        { uri: "https://example2.com", match: UriMatchStrategy.Exact } as LoginUriView,
      ];

      await component.doAutofill();

      expect(openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "cannotAutofill" },
        content: { key: "cannotAutofillExactMatch" },
        type: "info",
        acceptButtonText: { key: "okay" },
        cancelButtonText: null,
      });
      expect(doAutofill).not.toHaveBeenCalled();
    });

    it("shows error dialog when current tab URL is unavailable", async () => {
      getFeatureFlag.mockResolvedValue(true);
      mockVaultPopupAutofillService.currentAutofillTab$ = of({ url: null, id: 1 });

      await component.doAutofill();

      expect(openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "error" },
        content: { key: "errorGettingAutoFillData" },
        type: "danger",
      });
      expect(doAutofill).not.toHaveBeenCalled();
    });

    it("autofills directly when domain matches", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(true);

      await component.doAutofill();

      expect(doAutofill).toHaveBeenCalledWith(component.cipher, true, true);
    });

    it("shows confirmation dialog when domain does not match", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.Canceled),
      };
      jest.spyOn(AutofillConfirmationDialogComponent, "open").mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(AutofillConfirmationDialogComponent.open).toHaveBeenCalledWith(dialogService, {
        data: {
          currentUrl: "https://example.com",
          savedUrls: ["https://example.com"],
          viewOnly: false,
        },
      });
    });

    it("does not autofill when user cancels confirmation dialog", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.Canceled),
      };
      jest.spyOn(AutofillConfirmationDialogComponent, "open").mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(doAutofill).not.toHaveBeenCalled();
      expect(doAutofillAndSave).not.toHaveBeenCalled();
    });

    it("autofills only when user selects AutofilledOnly", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.AutofilledOnly),
      };
      jest.spyOn(AutofillConfirmationDialogComponent, "open").mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(doAutofill).toHaveBeenCalledWith(component.cipher, true, true);
      expect(doAutofillAndSave).not.toHaveBeenCalled();
    });

    it("autofills and saves URL when user selects AutofillAndUrlAdded", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.AutofillAndUrlAdded),
      };
      jest.spyOn(AutofillConfirmationDialogComponent, "open").mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(doAutofillAndSave).toHaveBeenCalledWith(component.cipher, true, true);
      expect(doAutofill).not.toHaveBeenCalled();
    });

    it("passes viewOnly as true when cipher is not editable", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);
      component.cipher.edit = false;

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.Canceled),
      };
      const openSpy = jest
        .spyOn(AutofillConfirmationDialogComponent, "open")
        .mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(openSpy).toHaveBeenCalledWith(dialogService, {
        data: {
          currentUrl: "https://example.com",
          savedUrls: ["https://example.com"],
          viewOnly: true,
        },
      });
    });

    it("filters out URIs without uri property", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);
      component.cipher.login.uris = [
        { uri: "https://example.com" } as LoginUriView,
        { uri: null } as LoginUriView,
        { uri: "https://example2.com" } as LoginUriView,
      ];

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.Canceled),
      };
      const openSpy = jest
        .spyOn(AutofillConfirmationDialogComponent, "open")
        .mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(openSpy).toHaveBeenCalledWith(dialogService, {
        data: {
          currentUrl: "https://example.com",
          savedUrls: ["https://example.com", "https://example2.com"],
          viewOnly: false,
        },
      });
    });

    it("handles cipher with no login uris gracefully", async () => {
      getFeatureFlag.mockResolvedValue(true);
      jest.spyOn(component as any, "_domainMatched").mockResolvedValue(false);
      component.cipher.login.uris = null;

      const mockDialogRef = {
        closed: of(AutofillConfirmationDialogResult.Canceled),
      };
      const openSpy = jest
        .spyOn(AutofillConfirmationDialogComponent, "open")
        .mockReturnValue(mockDialogRef as any);

      await component.doAutofill();

      expect(openSpy).toHaveBeenCalledWith(dialogService, {
        data: {
          currentUrl: "https://example.com",
          savedUrls: [],
          viewOnly: false,
        },
      });
    });
  });
});
