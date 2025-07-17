import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DIALOG_DATA, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { LoginApprovalDialogComponentServiceAbstraction } from "./login-approval-dialog-component.service.abstraction";
import { LoginApprovalDialogComponent } from "./login-approval-dialog.component";

describe("LoginApprovalDialogComponent", () => {
  let component: LoginApprovalDialogComponent;
  let fixture: ComponentFixture<LoginApprovalDialogComponent>;

  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let accountService: MockProxy<AccountService>;
  let apiService: MockProxy<ApiService>;
  let devicesService: MockProxy<DevicesServiceAbstraction>;
  let i18nService: MockProxy<I18nService>;
  let dialogRef: MockProxy<DialogRef>;
  let toastService: MockProxy<ToastService>;
  let validationService: MockProxy<ValidationService>;

  const testNotificationId = "test-notification-id";
  const testEmail = "test@bitwarden.com";
  const testPublicKey = "test-public-key";

  beforeEach(async () => {
    authRequestService = mock<AuthRequestServiceAbstraction>();
    accountService = mock<AccountService>();
    apiService = mock<ApiService>();
    devicesService = mock<DevicesServiceAbstraction>();
    i18nService = mock<I18nService>();
    dialogRef = mock<DialogRef>();
    toastService = mock<ToastService>();
    validationService = mock<ValidationService>();

    accountService.activeAccount$ = of({
      email: testEmail,
      id: "test-user-id" as UserId,
      emailVerified: true,
      name: null,
    });

    await TestBed.configureTestingModule({
      imports: [LoginApprovalDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { notificationId: testNotificationId } },
        { provide: AuthRequestServiceAbstraction, useValue: authRequestService },
        { provide: DevicesServiceAbstraction, useValue: devicesService },
        { provide: AccountService, useValue: accountService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: I18nService, useValue: i18nService },
        { provide: ApiService, useValue: apiService },
        { provide: AppIdService, useValue: mock<AppIdService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ToastService, useValue: toastService },
        { provide: ValidationService, useValue: validationService },
        {
          provide: LoginApprovalDialogComponentServiceAbstraction,
          useValue: mock<LoginApprovalDialogComponentServiceAbstraction>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginApprovalDialogComponent);
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
