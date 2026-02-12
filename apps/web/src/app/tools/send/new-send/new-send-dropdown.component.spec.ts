import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SendAddEditDialogComponent } from "@bitwarden/send-ui";

import { NewSendDropdownComponent } from "./new-send-dropdown.component";

describe("NewSendDropdownComponent", () => {
  let component: NewSendDropdownComponent;
  let fixture: ComponentFixture<NewSendDropdownComponent>;
  const mockBillingAccountProfileStateService = mock<BillingAccountProfileStateService>();
  const mockAccountService = mock<AccountService>();
  const mockConfigService = mock<ConfigService>();
  const mockI18nService = mock<I18nService>();
  const mockPolicyService = mock<PolicyService>();
  const mockSendService = mock<SendService>();
  const mockPremiumUpgradePromptService = mock<PremiumUpgradePromptService>();
  const mockSendApiService = mock<SendApiService>();

  beforeAll(() => {
    mockBillingAccountProfileStateService.hasPremiumFromAnySource$.mockImplementation(() =>
      of(true),
    );
    mockAccountService.activeAccount$ = of({ id: "myTestAccount" } as Account);
    mockPolicyService.policyAppliesToUser$.mockImplementation(() => of(false));
    mockPremiumUpgradePromptService.promptForPremium.mockImplementation(async () => {});
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewSendDropdownComponent],
      declarations: [],
      providers: [
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: SendService, useValue: mockSendService },
        { provide: PremiumUpgradePromptService, useValue: mockPremiumUpgradePromptService },
        { provide: SendApiService, useValue: mockSendApiService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NewSendDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should open send dialog in a popup without feature flag", async () => {
    const openSpy = jest.spyOn(SendAddEditDialogComponent, "open");
    const openDrawerSpy = jest.spyOn(SendAddEditDialogComponent, "openDrawer");
    mockConfigService.getFeatureFlag.mockResolvedValue(false);
    openSpy.mockReturnValue({ closed: of({}) } as any);

    await component.createSend(SendType.Text);

    expect(openSpy).toHaveBeenCalled();
    expect(openDrawerSpy).not.toHaveBeenCalled();
  });

  it("should open send dialog in drawer with feature flag", async () => {
    const openSpy = jest.spyOn(SendAddEditDialogComponent, "open");
    const openDrawerSpy = jest.spyOn(SendAddEditDialogComponent, "openDrawer");
    mockConfigService.getFeatureFlag.mockImplementation(async (key) =>
      key === FeatureFlag.SendUIRefresh ? true : false,
    );
    const mockRef = { closed: of({}) };
    openDrawerSpy.mockReturnValue(mockRef as any);

    await component.createSend(SendType.Text);

    expect(openSpy).not.toHaveBeenCalled();
    expect(openDrawerSpy).toHaveBeenCalled();
  });
});
