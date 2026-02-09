import { DatePipe } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, ToastService } from "@bitwarden/components";
import { CredentialGeneratorService } from "@bitwarden/generator-core";

import { SendFormContainer } from "../../send-form-container";

import {
  DatePreset,
  SendDetailsComponent,
  asDatePreset,
  isDatePreset,
} from "./send-details.component";

describe("SendDetails DatePreset utilities", () => {
  it("accepts all defined numeric presets", () => {
    const presets: Array<any> = [
      DatePreset.OneHour,
      DatePreset.OneDay,
      DatePreset.TwoDays,
      DatePreset.ThreeDays,
      DatePreset.SevenDays,
      DatePreset.FourteenDays,
      DatePreset.ThirtyDays,
    ];
    presets.forEach((p) => {
      expect(isDatePreset(p)).toBe(true);
      expect(asDatePreset(p)).toBe(p);
    });
  });

  it("rejects invalid numbers and non-numeric values", () => {
    const invalid: Array<any> = [5, -1, 0.5, 0, 9999, "never", "foo", null, undefined, {}, []];
    invalid.forEach((v) => {
      expect(isDatePreset(v)).toBe(false);
      expect(asDatePreset(v)).toBeUndefined();
    });
  });
});

describe("SendDetailsComponent", () => {
  let component: SendDetailsComponent;
  let fixture: ComponentFixture<SendDetailsComponent>;
  const mockSendFormContainer = mock<SendFormContainer>();
  const mockI18nService = mock<I18nService>();
  const mockConfigService = mock<ConfigService>();
  const mockAccountService = mock<AccountService>();
  const mockBillingStateService = mock<BillingAccountProfileStateService>();
  const mockGeneratorService = mock<CredentialGeneratorService>();
  const mockSendApiService = mock<SendApiService>();
  const mockEnvironmentService = mock<EnvironmentService>();

  beforeEach(async () => {
    mockEnvironmentService.environment$ = of({
      getSendUrl: () => "https://send.bitwarden.com/",
    } as any);
    mockAccountService.activeAccount$ = of({ id: "userId" } as Account);
    mockConfigService.getFeatureFlag$.mockReturnValue(of(true));
    mockBillingStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
    mockI18nService.t.mockImplementation((k) => k);

    await TestBed.configureTestingModule({
      imports: [SendDetailsComponent, ReactiveFormsModule],
      providers: [
        { provide: SendFormContainer, useValue: mockSendFormContainer },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DatePipe, useValue: new DatePipe("en-US") },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: BillingAccountProfileStateService, useValue: mockBillingStateService },
        { provide: CredentialGeneratorService, useValue: mockGeneratorService },
        { provide: SendApiService, useValue: mockSendApiService },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendDetailsComponent);
    component = fixture.componentInstance;
    component.config = { areSendsAllowed: true, mode: "add", sendType: SendType.Text };
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize authType to None if no password or emails", () => {
    expect(component.sendDetailsForm.value.authType).toBe(AuthType.None);
  });

  it("should toggle validation based on authType", () => {
    const emailsControl = component.sendDetailsForm.get("emails");
    const passwordControl = component.sendDetailsForm.get("password");

    // Default
    expect(emailsControl?.validator).toBeNull();
    expect(passwordControl?.validator).toBeNull();

    // Select Email
    component.sendDetailsForm.patchValue({ authType: AuthType.Email });
    expect(emailsControl?.validator).not.toBeNull();
    expect(passwordControl?.validator).toBeNull();

    // Select Password
    component.sendDetailsForm.patchValue({ authType: AuthType.Password });
    expect(passwordControl?.validator).not.toBeNull();
    expect(emailsControl?.validator).toBeNull();

    // Select None
    component.sendDetailsForm.patchValue({ authType: AuthType.None });
    expect(emailsControl?.validator).toBeNull();
    expect(passwordControl?.validator).toBeNull();
  });
});
