import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { KeyConnectorUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/key-connector-user-decryption-option";
import { TrustedDeviceUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/trusted-device-user-decryption-option";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { AccountDecryptionOptions } from "@bitwarden/common/platform/models/domain/account";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

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

  // Mock Services
  let mockAuthService: MockProxy<AuthService>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;

  let mockQueryParams: Observable<any>;
  let mockActivatedRoute: ActivatedRoute;

  let mockStateService: MockProxy<StateService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockApiService: MockProxy<ApiService>;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;
  let mockPasswordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let mockLogService: MockProxy<LogService>;
  let mockConfigService: MockProxy<ConfigServiceAbstraction>;

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
    // Mock Services
    mockAuthService = mock<AuthService>();
    mockRouter = mock<Router>();
    mockI18nService = mock<I18nService>();

    // Default mockQueryParams
    mockQueryParams = of({ code: "code", state: "state" });
    // Create a custom mock for ActivatedRoute with mock queryParams
    mockActivatedRoute = {
      queryParams: mockQueryParams,
    } as any as ActivatedRoute;

    mockStateService = mock<StateService>();
    mockPlatformUtilsService = mock<PlatformUtilsService>();
    mockApiService = mock<ApiService>();
    mockCryptoFunctionService = mock<CryptoFunctionService>();
    mockEnvironmentService = mock<EnvironmentService>();
    mockPasswordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    mockLogService = mock<LogService>();
    mockConfigService = mock<ConfigServiceAbstraction>();

    // Mock authService.logIn params
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
      declarations: [TestSsoComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: StateService, useValue: mockStateService },
        { provide: PlatformUtilsService, useValue: mockPlatformUtilsService },

        { provide: ApiService, useValue: mockApiService },
        { provide: CryptoFunctionService, useValue: mockCryptoFunctionService },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: mockPasswordGenerationService },

        { provide: LogService, useValue: mockLogService },
        { provide: ConfigServiceAbstraction, useValue: mockConfigService },
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
        authResult.twoFactorProviders = new Map([[TwoFactorProviderType.Authenticator, {}]]);

        // use standard user with MP because this test is not concerned with password reset.
        mockStateService.getAccountDecryptionOptions.mockResolvedValue(
          mockAcctDecryptionOpts.withMasterPassword
        );

        mockAuthService.logIn.mockResolvedValue(authResult);
      });

      it("calls authService.logIn and navigates to the component's defined 2FA route when the auth result requires 2FA and onSuccessfulLoginTwoFactorNavigate is not defined", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);

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

        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);
        expect(mockOnSuccessfulLoginTwoFactorNavigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    });

    // Shared test helpers
    const testChangePasswordOnSuccessfulLogin = () => {
      it("navigates to the component's defined change password route when onSuccessfulLoginChangePasswordNavigate callback is undefined", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);

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

        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);
        expect(mockOnSuccessfulLoginChangePasswordNavigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).not.toHaveBeenCalled();
        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    };

    const testForceResetOnSuccessfulLogin = (reasonString: string) => {
      it(`navigates to the component's defined forcePasswordResetRoute when response.forcePasswordReset is ${reasonString}`, async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);

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

        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);
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
          mockStateService.getAccountDecryptionOptions.mockResolvedValue(
            mockAcctDecryptionOpts.noMasterPasswordWithTrustedDeviceWithManageResetPassword
          );

          authResult = new AuthResult();
          mockAuthService.logIn.mockResolvedValue(authResult);
        });

        testChangePasswordOnSuccessfulLogin();
        testOnSuccessfulLoginChangePasswordNavigate();
      });

      describe("Given Trusted Device Encryption is enabled, user doesn't need to set a MP, and forcePasswordReset is required", () => {
        [
          ForceResetPasswordReason.AdminForcePasswordReset,
          // ForceResetPasswordReason.WeakMasterPassword, -- not possible in SSO flow as set client side
        ].forEach((forceResetPasswordReason) => {
          const reasonString = ForceResetPasswordReason[forceResetPasswordReason];
          let authResult;
          beforeEach(() => {
            mockStateService.getAccountDecryptionOptions.mockResolvedValue(
              mockAcctDecryptionOpts.withMasterPasswordAndTrustedDevice
            );

            authResult = new AuthResult();
            authResult.forcePasswordReset = ForceResetPasswordReason.AdminForcePasswordReset;
            mockAuthService.logIn.mockResolvedValue(authResult);
          });

          testForceResetOnSuccessfulLogin(reasonString);
          testOnSuccessfulLoginForceResetNavigate(reasonString);
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
          mockAuthService.logIn.mockResolvedValue(authResult);
        });

        it("navigates to the component's defined trusted device encryption route when login is successful and no callback is defined", async () => {
          await _component.logIn(code, codeVerifier, orgIdFromState);

          expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledWith(
            [_component.trustedDeviceEncRoute],
            undefined
          );
          expect(mockLogService.error).not.toHaveBeenCalled();
        });

        it("calls onSuccessfulLoginTdeNavigate instead of router.navigate when the callback is defined", async () => {
          mockOnSuccessfulLoginTdeNavigate = jest.fn().mockResolvedValue(null);
          component.onSuccessfulLoginTdeNavigate = mockOnSuccessfulLoginTdeNavigate;

          await _component.logIn(code, codeVerifier, orgIdFromState);

          expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);

          expect(mockOnSuccessfulLoginTdeNavigate).toHaveBeenCalledTimes(1);

          expect(mockRouter.navigate).not.toHaveBeenCalled();
          expect(mockLogService.error).not.toHaveBeenCalled();
        });
      });
    });

    describe("Set Master Password scenarios", () => {
      beforeEach(() => {
        const authResult = new AuthResult();
        mockAuthService.logIn.mockResolvedValue(authResult);
      });

      describe("Given user needs to set a master password", () => {
        beforeEach(() => {
          // Only need to test the case where the user has no master password to test the primary change mp flow here
          mockStateService.getAccountDecryptionOptions.mockResolvedValue(
            mockAcctDecryptionOpts.noMasterPassword
          );
        });

        testChangePasswordOnSuccessfulLogin();
        testOnSuccessfulLoginChangePasswordNavigate();
      });

      it("does not navigate to the change password route when the user has key connector even if user has no master password", async () => {
        mockStateService.getAccountDecryptionOptions.mockResolvedValue(
          mockAcctDecryptionOpts.noMasterPasswordWithKeyConnector
        );

        await _component.logIn(code, codeVerifier, orgIdFromState);
        expect(mockAuthService.logIn).toHaveBeenCalledTimes(1);

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
        ForceResetPasswordReason.AdminForcePasswordReset,
        // ForceResetPasswordReason.WeakMasterPassword, -- not possible in SSO flow as set client side
      ].forEach((forceResetPasswordReason) => {
        const reasonString = ForceResetPasswordReason[forceResetPasswordReason];

        beforeEach(() => {
          // use standard user with MP because this test is not concerned with password reset.
          mockStateService.getAccountDecryptionOptions.mockResolvedValue(
            mockAcctDecryptionOpts.withMasterPassword
          );

          const authResult = new AuthResult();
          authResult.forcePasswordReset = forceResetPasswordReason;
          mockAuthService.logIn.mockResolvedValue(authResult);
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
        mockStateService.getAccountDecryptionOptions.mockResolvedValue(
          mockAcctDecryptionOpts.withMasterPassword
        );
        authResult.forcePasswordReset = ForceResetPasswordReason.None;
        mockAuthService.logIn.mockResolvedValue(authResult);
      });

      it("calls authService.logIn and navigates to the component's defined success route when the login is successful", async () => {
        await _component.logIn(code, codeVerifier, orgIdFromState);

        expect(mockAuthService.logIn).toHaveBeenCalled();

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

        expect(mockAuthService.logIn).toHaveBeenCalled();
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

        expect(mockAuthService.logIn).toHaveBeenCalled();

        expect(mockOnSuccessfulLoginNavigate).toHaveBeenCalledTimes(1);

        expect(mockRouter.navigate).not.toHaveBeenCalled();

        expect(mockLogService.error).not.toHaveBeenCalled();
      });
    });

    describe("Error scenarios", () => {
      it("calls handleLoginError when an error is thrown during logIn", async () => {
        const errorMessage = "Key Connector error";
        const error = new Error(errorMessage);
        mockAuthService.logIn.mockRejectedValue(error);

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

      expect(mockPlatformUtilsService.showToast).toHaveBeenCalledTimes(1);
      expect(mockPlatformUtilsService.showToast).toHaveBeenCalledWith(
        "error",
        null,
        "ssoKeyConnectorError"
      );

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
