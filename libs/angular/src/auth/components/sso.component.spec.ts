import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, of } from "rxjs";

import {
  FakeKeyConnectorUserDecryptionOption as KeyConnectorUserDecryptionOption,
  LoginStrategyServiceAbstraction,
  FakeTrustedDeviceUserDecryptionOption as TrustedDeviceUserDecryptionOption,
  FakeUserDecryptionOptions as UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { SsoComponent } from "./sso.component";
// test component that extends the SsoComponent
@Component({})
class TestSsoComponent extends SsoComponent {}

interface SsoComponentProtected {
  twoFactorRoute: string;
  successRoute: string;
  trustedDeviceEncRoute: string;
  changePasswordRoute: string;
  forcePasswordResetRoute: string;
  logIn(code: string, codeVerifier: string, orgIdFromState: string): Promise<AuthResult>;
  handleLoginError(e: any): Promise<void>;
}

// The ideal scenario would be to not have to test the protected / private methods of the SsoComponent
// but that will require a refactor of the SsoComponent class which is out of scope for now.
// This test suite allows us to be sure that the new Trusted Device encryption flows + mild refactors
// of the SsoComponent don't break the existing post login flows.
describe("SsoComponent", () => {
  let component: TestSsoComponent;
  let _component: SsoComponentProtected;
  let fixture: ComponentFixture<TestSsoComponent>;
  const userId = "userId" as UserId;

  // Mock Services
  let mockLoginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;

  let mockQueryParams: Observable<any>;
  let mockActivatedRoute: ActivatedRoute;

  let mockSsoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let mockStateService: MockProxy<StateService>;
  let mockToastService: MockProxy<ToastService>;
  let mockApiService: MockProxy<ApiService>;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;
  let mockPasswordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let mockLogService: MockProxy<LogService>;
  let mockUserDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockMasterPasswordService: FakeMasterPasswordService;
  let mockAccountService: FakeAccountService;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;

  // Mock authService.logIn params
  let code: string;
  let codeVerifier: string;
  let orgIdFromState: string;

  // Mock component callbacks
  let mockOnSuccessfulLogin: jest.Mock;
  let mockOnSuccessfulLoginNavigate: jest.Mock;
  let mockOnSuccessfulLoginTwoFactorNavigate: jest.Mock;
  let mockOnSuccessfulLoginChangePasswordNavigate: jest.Mock;
  let mockOnSuccessfulLoginForceResetNavigate: jest.Mock;
  let mockOnSuccessfulLoginTdeNavigate: jest.Mock;

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
    // Mock Services
    mockLoginStrategyService = mock<LoginStrategyServiceAbstraction>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();

    // Default mockQueryParams
    mockQueryParams = of({ code: "code", state: "state" });
    // Create a custom mock for ActivatedRoute with mock queryParams
    mockActivatedRoute = {
      queryParams: mockQueryParams,
    } as any as ActivatedRoute;

    mockSsoLoginService = mock();
    mockStateService = mock();
    mockToastService = mock();
    mockApiService = mock();
    mockCryptoFunctionService = mock();
    mockEnvironmentService = mock();
    mockPasswordGenerationService = mock();
    mockLogService = mock();
    mockUserDecryptionOptionsService = mock();
    mockConfigService = mock();
    mockAccountService = mockAccountServiceWith(userId);
    mockMasterPasswordService = new FakeMasterPasswordService();
    mockPlatformUtilsService = mock();

    // Mock loginStrategyService.logIn params
    code = "code";
    codeVerifier = "codeVerifier";
    orgIdFromState = "orgIdFromState";

    // Mock component callbacks
    mockOnSuccessfulLogin = jest.fn();
    mockOnSuccessfulLoginNavigate = jest.fn();
    mockOnSuccessfulLoginTwoFactorNavigate = jest.fn();
    mockOnSuccessfulLoginChangePasswordNavigate = jest.fn();
    mockOnSuccessfulLoginForceResetNavigate = jest.fn();
    mockOnSuccessfulLoginTdeNavigate = jest.fn();

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
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false, false),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndTrustedDeviceWithManageResetPassword: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true, false),
        keyConnectorOption: undefined,
      }),
      withMasterPasswordAndKeyConnector: new UserDecryptionOptions({
        hasMasterPassword: true,
        trustedDeviceOption: undefined,
        keyConnectorOption: new KeyConnectorUserDecryptionOption("http://example.com"),
      }),
      noMasterPasswordWithTrustedDevice: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, false, false),
        keyConnectorOption: undefined,
      }),
      noMasterPasswordWithTrustedDeviceWithManageResetPassword: new UserDecryptionOptions({
        hasMasterPassword: false,
        trustedDeviceOption: new TrustedDeviceUserDecryptionOption(true, false, true, false),
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
      declarations: [TestSsoComponent],
      providers: [
        { provide: SsoLoginServiceAbstraction, useValue: mockSsoLoginService },
        { provide: LoginStrategyServiceAbstraction, useValue: mockLoginStrategyService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: StateService, useValue: mockStateService },
        { provide: ToastService, useValue: mockToastService },

        { provide: ApiService, useValue: mockApiService },
        { provide: CryptoFunctionService, useValue: mockCryptoFunctionService },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        {
          provide: PasswordGenerationServiceAbstraction,
          useValue: mockPasswordGenerationService,
        },

        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: mockUserDecryptionOptionsService,
        },
        { provide: LogService, useValue: mockLogService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: InternalMasterPasswordServiceAbstraction, useValue: mockMasterPasswordService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },
      ],
    });

    fixture = TestBed.createComponent(TestSsoComponent);
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

  describe("navigateViaCallbackOrRoute(...)", () => {
    it("calls the provided callback when callback is defined", async () => {
      const callback = jest.fn().mockResolvedValue(null);
      const commands = ["some", "route"];

      await (component as any).navigateViaCallbackOrRoute(callback, commands);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("calls router.navigate when callback is not defined", async () => {
      const commands = ["some", "route"];

      await (component as any).navigateViaCallbackOrRoute(undefined, commands);

      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(commands, undefined);
    });
  });

  describe("logIn(...)", () => {
    describe("2FA scenarios", () => {
      beforeEach(() => {
        const authResult = new AuthResult();
        authResult.twoFactorProviders = { [TwoFactorProviderType.Authenticator]: {} };

        // use standard user with MP because this test is not concerned with password reset.
        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);

        mockLoginStrategyService.logIn.mockResolvedValue(authResult);
      });

      it("calls authService.logIn and navigates to the component's defined 2FA route when the auth result requires 2FA and onSuccessfulLoginTwoFactorNavigate is not defined", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

        expect(mockOnSuccessfulLoginTwoFactorNavigate).not.toHaveBeenCalled();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.twoFactorRoute], {
          queryParams: {
            identifier: orgIdFromState,
            sso: "true",
          },
        });

        expect(mockLogService.error).not.toHaveBeenCalled();
      });

      it("calls onSuccessfulLoginTwoFactorNavigate instead of router.navigate when response.requiresTwoFactor is true and the callback is defined", async () => {
        mockOnSuccessfulLoginTwoFactorNavigate = jest.fn().mockResolvedValue(null);
        component.onSuccessfulLoginTwoFactorNavigate = mockOnSuccessfulLoginTwoFactorNavigate;

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);
        expect(mockOnSuccessfulLoginTwoFactorNavigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    });

    // Shared test helpers
    const testChangePasswordOnSuccessfulLogin = () => {
      it("navigates to the component's defined change password route when onSuccessfulLoginChangePasswordNavigate callback is undefined", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

        expect(mockOnSuccessfulLoginChangePasswordNavigate).not.toHaveBeenCalled();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.changePasswordRoute], {
          queryParams: {
            identifier: orgIdFromState,
          },
        });

        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    };

    const testOnSuccessfulLoginChangePasswordNavigate = () => {
      it("calls onSuccessfulLoginChangePasswordNavigate instead of router.navigate when the callback is defined", async () => {
        mockOnSuccessfulLoginChangePasswordNavigate = jest.fn().mockResolvedValue(null);
        component.onSuccessfulLoginChangePasswordNavigate =
          mockOnSuccessfulLoginChangePasswordNavigate;

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);
        expect(mockOnSuccessfulLoginChangePasswordNavigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    };

    const testForceResetOnSuccessfulLogin = (reasonString: string) => {
      it(`navigates to the component's defined forcePasswordResetRoute when response.forcePasswordReset is ${reasonString}`, async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

        expect(mockOnSuccessfulLoginForceResetNavigate).not.toHaveBeenCalled();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.forcePasswordResetRoute], {
          queryParams: {
            identifier: orgIdFromState,
          },
        });
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    };

    const testOnSuccessfulLoginForceResetNavigate = (reasonString: string) => {
      it(`calls onSuccessfulLoginForceResetNavigate instead of router.navigate when response.forcePasswordReset is ${reasonString} and the callback is defined`, async () => {
        mockOnSuccessfulLoginForceResetNavigate = jest.fn().mockResolvedValue(null);
        component.onSuccessfulLoginForceResetNavigate = mockOnSuccessfulLoginForceResetNavigate;

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);
        expect(mockOnSuccessfulLoginForceResetNavigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    };

    describe("Trusted Device Encryption scenarios", () => {
      beforeEach(() => {
        mockConfigService.getFeatureFlag.mockResolvedValue(true); // TDE enabled
      });

      describe("Given Trusted Device Encryption is enabled and user needs to set a master password", () => {
        let authResult;
        beforeEach(() => {
          selectedUserDecryptionOptions.next(
            mockUserDecryptionOpts.noMasterPasswordWithTrustedDeviceWithManageResetPassword,
          );

          authResult = new AuthResult();
          mockLoginStrategyService.logIn.mockResolvedValue(authResult);
        });

        it("navigates to the component's defined trustedDeviceEncRoute route and sets correct flag when onSuccessfulLoginTdeNavigate is undefined ", async () => {
          await _component.logIn(code, codeVerifier, orgIdFromState);
          expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

          expect(mockMasterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
            ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
            userId,
          );

          expect(mockOnSuccessfulLoginTdeNavigate).not.toHaveBeenCalled();

          expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledWith(
            [_component.trustedDeviceEncRoute],
            undefined,
          );

          expect(mockLogService.error).not.toHaveBeenCalled();
        });
      });

      describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is required", () => {
        [
          ForceSetPasswordReason.AdminForcePasswordReset,
          // ForceResetPasswordReason.WeakMasterPassword, -- not possible in SSO flow as set client side
        ].forEach((forceResetPasswordReason) => {
          const reasonString = ForceSetPasswordReason[forceResetPasswordReason];
          let authResult;
          beforeEach(() => {
            selectedUserDecryptionOptions.next(
              mockUserDecryptionOpts.withMasterPasswordAndTrustedDevice,
            );

            authResult = new AuthResult();
            authResult.forcePasswordReset = ForceSetPasswordReason.AdminForcePasswordReset;
            mockLoginStrategyService.logIn.mockResolvedValue(authResult);
          });

          testForceResetOnSuccessfulLogin(reasonString);
          testOnSuccessfulLoginForceResetNavigate(reasonString);
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
          mockLoginStrategyService.logIn.mockResolvedValue(authResult);
        });

        it("navigates to the component's defined trusted device encryption route when login is successful and no callback is defined", async () => {
          await _component.logIn(code, codeVerifier, orgIdFromState);

          expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledWith(
            [_component.trustedDeviceEncRoute],
            undefined,
          );
          expect(mockLogService.error).not.toHaveBeenCalled();
        });

        it("calls onSuccessfulLoginTdeNavigate instead of router.navigate when the callback is defined", async () => {
          mockOnSuccessfulLoginTdeNavigate = jest.fn().mockResolvedValue(null);
          component.onSuccessfulLoginTdeNavigate = mockOnSuccessfulLoginTdeNavigate;

          await _component.logIn(code, codeVerifier, orgIdFromState);

          expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

          expect(mockOnSuccessfulLoginTdeNavigate).toHaveBeenCalledTimes(1);

          expect(mockRouter.navigate).not.toHaveBeenCalled();
          expect(mockLogService.error).not.toHaveBeenCalled();
        });
      });
    });

    describe("Set Master Password scenarios", () => {
      beforeEach(() => {
        const authResult = new AuthResult();
        mockLoginStrategyService.logIn.mockResolvedValue(authResult);
      });

      describe("Given user needs to set a master password", () => {
        beforeEach(() => {
          // Only need to test the case where the user has no master password to test the primary change mp flow here
          selectedUserDecryptionOptions.next(mockUserDecryptionOpts.noMasterPassword);
        });

        testChangePasswordOnSuccessfulLogin();
        testOnSuccessfulLoginChangePasswordNavigate();
      });

      it("does not navigate to the change password route when the user has key connector even if user has no master password", async () => {
        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.noMasterPasswordWithKeyConnector);

        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockLoginStrategyService.logIn).toHaveBeenCalledTimes(1);

        expect(mockOnSuccessfulLoginChangePasswordNavigate).not.toHaveBeenCalled();
        expect(mockRouter.navigate).not.toHaveBeenCalledWith([_component.changePasswordRoute], {
          queryParams: {
            identifier: orgIdFromState,
          },
        });
      });
    });

    describe("Force Master Password Reset scenarios", () => {
      [
        ForceSetPasswordReason.AdminForcePasswordReset,
        // ForceResetPasswordReason.WeakMasterPassword, -- not possible in SSO flow as set client side
      ].forEach((forceResetPasswordReason) => {
        const reasonString = ForceSetPasswordReason[forceResetPasswordReason];

        beforeEach(() => {
          // use standard user with MP because this test is not concerned with password reset.
          selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);

          const authResult = new AuthResult();
          authResult.forcePasswordReset = forceResetPasswordReason;
          mockLoginStrategyService.logIn.mockResolvedValue(authResult);
        });

        testForceResetOnSuccessfulLogin(reasonString);
        testOnSuccessfulLoginForceResetNavigate(reasonString);
      });
    });

    describe("Success scenarios", () => {
      beforeEach(() => {
        const authResult = new AuthResult();
        authResult.twoFactorProviders = null;
        // use standard user with MP because this test is not concerned with password reset.
        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);
        authResult.forcePasswordReset = ForceSetPasswordReason.None;
        mockLoginStrategyService.logIn.mockResolvedValue(authResult);
      });

      it("calls authService.logIn and navigates to the component's defined success route when the login is successful", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalled();

        expect(mockOnSuccessfulLoginNavigate).not.toHaveBeenCalled();
        expect(mockOnSuccessfulLogin).not.toHaveBeenCalled();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.successRoute], undefined);
        expect(mockLogService.error).not.toHaveBeenCalled();
      });

      it("calls onSuccessfulLogin if defined when login is successful", async () => {
        mockOnSuccessfulLogin = jest.fn().mockResolvedValue(null);
        component.onSuccessfulLogin = mockOnSuccessfulLogin;

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalled();
        expect(mockOnSuccessfulLogin).toHaveBeenCalledTimes(1);

        expect(mockOnSuccessfulLoginNavigate).not.toHaveBeenCalled();

        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith([_component.successRoute], undefined);

        expect(mockLogService.error).not.toHaveBeenCalled();
      });

      it("calls onSuccessfulLoginNavigate instead of router.navigate when login is successful and the callback is defined", async () => {
        mockOnSuccessfulLoginNavigate = jest.fn().mockResolvedValue(null);
        component.onSuccessfulLoginNavigate = mockOnSuccessfulLoginNavigate;

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockLoginStrategyService.logIn).toHaveBeenCalled();

        expect(mockOnSuccessfulLoginNavigate).toHaveBeenCalledTimes(1);

        expect(mockRouter.navigate).not.toHaveBeenCalled();

        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    });

    describe("Error scenarios", () => {
      it("calls handleLoginError when an error is thrown during logIn", async () => {
        const errorMessage = "Key Connector error";
        const error = new Error(errorMessage);
        mockLoginStrategyService.logIn.mockRejectedValue(error);

        const handleLoginErrorSpy = jest.spyOn(_component, "handleLoginError");

        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(handleLoginErrorSpy).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("handleLoginError(e)", () => {
    it("logs the error and shows a toast when the error message is 'Key Connector error'", async () => {
      const errorMessage = "Key Connector error";
      const error = new Error(errorMessage);

      mockI18nService.t.mockReturnValueOnce("ssoKeyConnectorError");

      await _component.handleLoginError(error);

      expect(mockLogService.error).toHaveBeenCalledTimes(1);
      expect(mockLogService.error).toHaveBeenCalledWith(error);

      expect(mockToastService.showToast).toHaveBeenCalledTimes(1);
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: null,
        message: "ssoKeyConnectorError",
      });

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
