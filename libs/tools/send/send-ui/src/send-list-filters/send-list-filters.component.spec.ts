import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/common/types/guid";
import { ChipFilterComponent } from "@bitwarden/components";

import { SendListFiltersService } from "../services/send-list-filters.service";
import { SendPolicyService } from "../services/send-policy.service";

import { SendListFiltersComponent } from "./send-list-filters.component";

describe("SendListFiltersComponent", () => {
  let component: SendListFiltersComponent;
  let fixture: ComponentFixture<SendListFiltersComponent>;
  let sendListFiltersService: SendListFiltersService;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let accountService: MockProxy<AccountService>;
  let sendPolicyService: Partial<SendPolicyService>;
  const allowedSendTypes = new BehaviorSubject<SendType[]>([SendType.Text, SendType.File]);
  const userId = "userId" as UserId;

  beforeEach(async () => {
    sendListFiltersService = new SendListFiltersService(mock(), new FormBuilder());
    sendListFiltersService.resetFilterForm = jest.fn();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = of({
      id: userId,
      ...mockAccountInfoWith({
        email: "test@email.com",
        name: "Test User",
        emailVerified: true,
      }),
    });
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    sendPolicyService = {
      allowedSendTypes$: allowedSendTypes,
    };

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        JslibModule,
        ChipFilterComponent,
        ReactiveFormsModule,
        SendListFiltersComponent,
      ],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: AccountService, useValue: accountService },
        { provide: SendPolicyService, useValue: sendPolicyService },
      ],
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

  it("should hide Send filters when the Send type is restricted by policy", () => {
    expect(fixture.debugElement.children.length).toEqual(1);
    allowedSendTypes.next([SendType.Text]);
    fixture.detectChanges();
    expect(fixture.debugElement.children.length).toEqual(0);
  });
});
