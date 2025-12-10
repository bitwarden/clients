import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TaskService } from "@bitwarden/common/vault/tasks";

import { ChangeLoginPasswordService } from "../abstractions/change-login-password.service";

import { CipherViewComponent } from "./cipher-view.component";

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
  let mockConfigService: ConfigService;

  // Mock data
  let mockCipherView: CipherView;
  let featureFlagEnabled$: BehaviorSubject<boolean>;
  let hasPremiumFromAnySource$: BehaviorSubject<boolean>;
  let activeAccount$: BehaviorSubject<Account>;

  beforeEach(async () => {
    // Setup mock observables
    activeAccount$ = new BehaviorSubject({
      id: "test-user-id",
      email: "test@example.com",
    } as Account);

    featureFlagEnabled$ = new BehaviorSubject(false);
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

    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$ = jest.fn().mockReturnValue(featureFlagEnabled$);

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
      featureFlagEnabled$.next(true);
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

    it("returns false when feature flag is disabled", fakeAsync(() => {
      featureFlagEnabled$.next(false);

      const cipher = createLoginCipherView();
      fixture.componentRef.setInput("cipher", cipher);
      fixture.detectChanges();
      tick();

      expect(mockCipherRiskService.computeCipherRiskForUser).not.toHaveBeenCalled();
      expect(component.passwordIsAtRisk()).toBe(false);
    }));

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
});
