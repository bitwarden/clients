import { Component, ChangeDetectionStrategy } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BreachAccountResponse } from "@bitwarden/common/dirt/models/response/breach-account.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { AsyncActionsModule, ButtonModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BreachReportComponent } from "./breach-report.component";

const breachedAccounts = [
  new BreachAccountResponse({
    addedDate: "2021-01-01",
    breachDate: "2021-01-01",
    dataClasses: ["test"],
    description: "test",
    domain: "test.com",
    isActive: true,
    isVerified: true,
    logoPath: "test",
    modifiedDate: "2021-01-01",
    name: "test",
    pwnCount: 1,
    title: "test",
  }),
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<div></div>",
  standalone: false,
})
class MockHeaderComponent {}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-container",
  template: "<div></div>",
  standalone: false,
})
class MockBitContainerComponent {}

describe("BreachReportComponent", () => {
  let component: BreachReportComponent;
  let fixture: ComponentFixture<BreachReportComponent>;
  let auditService: MockProxy<AuditService>;
  let accountService: MockProxy<AccountService>;
  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>({
    id: "testId" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
    }),
  });

  beforeEach(async () => {
    auditService = mock<AuditService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccountSubject;

    await TestBed.configureTestingModule({
      declarations: [BreachReportComponent, MockHeaderComponent, MockBitContainerComponent],
      imports: [ReactiveFormsModule, I18nPipe, AsyncActionsModule, ButtonModule, FormFieldModule],
      providers: [
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
      ],
      schemas: [],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BreachReportComponent);
    component = fixture.componentInstance as BreachReportComponent;
    fixture.detectChanges();
    jest.clearAllMocks();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize form with account email", async () => {
    expect(component.formGroup.get("email").value).toEqual("test@example.com");
  });

  it("should mark form as touched and show validation error if form is invalid on submit", async () => {
    component.formGroup.get("email").setValue("");
    await component.submit();

    expect(component.formGroup.touched).toBe(true);
    expect(component.formGroup.invalid).toBe(true);
  });

  it("should call auditService.breachedAccounts with lowercase email", async () => {
    auditService.breachedAccounts.mockResolvedValue(breachedAccounts);
    component.formGroup.get("email").setValue("ValidUser@example.com");

    await component.submit();

    expect(auditService.breachedAccounts).toHaveBeenCalledWith("validuser@example.com");
  });

  it("should set breachedAccounts and checkedEmail after successful submit", async () => {
    auditService.breachedAccounts.mockResolvedValue(breachedAccounts);

    await component.submit();

    expect(component.breachedAccounts).toEqual(breachedAccounts);
    expect(component.checkedEmail).toEqual("test@example.com");
  });

  it("should set error to true if auditService.breachedAccounts throws an error", async () => {
    auditService.breachedAccounts.mockRejectedValue(new Error("test error"));
    component.formGroup.get("email").setValue("valid@example.com");

    await component.submit();

    expect(component.error).toBe(true);
  });

  it("should set loading to false after submit", async () => {
    auditService.breachedAccounts.mockResolvedValue([]);
    component.formGroup.get("email").setValue("valid@example.com");

    await component.submit();

    expect(component.loading).toBe(false);
  });

  it("should mark form as invalid when email format is invalid", () => {
    component.formGroup.get("email").setValue("invalid-email");

    expect(component.formGroup.get("email").hasError("email")).toBe(true);
    expect(component.formGroup.invalid).toBe(true);
  });

  it("should mark form as valid when email format is valid", () => {
    component.formGroup.get("email").setValue("valid@example.com");

    expect(component.formGroup.get("email").hasError("email")).toBe(false);
    expect(component.formGroup.invalid).toBe(false);
  });

  it("should not call auditService when email format is invalid", async () => {
    component.formGroup.get("email").setValue("invalid-email");

    await component.submit();

    expect(auditService.breachedAccounts).not.toHaveBeenCalled();
  });
});
