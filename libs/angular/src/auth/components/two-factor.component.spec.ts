import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { KeyConnectorUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/key-connector-user-decryption-option";
import { TrustedDeviceUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/trusted-device-user-decryption-option";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { AccountDecryptionOptions } from "@bitwarden/common/platform/models/domain/account";

import { TwoFactorComponent } from "./two-factor.component";

// test component that extends the TwoFactorComponent
@Component({})
class TestTwoFactorComponent extends TwoFactorComponent {}

interface TwoFactorComponentProtected {
  trustedDeviceEncRoute: string;
  changePasswordRoute: string;
  forcePasswordResetRoute: string;
  successRoute: string;
}

describe("TwoFactorComponent", () => {
  let component: TestTwoFactorComponent;
  let _component: TwoFactorComponentProtected;

  let fixture: ComponentFixture<TestTwoFactorComponent>;

  // Mock Services
  let mockAuthService: MockProxy<AuthService>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;
  let mockApiService: MockProxy<ApiService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockWin: MockProxy<Window>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;
  let mockStateService: MockProxy<StateService>;
  let mockLogService: MockProxy<LogService>;
  let mockTwoFactorService: MockProxy<TwoFactorService>;
  let mockAppIdService: MockProxy<AppIdService>;
  let mockLoginService: MockProxy<LoginService>;
  let mockConfigService: MockProxy<ConfigServiceAbstraction>;

  let mockAcctDecryptionOpts: {
    noMasterPassword: AccountDecryptionOptions;
    withMasterPassword: AccountDecryptionOptions;
    withMasterPasswordAndTrustedDevice: AccountDecryptionOptions;
    withMasterPasswordAndTrustedDeviceWithManageResetPassword: AccountDecryptionOptions;
    withMasterPasswordAndKeyConnector: AccountDecryptionOptions;
    noMasterPasswordWithTrustedDevice: AccountDecryptionOptions;
    noMasterPasswordWithTrustedDeviceWithManageResetPassword: AccountDecryptionOptions;
    noMasterPasswordWithKeyConnector: AccountDecryptionOptions;
  };

  beforeEach(() => {
    mockAuthService = mock<AuthService>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();
    mockApiService = mock<ApiService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockWin = mock<Window>();
    mockEnvironmentService = mock<EnvironmentService>();
    mockStateService = mock<StateService>();
    mockLogService = mock<LogService>();
    mockTwoFactorService = mock<TwoFactorService>();
    mockAppIdService = mock<AppIdService>();
    mockLoginService = mock<LoginService>();
    mockConfigService = mock<ConfigServiceAbstraction>();

    mockAcctDecryptionOpts = {
      noMasterPassword: new AccountDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: undefined,
        keyConnectorOption: undefined,
      }),
      withMasterPassword: new AccountDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: undefined,
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndTrustedDevice: new AccountDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndTrustedDeviceWithManageResetPassword: new AccountDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndKeyConnector: new AccountDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: undefined,
        keyConnectorOption: new KeyConnectorUserDecryptionOption("http://example.com"),
      }),
      noMasterPasswordWithTrustedDevice: new AccountDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false),
        keyConnectorOption: undefined,
      }),
      noMasterPasswordWithTrustedDeviceWithManageResetPassword: new AccountDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true),
        keyConnectorOption: undefined,
      }),
      noMasterPasswordWithKeyConnector: new AccountDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: undefined,
        keyConnectorOption: new KeyConnectorUserDecryptionOption("http://example.com"),
      }),
    };

    TestBed.configureTestingModule({
      declarations: [TestTwoFactorComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ApiService, useValue: mockApiService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
        { provide: WINDOW, useValue: mockWin },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: StateService, useValue: mockStateService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              // Default to standard 2FA flow - not SSO + 2FA
              queryParamMap: convertToParamMap({ sso: "false" }),
            },
          },
        },
        { provide: LogService, useValue: mockLogService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: AppIdService, useValue: mockAppIdService },
        { provide: LoginService, useValue: mockLoginService },
        { provide: ConfigServiceAbstraction, useValue: mockConfigService },
      ],
    });

    fixture = TestBed.createComponent(TestTwoFactorComponent);
    component = fixture.componentInstance;
    _component = component as any;
  });

  afterEach(() => {
    // Reset all mocks after each test
    jest.resetAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  // Shared tests
  const testChangePasswordOnSuccessfulLogin = () => {
    it("navigates to the component's defined change password route when user doesn't have a MP and key connector isn't enabled", async () => {
      // Act
      await component.doSubmit();

      // Assert
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith([_component.changePasswordRoute], {
        queryParams: {
          identifier: component.orgIdentifier,
        },
      });
    });
  };

  const testForceResetOnSuccessfulLogin = (reasonString: string) => {
    it(`navigates to the component's defined forcePasswordResetRoute route when response.forcePasswordReset is ${reasonString}`, async () => {
      // Act
      await component.doSubmit();

      // expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith([_component.forcePasswordResetRoute], {
        queryParams: {
          identifier: component.orgIdentifier,
        },
      });
    });
  };

  describe("Standard 2FA scenarios", () => {
    describe("doSubmit", () => {
      const token = "testToken";
      const remember = false;
      const captchaToken = "testCaptchaToken";

      beforeEach(() => {
        component.token = token;
        component.remember = remember;
        component.captchaToken = captchaToken;

        mockStateService.getAccountDecryptionOptions.mockResolvedValue(
          mockAcctDecryptionOpts.withMasterPassword
        );
      });

      it("calls authService.logInTwoFactor with correct parameters when form is submitted", async () => {
        // Arrange
        mockAuthService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.doSubmit();

        // Assert
        expect(mockAuthService.logInTwoFactor).toHaveBeenCalledWith(
          new TokenTwoFactorRequest(component.selectedProviderType, token, remember),
          captchaToken
        );
      });

      it("should return when handleCaptchaRequired returns true", async () => {
        // Arrange
        const captchaSiteKey = "testCaptchaSiteKey";
        const authResult = new AuthResult();
        authResult.captchaSiteKey = captchaSiteKey;

        mockAuthService.logInTwoFactor.mockResolvedValue(authResult);

        // Note: the any casts are required b/c typescript cant recognize that
        // handleCaptureRequired is a method on TwoFactorComponent b/c it is inherited
        // from the CaptchaProtectedComponent
        const handleCaptchaRequiredSpy = jest
          .spyOn<any, any>(component, "handleCaptchaRequired")
          .mockReturnValue(true);

        // Act
        const result = await component.doSubmit();

        // Assert
        expect(handleCaptchaRequiredSpy).toHaveBeenCalled();
        expect(result).toBeUndefined();
      });

      it("calls onSuccessfulLogin when defined", async () => {
        // Arrange
        component.onSuccessfulLogin = jest.fn().mockResolvedValue(undefined);
        mockAuthService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.doSubmit();

        // Assert
        expect(component.onSuccessfulLogin).toHaveBeenCalled();
      });

      it("calls loginService.clearValues() when login is successful", async () => {
        // Arrange
        mockAuthService.logInTwoFactor.mockResolvedValue(new AuthResult());
        // spy on loginService.clearValues
        const clearValuesSpy = jest.spyOn(mockLoginService, "clearValues");

        // Act
        await component.doSubmit();

        // Assert
        expect(clearValuesSpy).toHaveBeenCalled();
      });

      describe("Set Master Password scenarios", () => {
        beforeEach(() => {
          const authResult = new AuthResult();
          mockAuthService.logInTwoFactor.mockResolvedValue(authResult);
        });

        describe("Given user needs to set a master password", () => {
          beforeEach(() => {
            // Only need to test the case where the user has no master password to test the primary change mp flow here
            mockStateService.getAccountDecryptionOptions.mockResolvedValue(
              mockAcctDecryptionOpts.noMasterPassword
            );
          });

          testChangePasswordOnSuccessfulLogin();
        });

        it("does not navigate to the change password route when the user has key connector even if user has no master password", async () => {
          mockStateService.getAccountDecryptionOptions.mockResolvedValue(
            mockAcctDecryptionOpts.noMasterPasswordWithKeyConnector
          );

          await component.doSubmit();

          expect(mockRouter.navigate).not.toHaveBeenCalledWith([_component.changePasswordRoute], {
            queryParams: {
              identifier: component.orgIdentifier,
            },
          });
        });
      });

      describe("Force Master Password Reset scenarios", () => {
        [
          ForceResetPasswordReason.AdminForcePasswordReset,
          ForceResetPasswordReason.WeakMasterPassword,
        ].forEach((forceResetPasswordReason) => {
          const reasonString = ForceResetPasswordReason[forceResetPasswordReason];

          beforeEach(() => {
            // use standard user with MP because this test is not concerned with password reset.
            mockStateService.getAccountDecryptionOptions.mockResolvedValue(
              mockAcctDecryptionOpts.withMasterPassword
            );

            const authResult = new AuthResult();
            authResult.forcePasswordReset = forceResetPasswordReason;
            mockAuthService.logInTwoFactor.mockResolvedValue(authResult);
          });

          testForceResetOnSuccessfulLogin(reasonString);
        });
      });

      it("calls onSuccessfulLoginNavigate when the callback is defined", async () => {
        // Arrange
        component.onSuccessfulLoginNavigate = jest.fn().mockResolvedValue(undefined);
        mockAuthService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.doSubmit();

        // Assert
        expect(component.onSuccessfulLoginNavigate).toHaveBeenCalled();
      });

      it("navigates to the component's defined success route when the login is successful and onSuccessfulLoginNavigate is undefined", async () => {
        mockAuthService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.doSubmit();

        // Assert
        expect(component.onSuccessfulLoginNavigate).not.toBeDefined();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.successRoute], undefined);
      });
    });
  });

  describe("SSO > 2FA scenarios", () => {
    beforeEach(() => {
      const mockActivatedRoute = TestBed.inject(ActivatedRoute);
      mockActivatedRoute.snapshot.queryParamMap.get = jest.fn().mockReturnValue("true");
    });

    describe("doSubmit", () => {
      const token = "testToken";
      const remember = false;
      const captchaToken = "testCaptchaToken";

      beforeEach(() => {
        component.token = token;
        component.remember = remember;
        component.captchaToken = captchaToken;
      });

      describe("Trusted Device Encryption scenarios", () => {
        beforeEach(() => {
          mockConfigService.getFeatureFlag.mockResolvedValue(true);
        });

        describe("Given Trusted Device Encryption is enabled and user needs to set a master password", () => {
          beforeEach(() => {
            mockStateService.getAccountDecryptionOptions.mockResolvedValue(
              mockAcctDecryptionOpts.noMasterPasswordWithTrustedDeviceWithManageResetPassword
            );

            const authResult = new AuthResult();
            mockAuthService.logInTwoFactor.mockResolvedValue(authResult);
          });

          testChangePasswordOnSuccessfulLogin();
        });

        describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is required", () => {
          [
            ForceResetPasswordReason.AdminForcePasswordReset,
            ForceResetPasswordReason.WeakMasterPassword,
          ].forEach((forceResetPasswordReason) => {
            const reasonString = ForceResetPasswordReason[forceResetPasswordReason];

            beforeEach(() => {
              // use standard user with MP because this test is not concerned with password reset.
              mockStateService.getAccountDecryptionOptions.mockResolvedValue(
                mockAcctDecryptionOpts.withMasterPasswordAndTrustedDevice
              );

              const authResult = new AuthResult();
              authResult.forcePasswordReset = forceResetPasswordReason;
              mockAuthService.logInTwoFactor.mockResolvedValue(authResult);
            });

            testForceResetOnSuccessfulLogin(reasonString);
          });
        });

        describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is not required", () => {
          let authResult;
          beforeEach(() => {
            mockStateService.getAccountDecryptionOptions.mockResolvedValue(
              mockAcctDecryptionOpts.withMasterPasswordAndTrustedDevice
            );

            authResult = new AuthResult();
            authResult.forcePasswordReset = ForceResetPasswordReason.None;
            mockAuthService.logInTwoFactor.mockResolvedValue(authResult);
          });

          it("navigates to the component's defined trusted device encryption route when login is successful and onSuccessfulLoginTdeNavigate is undefined", async () => {
            await component.doSubmit();

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(
              [_component.trustedDeviceEncRoute],
              undefined
            );
          });

          it("calls onSuccessfulLoginTdeNavigate instead of router.navigate when the callback is defined", async () => {
            component.onSuccessfulLoginTdeNavigate = jest.fn().mockResolvedValue(undefined);

            await component.doSubmit();

            expect(mockRouter.navigate).not.toHaveBeenCalled();
            expect(component.onSuccessfulLoginTdeNavigate).toHaveBeenCalled();
          });
        });
      });
    });
  });
});
