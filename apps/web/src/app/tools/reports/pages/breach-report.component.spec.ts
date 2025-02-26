// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BreachAccountResponse } from "@bitwarden/common/models/response/breach-account.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

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

describe("BreachReportComponent", () => {
  let component: BreachReportComponent;
  let fixture: ComponentFixture<BreachReportComponent>;
  let auditService: MockProxy<AuditService>;
  let accountService: MockProxy<AccountService>;
  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>({
    id: "testId" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });

  beforeEach(async () => {
    auditService = mock<AuditService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccountSubject;

    await TestBed.configureTestingModule({
      declarations: [BreachReportComponent, I18nPipe],
      imports: [ReactiveFormsModule],
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
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownElements: false,
      errorOnUnknownProperties: false,
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
    expect(component.formGroup.get("username").value).toEqual("test@example.com");
  });

  it("should mark form as touched and show validation error if form is invalid on submit", async () => {
    component.formGroup.get("username").setValue("");
    await component.submit();

    expect(component.formGroup.touched).toBe(true);
    expect(component.formGroup.invalid).toBe(true);
  });

  it("should call auditService.breachedAccounts with lowercase username", async () => {
    auditService.breachedAccounts.mockResolvedValue(breachedAccounts);
    component.formGroup.get("username").setValue("validUsername");

    await component.submit();

    expect(auditService.breachedAccounts).toHaveBeenCalledWith("validusername");
  });

  it("should set breachedAccounts and checkedUsername after successful submit", async () => {
    auditService.breachedAccounts.mockResolvedValue(breachedAccounts);

    await component.submit();

    expect(component.breachedAccounts).toEqual(breachedAccounts);
    expect(component.checkedUsername).toEqual("test@example.com");
  });

  it("should set error to true if auditService.breachedAccounts throws an error", async () => {
    auditService.breachedAccounts.mockRejectedValue(new Error("test error"));
    component.formGroup.get("username").setValue("validUsername");

    await component.submit();

    expect(component.error).toBe(true);
  });

  it("should set loading to false after submit", async () => {
    auditService.breachedAccounts.mockResolvedValue([]);
    component.formGroup.get("username").setValue("validUsername");

    await component.submit();

    expect(component.loading).toBe(false);
  });
});
