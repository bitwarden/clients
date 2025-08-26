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
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";

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
  let mockValidationService: MockProxy<ValidationService>;

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
    mockValidationService = mock<ValidationService>();

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
        { provide: ValidationService, useValue: mockValidationService },
      ],
      imports: [I18nPipe],
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownElements: false,
    });

    fixture = TestBed.createComponent(RecoverTwoFactorComponent);
    component = fixture.componentInstance;
  });

  describe("handleRecoveryLogin", () => {
    let email: string;
    let recoveryCode: string;

    beforeEach(() => {
      email = "test@example.com";
      recoveryCode = "testRecoveryCode";
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should log in successfully and navigate to the two-factor settings page", async () => {
      // Arrange
      const authResult = new AuthResult();
      mockLoginStrategyService.logIn.mockResolvedValue(authResult);

      // Act
      await component["loginWithRecoveryCode"](email, recoveryCode);

      // Assert
      expect(mockLoginStrategyService.logIn).toHaveBeenCalledWith(
        expect.any(PasswordLoginCredentials),
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: mockI18nService.t("youHaveBeenLoggedIn"),
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/settings/security/two-factor"]);
    });

    it("should log an error and set an inline error on the recoveryCode form control upon receiving an ErrorResponse due to an invalid token", async () => {
      // Arrange
      const error = new ErrorResponse("mockError", 400);
      error.message = "Two-step token is invalid";
      mockLoginStrategyService.logIn.mockRejectedValue(error);

      const recoveryCodeControl = component.formGroup.get("recoveryCode");
      jest.spyOn(recoveryCodeControl, "setErrors");
      mockI18nService.t.mockReturnValue("Invalid recovery code");

      // Act
      await component["loginWithRecoveryCode"](email, recoveryCode);

      // Assert
      expect(mockLogService.error).toHaveBeenCalledWith(
        "Error logging in automatically: ",
        error.message,
      );
      expect(recoveryCodeControl.setErrors).toHaveBeenCalledWith({
        invalidRecoveryCode: { message: "Invalid recovery code" },
      });
    });

    it("should log an error but not set an inline error on the recoveryCode form control upon receiving some other ErrorResponse", async () => {
      // Arrange
      const error = new ErrorResponse("mockError", 400);
      error.message = "Some other error";
      mockLoginStrategyService.logIn.mockRejectedValue(error);

      const recoveryCodeControl = component.formGroup.get("recoveryCode");
      jest.spyOn(recoveryCodeControl, "setErrors");

      // Act
      await component["loginWithRecoveryCode"](email, recoveryCode);

      // Assert
      expect(mockLogService.error).toHaveBeenCalledWith(
        "Error logging in automatically: ",
        error.message,
      );
      expect(recoveryCodeControl.setErrors).not.toHaveBeenCalled();
    });

    it("should log an error upon receiving a non-ErrorResponse error", async () => {
      // Arrange
      const error = new Error("Generic error");
      mockLoginStrategyService.logIn.mockRejectedValue(error);

      // Act
      await component["loginWithRecoveryCode"](email, recoveryCode);

      // Assert
      expect(mockLogService.error).toHaveBeenCalledWith("Error logging in automatically: ", error);
    });
  });
});
