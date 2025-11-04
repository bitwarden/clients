import { ComponentFixture, TestBed } from "@angular/core/testing";
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

  beforeEach(async () => {
    // Setup mock observables
    const activeAccount$ = new BehaviorSubject({
      id: "test-user-id",
      email: "test@example.com",
    } as Account);

    const hasPremiumFromAnySource$ = new BehaviorSubject(true);
    const featureFlags$ = new BehaviorSubject({});

    // Create service mocks
    mockAccountService = mock<AccountService>({
      activeAccount$,
    });

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

    mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>({
      hasPremiumFromAnySource$: () => hasPremiumFromAnySource$,
    });

    mockConfigService = mock<ConfigService>({
      getFeatureFlag$: jest.fn(() => featureFlags$) as any,
    });

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
    }).compileComponents();

    fixture = TestBed.createComponent(CipherViewComponent);
    component = fixture.componentInstance;
  });

  it("should create the component", () => {
    fixture.componentRef.setInput("cipher", mockCipherView);

    expect(component).toBeTruthy();
  });
});
