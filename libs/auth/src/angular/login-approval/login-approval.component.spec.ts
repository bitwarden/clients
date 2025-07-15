import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  AuthRequestServiceAbstraction,
  LoginApprovalComponentServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { DialogRef, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { LoginApprovalComponent } from "./login-approval.component";

describe("LoginApprovalComponent", () => {
  let component: LoginApprovalComponent;
  let fixture: ComponentFixture<LoginApprovalComponent>;

  let accountService: MockProxy<AccountService>;
  let apiService: MockProxy<ApiService>;
  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let devicesService: MockProxy<DevicesServiceAbstraction>;
  let dialogRef: MockProxy<DialogRef>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let validationService: MockProxy<ValidationService>;

  const testNotificationId = "test-notification-id";
  const testEmail = "test@bitwarden.com";
  const testPublicKey = "test-public-key";

  beforeEach(async () => {
    accountService = mock<AccountService>();
    apiService = mock<ApiService>();
    authRequestService = mock<AuthRequestServiceAbstraction>();
    devicesService = mock<DevicesServiceAbstraction>();
    dialogRef = mock<DialogRef>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();
    validationService = mock<ValidationService>();

    accountService.activeAccount$ = of({
      email: testEmail,
      id: "test-user-id" as UserId,
      emailVerified: true,
      name: null,
    });

    await TestBed.configureTestingModule({
      imports: [LoginApprovalComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { notificationId: testNotificationId } },
        { provide: AccountService, useValue: accountService },
        { provide: ApiService, useValue: apiService },
        { provide: AuthRequestServiceAbstraction, useValue: authRequestService },
        { provide: DevicesServiceAbstraction, useValue: devicesService },
        { provide: I18nService, useValue: i18nService },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ToastService, useValue: toastService },
        { provide: ValidationService, useValue: validationService },
        {
          provide: LoginApprovalComponentServiceAbstraction,
          useValue: mock<LoginApprovalComponentServiceAbstraction>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginApprovalComponent);
    component = fixture.componentInstance;
  });

  it("creates successfully", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    beforeEach(() => {
      apiService.getAuthRequest.mockResolvedValue({
        publicKey: testPublicKey,
        creationDate: new Date().toISOString(),
      } as AuthRequestResponse);
      authRequestService.getFingerprintPhrase.mockResolvedValue("test-phrase");
    });

    it("retrieves and sets auth request data", async () => {
      await component.ngOnInit();

      expect(apiService.getAuthRequest).toHaveBeenCalledWith(testNotificationId);
      expect(component.email).toBe(testEmail);
      expect(component.fingerprintPhrase).toBeDefined();
    });

    it("updates time text initially", async () => {
      i18nService.t.mockReturnValue("justNow");

      await component.ngOnInit();
      expect(component.requestTimeText).toBe("justNow");
    });
  });

  describe("denyLogin", () => {
    it("denies auth request and shows info toast", async () => {
      const response = { requestApproved: false } as AuthRequestResponse;
      apiService.getAuthRequest.mockResolvedValue(response);
      authRequestService.approveOrDenyAuthRequest.mockResolvedValue(response);
      i18nService.t.mockReturnValue("denied message");

      await component.denyLogin();

      expect(authRequestService.approveOrDenyAuthRequest).toHaveBeenCalledWith(false, response);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "info",
        title: "",
        message: "denied message",
      });
    });
  });
});
