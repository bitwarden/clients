import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  FakeKeyConnectorUserDecryptionOption as KeyConnectorUserDecryptionOption,
  FakeTrustedDeviceUserDecryptionOption as TrustedDeviceUserDecryptionOption,
  FakeUserDecryptionOptions as UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { TwoFactorAuthComponent } from "./two-factor-auth.component";

// test component that extends the TwoFactorAuthComponent
@Component({})
class TestTwoFactorComponent extends TwoFactorAuthComponent {}

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
  const userId = "userId" as UserId;

  // Mock Services
  let mockLoginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
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
  let mockLoginEmailService: MockProxy<LoginEmailServiceAbstraction>;
  let mockUserDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let mockSsoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockMasterPasswordService: FakeMasterPasswordService;
  let mockAccountService: FakeAccountService;
  let mockDialogService: MockProxy<DialogService>;

  let mockUserDecryptionOpts: {
    noMasterPassword: UserDecryptionOptions;
    withMasterPassword: UserDecryptionOptions;
    withMasterPasswordAndTrustedDevice: UserDecryptionOptions;
    withMasterPasswordAndTrustedDeviceWithManageResetPassword: UserDecryptionOptions;
    withMasterPasswordAndKeyConnector: UserDecryptionOptions;
    noMasterPasswordWithTrustedDevice: UserDecryptionOptions;
    noMasterPasswordWithTrustedDeviceWithManageResetPassword: UserDecryptionOptions;
    noMasterPasswordWithKeyConnector: UserDecryptionOptions;
  };

  let selectedUserDecryptionOptions: BehaviorSubject<UserDecryptionOptions>;

  beforeEach(() => {
    mockLoginStrategyService = mock<LoginStrategyServiceAbstraction>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();
    mockApiService = mock<ApiService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockWin = mock<Window>();
    const mockEnvironment = mock<Environment>();
    mockEnvironment.getWebVaultUrl.mockReturnValue("http://example.com");
    mockEnvironmentService = mock<EnvironmentService>();
    mockEnvironmentService.environment$ = new BehaviorSubject(mockEnvironment);

    mockStateService = mock<StateService>();
    mockLogService = mock<LogService>();
    mockTwoFactorService = mock<TwoFactorService>();
    mockAppIdService = mock<AppIdService>();
    mockLoginEmailService = mock<LoginEmailServiceAbstraction>();
    mockUserDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    mockSsoLoginService = mock<SsoLoginServiceAbstraction>();
    mockConfigService = mock<ConfigService>();
    mockAccountService = mockAccountServiceWith(userId);
    mockMasterPasswordService = new FakeMasterPasswordService();
    mockDialogService = mock<DialogService>();

    mockUserDecryptionOpts = {
      noMasterPassword: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: undefined,
        keyConnectorOption: undefined,
      }),
      withMasterPassword: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: undefined,
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndTrustedDevice: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndTrustedDeviceWithManageResetPassword: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndKeyConnector: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: undefined,
        keyConnectorOption: new KeyConnectorUserDecryptionOption("http://example.com"),
      }),
      noMasterPasswordWithTrustedDevice: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false),
        keyConnectorOption: undefined,
      }),
      noMasterPasswordWithTrustedDeviceWithManageResetPassword: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true),
        keyConnectorOption: undefined,
      }),
      noMasterPasswordWithKeyConnector: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: undefined,
        keyConnectorOption: new KeyConnectorUserDecryptionOption("http://example.com"),
      }),
    };

    selectedUserDecryptionOptions = new BehaviorSubject<UserDecryptionOptions>(null);
    mockUserDecryptionOptionsService.userDecryptionOptions$ = selectedUserDecryptionOptions;

    TestBed.configureTestingModule({
      declarations: [TestTwoFactorComponent],
      providers: [
        { provide: LoginStrategyServiceAbstraction, useValue: mockLoginStrategyService },
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
        { provide: LoginEmailServiceAbstraction, useValue: mockLoginEmailService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: mockUserDecryptionOptionsService,
        },
        { provide: SsoLoginServiceAbstraction, useValue: mockSsoLoginService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: InternalMasterPasswordServiceAbstraction, useValue: mockMasterPasswordService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogService, useValue: mockDialogService },
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
      await component.submit();

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
      await component.submit();

      // expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith([_component.forcePasswordResetRoute], {
        queryParams: {
          identifier: component.orgIdentifier,
        },
      });
    });
  };

  describe("Standard 2FA scenarios", () => {
    describe("submit", () => {
      const token = "testToken";
      const remember = false;
      const captchaToken = "testCaptchaToken";

      beforeEach(() => {
        component.token = token;
        component.remember = remember;
        component.captchaToken = captchaToken;

        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);
      });

      it("calls authService.logInTwoFactor with correct parameters when form is submitted", async () => {
        // Arrange
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit();

        // Assert
        expect(mockLoginStrategyService.logInTwoFactor).toHaveBeenCalledWith(
          new TokenTwoFactorRequest(component.selectedProviderType, token, remember),
          captchaToken,
        );
      });

      it("should return when handleCaptchaRequired returns true", async () => {
        // Arrange
        const captchaSiteKey = "testCaptchaSiteKey";
        const authResult = new AuthResult();
        authResult.captchaSiteKey = captchaSiteKey;

        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);

        // Note: the any casts are required b/c typescript cant recognize that
        // handleCaptureRequired is a method on TwoFactorComponent b/c it is inherited
        // from the CaptchaProtectedComponent
        const handleCaptchaRequiredSpy = jest
          .spyOn<any, any>(component, "handleCaptchaRequired")
          .mockReturnValue(true);

        // Act
        const result = await component.submit();

        // Assert
        expect(handleCaptchaRequiredSpy).toHaveBeenCalled();
        expect(result).toBeUndefined();
      });

      it("calls onSuccessfulLogin when defined", async () => {
        // Arrange
        component.onSuccessfulLogin = jest.fn().mockResolvedValue(undefined);
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit();

        // Assert
        expect(component.onSuccessfulLogin).toHaveBeenCalled();
      });

      it("calls loginEmailService.clearValues() when login is successful", async () => {
        // Arrange
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());
        // spy on loginEmailService.clearValues
        const clearValuesSpy = jest.spyOn(mockLoginEmailService, "clearValues");

        // Act
        await component.submit();

        // Assert
        expect(clearValuesSpy).toHaveBeenCalled();
      });

      describe("Set Master Password scenarios", () => {
        beforeEach(() => {
          const authResult = new AuthResult();
          mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
        });

        describe("Given user needs to set a master password", () => {
          beforeEach(() => {
            // Only need to test the case where the user has no master password to test the primary change mp flow here
            selectedUserDecryptionOptions.next(mockUserDecryptionOpts.noMasterPassword);
          });

          testChangePasswordOnSuccessfulLogin();
        });

        it("does not navigate to the change password route when the user has key connector even if user has no master password", async () => {
          selectedUserDecryptionOptions.next(
            mockUserDecryptionOpts.noMasterPasswordWithKeyConnector,
          );

          await component.submit();

          expect(mockRouter.navigate).not.toHaveBeenCalledWith([_component.changePasswordRoute], {
            queryParams: {
              identifier: component.orgIdentifier,
            },
          });
        });
      });

      describe("Force Master Password Reset scenarios", () => {
        [
          ForceSetPasswordReason.AdminForcePasswordReset,
          ForceSetPasswordReason.WeakMasterPassword,
        ].forEach((forceResetPasswordReason) => {
          const reasonString = ForceSetPasswordReason[forceResetPasswordReason];

          beforeEach(() => {
            // use standard user with MP because this test is not concerned with password reset.
            selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);

            const authResult = new AuthResult();
            authResult.forcePasswordReset = forceResetPasswordReason;
            mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
          });

          testForceResetOnSuccessfulLogin(reasonString);
        });
      });

      it("calls onSuccessfulLoginNavigate when the callback is defined", async () => {
        // Arrange
        component.onSuccessfulLoginNavigate = jest.fn().mockResolvedValue(undefined);
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit();

        // Assert
        expect(component.onSuccessfulLoginNavigate).toHaveBeenCalled();
      });

      it("navigates to the component's defined success route when the login is successful and onSuccessfulLoginNavigate is undefined", async () => {
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit();

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

    describe("submit", () => {
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
            selectedUserDecryptionOptions.next(
              mockUserDecryptionOpts.noMasterPasswordWithTrustedDeviceWithManageResetPassword,
            );

            const authResult = new AuthResult();
            mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
          });

          it("navigates to the component's defined trusted device encryption route and sets correct flag when user doesn't have a MP and key connector isn't enabled", async () => {
            // Act
            await component.submit();

            // Assert
            expect(mockMasterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
              ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
              userId,
            );

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(
              [_component.trustedDeviceEncRoute],
              undefined,
            );
          });
        });

        describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is required", () => {
          [
            ForceSetPasswordReason.AdminForcePasswordReset,
            ForceSetPasswordReason.WeakMasterPassword,
          ].forEach((forceResetPasswordReason) => {
            const reasonString = ForceSetPasswordReason[forceResetPasswordReason];

            beforeEach(() => {
              // use standard user with MP because this test is not concerned with password reset.
              selectedUserDecryptionOptions.next(
                mockUserDecryptionOpts.withMasterPasswordAndTrustedDevice,
              );

              const authResult = new AuthResult();
              authResult.forcePasswordReset = forceResetPasswordReason;
              mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
            });

            testForceResetOnSuccessfulLogin(reasonString);
          });
        });

        describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is not required", () => {
          let authResult;
          beforeEach(() => {
            selectedUserDecryptionOptions.next(
              mockUserDecryptionOpts.withMasterPasswordAndTrustedDevice,
            );

            authResult = new AuthResult();
            authResult.forcePasswordReset = ForceSetPasswordReason.None;
            mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
          });

          it("navigates to the component's defined trusted device encryption route when login is successful and onSuccessfulLoginTdeNavigate is undefined", async () => {
            await component.submit();

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(
              [_component.trustedDeviceEncRoute],
              undefined,
            );
          });

          it("calls onSuccessfulLoginTdeNavigate instead of router.navigate when the callback is defined", async () => {
            component.onSuccessfulLoginTdeNavigate = jest.fn().mockResolvedValue(undefined);

            await component.submit();

            expect(mockRouter.navigate).not.toHaveBeenCalled();
            expect(component.onSuccessfulLoginTdeNavigate).toHaveBeenCalled();
          });
        });
      });
    });
  });
});
