import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, input } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TaskService } from "@bitwarden/common/vault/tasks";

import { CIPHER_VIEW_BANNER } from "../tokens/cipher-view-banner.token";

import { CipherViewComponent } from "./cipher-view.component";

/** Stand-in for a host-provided banner; captures the inputs the slot passes through. */
@Component({
  selector: "test-cipher-view-banner",
  template: "<div data-testid='test-banner'></div>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestBannerComponent {
  readonly cipherId = input<string>();
  readonly partialData = input<string | undefined>();
  readonly leaseGated = input<boolean>();
}

describe("CipherViewComponent", () => {
  let component: CipherViewComponent;
  let fixture: ComponentFixture<CipherViewComponent>;

  // Mock services
  let mockAccountService: AccountService;
  let mockOrganizationService: OrganizationService;
  let mockCollectionService: CollectionService;
  let mockFolderService: FolderService;
  let mockTaskService: TaskService;
  let mockPlatformUtilsService: PlatformUtilsService;
  let mockChangeLoginPasswordService: ChangeLoginPasswordService;
  let mockCipherService: CipherService;
  let mockViewPasswordHistoryService: ViewPasswordHistoryService;
  let mockI18nService: I18nService;
  let mockLogService: LogService;
  let mockCipherRiskService: CipherRiskService;
  let mockBillingAccountProfileStateService: BillingAccountProfileStateService;
  let mockVaultSettingsService: VaultSettingsService;
  let showAtRiskPasswordNotifications$: BehaviorSubject<boolean>;
  let mockConfigService: ConfigService;
  let removeAtRiskCallout$: BehaviorSubject<boolean>;

  // Mock data
  let mockCipherView: CipherView;
  let hasPremiumFromAnySource$: BehaviorSubject<boolean>;
  let activeAccount$: BehaviorSubject<Account>;

  beforeEach(async () => {
    // Setup mock observables
    activeAccount$ = new BehaviorSubject({
      id: "test-user-id",
      email: "test@example.com",
    } as Account);

    hasPremiumFromAnySource$ = new BehaviorSubject(true);

    // Create service mocks
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = activeAccount$;

    mockOrganizationService = mock<OrganizationService>();
    mockCollectionService = mock<CollectionService>();
    mockFolderService = mock<FolderService>();
    mockTaskService = mock<TaskService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockChangeLoginPasswordService = mock<ChangeLoginPasswordService>();
    mockCipherService = mock<CipherService>();
    mockViewPasswordHistoryService = mock<ViewPasswordHistoryService>();
    mockI18nService = mock<I18nService>({
      t: (key: string) => key,
    });
    mockLogService = mock<LogService>();
    mockCipherRiskService = mock<CipherRiskService>();

    mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    mockBillingAccountProfileStateService.hasPremiumFromAnySource$ = jest
      .fn()
      .mockReturnValue(hasPremiumFromAnySource$);

    showAtRiskPasswordNotifications$ = new BehaviorSubject(true);
    mockVaultSettingsService = mock<VaultSettingsService>();
    mockVaultSettingsService.showAtRiskPasswordNotifications$ = showAtRiskPasswordNotifications$;

    removeAtRiskCallout$ = new BehaviorSubject(false);
    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$ = jest.fn().mockReturnValue(removeAtRiskCallout$);

    // Setup mock cipher view
    mockCipherView = new CipherView();
    mockCipherView.id = "cipher-id";
    mockCipherView.name = "Test Cipher";

    await TestBed.configureTestingModule({
      imports: [CipherViewComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: FolderService, useValue: mockFolderService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: ChangeLoginPasswordService, useValue: mockChangeLoginPasswordService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: ViewPasswordHistoryService, useValue: mockViewPasswordHistoryService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        { provide: CipherRiskService, useValue: mockCipherRiskService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: VaultSettingsService, useValue: mockVaultSettingsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Override the component template to avoid rendering child components
      // Allows testing component logic without
      // needing to provide dependencies for all child components.
      .overrideComponent(CipherViewComponent, {
        set: {
          template: "<div>{{ passwordIsAtRisk() }}</div>",
          imports: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CipherViewComponent);
    component = fixture.componentInstance;
  });

  describe("banner slot (CIPHER_VIEW_BANNER)", () => {
    const BANNER_TEMPLATE = /* HTML */ `
      @if (bannerComponent) {
      <ng-container
        *ngComponentOutlet="
            bannerComponent;
            inputs: {
              cipherId: cipher().id,
              partialData: cipher().partialData,
              leaseGated: cipher().leaseGated,
            }
          "
      />
      }
    `;

    async function setupBanner(provideBanner: boolean): Promise<void> {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [CipherViewComponent],
        providers: [
          { provide: AccountService, useValue: mockAccountService },
          { provide: OrganizationService, useValue: mockOrganizationService },
          { provide: CollectionService, useValue: mockCollectionService },
          { provide: FolderService, useValue: mockFolderService },
          { provide: TaskService, useValue: mockTaskService },
          { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
          { provide: ChangeLoginPasswordService, useValue: mockChangeLoginPasswordService },
          { provide: CipherService, useValue: mockCipherService },
          { provide: ViewPasswordHistoryService, useValue: mockViewPasswordHistoryService },
          { provide: I18nService, useValue: mockI18nService },
          { provide: LogService, useValue: mockLogService },
          { provide: CipherRiskService, useValue: mockCipherRiskService },
          {
            provide: BillingAccountProfileStateService,
            useValue: mockBillingAccountProfileStateService,
          },
          { provide: VaultSettingsService, useValue: mockVaultSettingsService },
          { provide: ConfigService, useValue: mockConfigService },
          ...(provideBanner
            ? [{ provide: CIPHER_VIEW_BANNER, useValue: TestBannerComponent }]
            : []),
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(CipherViewComponent, {
          set: { template: BANNER_TEMPLATE, imports: [CommonModule, TestBannerComponent] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(CipherViewComponent);
      component = fixture.componentInstance;
    }

    it("injects null and renders no banner when the host provides none", async () => {
      await setupBanner(false);
      fixture.componentRef.setInput("cipher", mockCipherView);
      fixture.detectChanges();

      expect(component["bannerComponent"]).toBeNull();
      expect(fixture.debugElement.query(By.directive(TestBannerComponent))).toBeNull();
    });

    it("renders the host banner with the cipher's id, partialData, and leaseGated", async () => {
      await setupBanner(true);
      const cipher = new CipherView();
      cipher.id = "cipher-id";
      cipher.partialData = "partial-blob";
      cipher.leaseGated = true;
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      expect(component["bannerComponent"]).toBe(TestBannerComponent);
      const banner = fixture.debugElement.query(By.directive(TestBannerComponent));
      expect(banner).not.toBeNull();
      const instance = banner.componentInstance as TestBannerComponent;
      expect(instance.cipherId()).toBe("cipher-id");
      expect(instance.partialData()).toBe("partial-blob");
      expect(instance.leaseGated()).toBe(true);
    });
  });

  describe("passwordIsAtRisk signal", () => {
    // Helper to create a cipher view with login credentials
    const createLoginCipherView = (): CipherView => {
      const cipher = new CipherView();
      cipher.id = "cipher-id";
      cipher.name = "Test Login";
      cipher.type = CipherType.Login;
      cipher.edit = true;
      cipher.organizationId = undefined;
      // Set up login with password so hasLoginPassword returns true
      cipher.login = { password: "test-password" } as any;
      return cipher;
    };

    beforeEach(() => {
      // Reset observables to default values for this test suite
      hasPremiumFromAnySource$.next(true);

      // Setup default mock for computeCipherRiskForUser (individual tests can override)
      mockCipherRiskService.computeCipherRiskForUser = jest.fn().mockResolvedValue({
        password_strength: 4,
        exposed_result: { type: "NotFound" },
        reuse_count: 1,
      });

      // Recreate the fixture for each test in this suite.
      // This ensures that the signal's observable subscribes with the correct
      // initial state
      fixture = TestBed.createComponent(CipherViewComponent);
      component = fixture.componentInstance;
    });

    it("returns false when cipher has no login password", fakeAsync(() => {
      const cipher = createLoginCipherView();
      cipher.login = {} as any; // No password

      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

    it("returns false when user does not have edit access", fakeAsync(() => {
      const cipher = createLoginCipherView();
      cipher.edit = false;

      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

    it("returns false when cipher is deleted", fakeAsync(() => {
      const cipher = createLoginCipherView();
      cipher.deletedDate = new Date();

      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

    it("returns false for organization-owned ciphers", fakeAsync(() => {
      const cipher = createLoginCipherView();
      cipher.organizationId = "org-id";

      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

    it("returns false when user is not premium", fakeAsync(() => {
      hasPremiumFromAnySource$.next(false);

      const cipher = createLoginCipherView();
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

    it("returns true when password is weak", fakeAsync(() => {
      // Setup mock to return weak password
      const mockRiskyResult = {
        password_strength: 2, // Weak password (< 3)
        exposed_result: { type: "NotFound" },
        reuse_count: 1,
      };
      mockCipherRiskService.computeCipherRiskForUser = jest.fn().mockResolvedValue(mockRiskyResult);

      const cipher = createLoginCipherView();
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      // Initial value should be false (from startWith(false))
      expect(component.passwordIsAtRisk()).toBe(false);

      // Wait for async operations to complete
      tick();
      fixture.detectChanges();

      // After async completes, should reflect the weak password
      expect(mockCipherRiskService.computeCipherRiskForUser).toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(true);
    }));

    it("returns false when password is strong and not exposed", fakeAsync(() => {
      // Setup mock to return safe password
      const mockSafeResult = {
        password_strength: 4, // Strong password
        exposed_result: { type: "NotFound" }, // Not exposed
        reuse_count: 1, // Not reused
      };
      mockCipherRiskService.computeCipherRiskForUser = jest.fn().mockResolvedValue(mockSafeResult);

      const cipher = createLoginCipherView();
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();

      // Initial value should be false
      expect(component.passwordIsAtRisk()).toBe(false);

      // Wait for async operations to complete
      tick();
      fixture.detectChanges();

      // Should remain false for safe password
      expect(mockCipherRiskService.computeCipherRiskForUser).toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));
  });

  describe("showChangePasswordLink", () => {
    // Helper: cipher with a login URI so hasLoginUri() returns true
    const createCipherWithUri = (): CipherView => {
      const cipher = new CipherView();
      cipher.id = "cipher-id";
      cipher.type = CipherType.Login;
      cipher.edit = true;
      cipher.login = {
        password: "pw",
        hasUris: true,
        uris: [{ uri: "https://example.com" } as any],
      } as any;
      return cipher;
    };

    beforeEach(() => {
      fixture = TestBed.createComponent(CipherViewComponent);
      component = fixture.componentInstance;
    });

    it("returns false when cipher has no login URI", fakeAsync(() => {
      const cipher = new CipherView();
      cipher.type = CipherType.Login;
      cipher.login = { hasUris: false, uris: [] } as any;
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(component.showChangePasswordLink()).toBe(false);
    }));

    it("returns true when cipher has URI and passwordIsAtRisk and notifications enabled", fakeAsync(() => {
      showAtRiskPasswordNotifications$.next(true);

      // Make passwordIsAtRisk return true via weak password risk result
      mockCipherRiskService.computeCipherRiskForUser = jest.fn().mockResolvedValue({
        password_strength: 1,
        exposed_result: { type: "NotFound" },
        reuse_count: 1,
      });

      const cipher = createCipherWithUri();
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      expect(component.showChangePasswordLink()).toBe(true);
    }));

    it("returns false when passwordIsAtRisk but notifications are disabled", fakeAsync(() => {
      showAtRiskPasswordNotifications$.next(false);

      mockCipherRiskService.computeCipherRiskForUser = jest.fn().mockResolvedValue({
        password_strength: 1,
        exposed_result: { type: "NotFound" },
        reuse_count: 1,
      });

      const cipher = createCipherWithUri();
      // No pending task so hadPendingChangePasswordTask stays false
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      expect(component.showChangePasswordLink()).toBe(false);
    }));
  });

  describe("removeAtRiskCallout signal", () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(CipherViewComponent);
      component = fixture.componentInstance;
    });

    it("returns false when feature flag is disabled", fakeAsync(() => {
      removeAtRiskCallout$.next(false);

      fixture.componentRef.setInput("cipher", mockCipherView);
      fixture.detectChanges();
      tick();

      expect(component.removeAtRiskCallout()).toBe(false);
    }));

    it("returns true when feature flag is enabled", fakeAsync(() => {
      removeAtRiskCallout$.next(true);

      fixture.componentRef.setInput("cipher", mockCipherView);
      fixture.detectChanges();
      tick();

      expect(component.removeAtRiskCallout()).toBe(true);
    }));

    it("calls getFeatureFlag$ with PM32016RemoveAtRiskCallout", () => {
      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.PM32016RemoveAtRiskCallout,
      );
    });
  });
});
