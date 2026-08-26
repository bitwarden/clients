import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

import { OrganizationWarningsService } from "../services";
import { OrganizationFreeTrialWarning } from "../types";

import { OrganizationFreeTrialWarningComponent } from "./organization-free-trial-warning.component";

describe("OrganizationFreeTrialWarningComponent", () => {
  let fixture: ComponentFixture<OrganizationFreeTrialWarningComponent>;
  let warningsService: MockProxy<OrganizationWarningsService>;
  let govModeService: MockProxy<GovModeService>;
  let accountService: MockProxy<AccountService>;
  let i18nService: MockProxy<I18nService>;

  const organization = { id: "org-id-123" } as Organization;
  const account = { id: "user-id-123" as UserId } as Account;

  const setWarning = (warning: OrganizationFreeTrialWarning | null) => {
    warningsService.getFreeTrialWarning$.mockReturnValue(of(warning));
  };

  const setGovMode = (isGovMode: boolean) => {
    govModeService.isGovMode$.mockReturnValue(of(isGovMode));
  };

  beforeEach(async () => {
    warningsService = mock<OrganizationWarningsService>();
    govModeService = mock<GovModeService>();
    accountService = mock<AccountService>();
    i18nService = mock<I18nService>();

    accountService.activeAccount$ = of(account);
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [OrganizationFreeTrialWarningComponent],
      providers: [
        { provide: OrganizationWarningsService, useValue: warningsService },
        { provide: GovModeService, useValue: govModeService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationFreeTrialWarningComponent);
    fixture.componentInstance.organization = organization;
  });

  it("does not render a banner when there is no warning", () => {
    setGovMode(false);
    setWarning(null);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-banner")).toBeNull();
  });

  it("renders the countdown message and the payment link when not in Gov mode", () => {
    setGovMode(false);
    setWarning({ organization, message: "Your free trial ends in 5 days." });

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Your free trial ends in 5 days.");
    expect(fixture.nativeElement.querySelector("a")).not.toBeNull();
  });

  it("keeps the countdown message but hides the payment link in Gov mode", () => {
    setGovMode(true);
    setWarning({ organization, message: "Your free trial ends in 5 days." });

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Your free trial ends in 5 days.");
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  });
});
