import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import {
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

import { RecoverTwoFactorComponent } from "./recover-two-factor.component";

describe("RecoverTwoFactorComponent", () => {
  let component: RecoverTwoFactorComponent;
  let fixture: ComponentFixture<RecoverTwoFactorComponent>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;
  let mockLoginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let mockToastService: MockProxy<ToastService>;
  let mockLoginSuccessHandlerService: MockProxy<LoginSuccessHandlerService>;
  let mockLogService: MockProxy<LogService>;
  let mockValidationService: MockProxy<ValidationService>;

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockLoginStrategyService = mock<LoginStrategyServiceAbstraction>();
    mockToastService = mock<ToastService>();
    mockLoginSuccessHandlerService = mock<LoginSuccessHandlerService>();
    mockLogService = mock<LogService>();
    mockValidationService = mock<ValidationService>();

    await TestBed.configureTestingModule({
      imports: [RecoverTwoFactorComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: mockI18nService },
        { provide: LoginStrategyServiceAbstraction, useValue: mockLoginStrategyService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LoginSuccessHandlerService, useValue: mockLoginSuccessHandlerService },
        { provide: LogService, useValue: mockLogService },
        { provide: ValidationService, useValue: mockValidationService },
      ],
    }).compileComponents();

    mockRouter = TestBed.inject(Router) as MockProxy<Router>;
    jest.spyOn(mockRouter, "navigate");

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

    it("should log an error and show validation but not set an inline error on the recoveryCode form control upon receiving some other ErrorResponse", async () => {
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
      expect(mockValidationService.showError).toHaveBeenCalledWith(error.message);
      expect(recoveryCodeControl.setErrors).not.toHaveBeenCalled();
    });

    it("should log an error and show validation upon receiving a non-ErrorResponse error", async () => {
      // Arrange
      const error = new Error("Generic error");
      mockLoginStrategyService.logIn.mockRejectedValue(error);

      // Act
      await component["loginWithRecoveryCode"](email, recoveryCode);

      // Assert
      expect(mockLogService.error).toHaveBeenCalledWith("Error logging in automatically: ", error);
      expect(mockValidationService.showError).toHaveBeenCalledWith(error);
    });
  });
});
