import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ChipSelectComponent } from "@bitwarden/components";

import { SendListFiltersService } from "../services/send-list-filters.service";

import { SendListFiltersComponent } from "./send-list-filters.component";

describe("SendListFiltersComponent", () => {
  let component: SendListFiltersComponent;
  let fixture: ComponentFixture<SendListFiltersComponent>;
  let sendListFiltersService: SendListFiltersService;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let accountService: MockProxy<AccountService>;
  const userId = "userId" as UserId;

  beforeEach(async () => {
    sendListFiltersService = new SendListFiltersService(mock(), new FormBuilder());
    sendListFiltersService.resetFilterForm = jest.fn();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = of({
      id: userId,
      email: "test@email.com",
      emailVerified: true,
      name: "Test User",
    });
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        JslibModule,
        ChipSelectComponent,
        ReactiveFormsModule,
        SendListFiltersComponent,
      ],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: AccountService, useValue: accountService },
      ],
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownProperties: false,
    }).compileComponents();

    fixture = TestBed.createComponent(SendListFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize canAccessPremium$ from BillingAccountProfileStateService", () => {
    let canAccessPremium: boolean | undefined;
    component["canAccessPremium$"].subscribe((value) => (canAccessPremium = value));
    expect(canAccessPremium).toBe(true);
    expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(userId);
  });

  it("should call resetFilterForm on ngOnDestroy", () => {
    component.ngOnDestroy();
    expect(sendListFiltersService.resetFilterForm).toHaveBeenCalled();
  });
});
