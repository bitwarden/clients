import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { PopupRouterCacheService } from "@bitwarden/browser/platform/popup/view-cache/popup-router-cache.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { PasswordRepromptService } from "@bitwarden/vault";

import { ArchiveComponent } from "./archive.component";

// 'qrcode-parser' is used by `BrowserTotpCaptureService` but is an es6 module that jest can't compile.
// Mock the entire module here to prevent jest from throwing an error. I wasn't able to find a way to mock the
// `BrowserTotpCaptureService` where jest would not load the file in the first place.
jest.mock("qrcode-parser", () => {});

describe("ArchiveComponent", () => {
  let component: ArchiveComponent;
  let fixture: ComponentFixture<ArchiveComponent>;

  let hasOrganizations: jest.Mock;
  let decryptedCollections$: jest.Mock;
  let navigate: jest.Mock;
  let showPasswordPrompt: jest.Mock;
  let userHasPremium$: jest.Mock;
  let archivedCiphers$: jest.Mock;

  beforeEach(async () => {
    navigate = jest.fn();
    showPasswordPrompt = jest.fn().mockResolvedValue(true);
    hasOrganizations = jest.fn().mockReturnValue(of(false));
    decryptedCollections$ = jest.fn().mockReturnValue(of([]));
    userHasPremium$ = jest.fn().mockReturnValue(of(false));
    archivedCiphers$ = jest.fn().mockReturnValue(of([{ id: "cipher-1" }]));

    await TestBed.configureTestingModule({
      imports: [ArchiveComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: { navigate } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-id" }) },
        },
        { provide: PasswordRepromptService, useValue: { showPasswordPrompt } },
        {
          provide: OrganizationService,
          useValue: { hasOrganizations, organizations$: () => of([]) },
        },
        { provide: CollectionService, useValue: { decryptedCollections$ } },
        { provide: CipherService, useValue: mock<CipherService>() },
        {
          provide: CipherArchiveService,
          useValue: {
            userHasPremium$,
            archivedCiphers$,
            userCanArchive$: jest.fn().mockReturnValue(of(true)),
            showSubscriptionEndedMessaging$: jest.fn().mockReturnValue(of(false)),
          },
        },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: PopupRouterCacheService, useValue: mock<PopupRouterCacheService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({
              getIconsUrl: () => "https://icons.example.com",
            }),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: {
            showFavicons$: of(true),
          },
        },
        {
          provide: CipherAuthorizationService,
          useValue: {
            canDeleteCipher$: jest.fn().mockReturnValue(of(true)),
          },
        },
      ],
    })
      .overrideProvider(DialogService, { useValue: mock<DialogService>() })
      .compileComponents();

    fixture = TestBed.createComponent(ArchiveComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canAssignCollections$", () => {
    it("emits true when user has organizations and editable collections", (done) => {
      hasOrganizations.mockReturnValue(of(true));
      decryptedCollections$.mockReturnValue(of([{ id: "col-1", readOnly: false }] as any));

      component["canAssignCollections$"].subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it("emits false when user has no organizations", (done) => {
      hasOrganizations.mockReturnValue(of(false));
      decryptedCollections$.mockReturnValue(of([{ id: "col-1", readOnly: false }] as any));

      component["canAssignCollections$"].subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });

    it("emits false when all collections are read-only", (done) => {
      hasOrganizations.mockReturnValue(of(true));
      decryptedCollections$.mockReturnValue(of([{ id: "col-1", readOnly: true }] as any));

      component["canAssignCollections$"].subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });
  });

  describe("conditionallyNavigateToAssignCollections", () => {
    const mockCipher = {
      id: "cipher-1",
      reprompt: 0,
    } as CipherViewLike;

    it("navigates to assign-collections when reprompt is not required", async () => {
      await component.conditionallyNavigateToAssignCollections(mockCipher);

      expect(navigate).toHaveBeenCalledWith(["/assign-collections"], {
        queryParams: { cipherId: "cipher-1" },
      });
    });

    it("prompts for password when reprompt is required", async () => {
      const cipherWithReprompt = { ...mockCipher, reprompt: 1 };

      await component.conditionallyNavigateToAssignCollections(
        cipherWithReprompt as CipherViewLike,
      );

      expect(showPasswordPrompt).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(["/assign-collections"], {
        queryParams: { cipherId: "cipher-1" },
      });
    });

    it("does not navigate when password prompt is cancelled", async () => {
      const cipherWithReprompt = { ...mockCipher, reprompt: 1 };
      showPasswordPrompt.mockResolvedValueOnce(false);

      await component.conditionallyNavigateToAssignCollections(
        cipherWithReprompt as CipherViewLike,
      );

      expect(showPasswordPrompt).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("clone menu option", () => {
    const getBitMenuPanel = () => document.querySelector(".bit-menu-panel");

    it("is shown when user has premium", async () => {
      userHasPremium$.mockReturnValue(of(true));

      const testFixture = TestBed.createComponent(ArchiveComponent);
      testFixture.detectChanges();
      await testFixture.whenStable();

      const menuTrigger = testFixture.debugElement.query(By.css('button[aria-haspopup="menu"]'));
      expect(menuTrigger).toBeTruthy();
      (menuTrigger.nativeElement as HTMLButtonElement).click();
      testFixture.detectChanges();

      const menuPanel = getBitMenuPanel();
      expect(menuPanel).toBeTruthy();

      const menuButtons = menuPanel?.querySelectorAll("button[bitMenuItem]");
      const cloneButtonFound = Array.from(menuButtons || []).some(
        (btn) => btn.textContent?.trim() === "clone",
      );

      expect(cloneButtonFound).toBe(true);
    });

    it("is not shown when user does not have premium", async () => {
      userHasPremium$.mockReturnValue(of(false));

      const testFixture = TestBed.createComponent(ArchiveComponent);
      testFixture.detectChanges();
      await testFixture.whenStable();

      const menuTrigger = testFixture.debugElement.query(By.css('button[aria-haspopup="menu"]'));
      expect(menuTrigger).toBeTruthy();
      (menuTrigger.nativeElement as HTMLButtonElement).click();
      testFixture.detectChanges();

      const menuPanel = getBitMenuPanel();
      expect(menuPanel).toBeTruthy();

      const menuButtons = menuPanel?.querySelectorAll("button[bitMenuItem]");
      const cloneButtonFound = Array.from(menuButtons || []).some(
        (btn) => btn.textContent?.trim() === "clone",
      );

      expect(cloneButtonFound).toBe(false);
    });
  });
});
