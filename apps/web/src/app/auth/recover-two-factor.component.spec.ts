import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import {
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { TwoFactorRecoveryRequest } from "@bitwarden/common/auth/models/request/two-factor-recovery.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";
import { NewDeviceVerificationNoticeService } from "@bitwarden/vault";

import { RecoverTwoFactorComponent } from "./recover-two-factor.component";

describe("RecoverTwoFactorComponent", () => {
  let component: RecoverTwoFactorComponent;
  let fixture: ComponentFixture<RecoverTwoFactorComponent>;

  // Mock Services
  let mockRouter: MockProxy<Router>;
  let mockApiService: MockProxy<ApiService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockKeyService: MockProxy<KeyService>;
  let mockLoginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let mockToastService: MockProxy<ToastService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockLoginSuccessHandlerService: MockProxy<LoginSuccessHandlerService>;
  let mockLogService: MockProxy<LogService>;
  let mockNewDeviceVerificationNoticeService: MockProxy<NewDeviceVerificationNoticeService>;

  beforeEach(() => {
    mockRouter = mock<Router>();
    mockApiService = mock<ApiService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockI18nService = mock<I18nService>();
    mockKeyService = mock<KeyService>();
    mockLoginStrategyService = mock<LoginStrategyServiceAbstraction>();
    mockToastService = mock<ToastService>();
    mockConfigService = mock<ConfigService>();
    mockLoginSuccessHandlerService = mock<LoginSuccessHandlerService>();
    mockLogService = mock<LogService>();
    mockNewDeviceVerificationNoticeService = mock<NewDeviceVerificationNoticeService>();

    TestBed.configureTestingModule({
      declarations: [RecoverTwoFactorComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ApiService, useValue: mockApiService },
        { provide: PlatformUtilsService, mockPlatformUtilsService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: LoginStrategyServiceAbstraction, useValue: mockLoginStrategyService },
        { provide: ToastService, useValue: mockToastService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoginSuccessHandlerService, useValue: mockLoginSuccessHandlerService },
        { provide: LogService, useValue: mockLogService },
        {
          provide: NewDeviceVerificationNoticeService,
          useValue: mockNewDeviceVerificationNoticeService,
        },
      ],
      imports: [I18nPipe],
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownElements: false,
    });

    fixture = TestBed.createComponent(RecoverTwoFactorComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("handleRecoveryLogin", () => {
    it("should log in successfully and navigate to the two-factor settings page", async () => {
      // Arrange
      const request = new TwoFactorRecoveryRequest();
      request.recoveryCode = "testRecoveryCode";
      request.email = "test@example.com";

      const authResult = new AuthResult();
      mockLoginStrategyService.logIn.mockResolvedValue(authResult);

      // Act
      await component["handleRecoveryLogin"](request);

      // Assert
      expect(mockLoginStrategyService.logIn).toHaveBeenCalledWith(
        expect.any(PasswordLoginCredentials),
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: mockI18nService.t("youHaveBeenLoggedIn"),
      });
      expect(
        mockNewDeviceVerificationNoticeService.updateNewDeviceVerificationSkipNoticeState,
      ).toHaveBeenCalledWith(authResult.userId, true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/settings/security/two-factor"]);
    });

    it("should handle login errors and redirect to login page", async () => {
      // Arrange
      const request = new TwoFactorRecoveryRequest();
      request.recoveryCode = "testRecoveryCode";
      request.email = "test@example.com";

      const error = new Error("Login failed");
      mockLoginStrategyService.logIn.mockRejectedValue(error);

      // Act
      await component["handleRecoveryLogin"](request);

      // Assert
      expect(mockLogService.error).toHaveBeenCalledWith(
        "Error logging in automatically: ",
        error.message,
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/login"], {
        queryParams: { email: request.email },
      });
    });
  });
});
