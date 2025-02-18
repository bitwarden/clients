// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";

import { TwoFactorAuthComponentService } from "./two-factor-auth-component.service";
import { TwoFactorAuthComponent } from "./two-factor-auth.component";

@Component({})
class TestTwoFactorComponent extends TwoFactorAuthComponent {}

describe("TwoFactorAuthComponent", () => {
  let component: TestTwoFactorComponent;

  let fixture: ComponentFixture<TestTwoFactorComponent>;
  const userId = "userId" as UserId;

  // Mock Services
  let mockLoginStrategyService: MockProxy<LoginStrategyServiceAbstraction>;
  let mockRouter: MockProxy<Router>;
  let mockI18nService: MockProxy<I18nService>;
  let mockApiService: MockProxy<ApiService>;
  let mockPlatformUtilsService: MockProxy<PlatformUtilsService>;
  let mockWin: MockProxy<Window>;
  let mockStateService: MockProxy<StateService>;
  let mockLogService: MockProxy<LogService>;
  let mockTwoFactorService: MockProxy<TwoFactorService>;
  let mockAppIdService: MockProxy<AppIdService>;
  let mockLoginEmailService: MockProxy<LoginEmailServiceAbstraction>;
  let mockUserDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;
  let mockSsoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let mockMasterPasswordService: FakeMasterPasswordService;
  let mockAccountService: FakeAccountService;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockTwoFactorAuthCompService: MockProxy<TwoFactorAuthComponentService>;
  let anonLayoutWrapperDataService: MockProxy<AnonLayoutWrapperDataService>;
  let mockEnvService: MockProxy<EnvironmentService>;
  let mockLoginSuccessHandlerService: MockProxy<LoginSuccessHandlerService>;

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

    mockStateService = mock<StateService>();
    mockLogService = mock<LogService>();
    mockTwoFactorService = mock<TwoFactorService>();
    mockAppIdService = mock<AppIdService>();
    mockLoginEmailService = mock<LoginEmailServiceAbstraction>();
    mockUserDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    mockSsoLoginService = mock<SsoLoginServiceAbstraction>();
    mockAccountService = mockAccountServiceWith(userId);
    mockMasterPasswordService = new FakeMasterPasswordService();
    mockDialogService = mock<DialogService>();
    mockToastService = mock<ToastService>();
    mockTwoFactorAuthCompService = mock<TwoFactorAuthComponentService>();

    mockEnvService = mock<EnvironmentService>();
    mockLoginSuccessHandlerService = mock<LoginSuccessHandlerService>();

    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();

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

    selectedUserDecryptionOptions = new BehaviorSubject<UserDecryptionOptions>(undefined);
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
        { provide: InternalMasterPasswordServiceAbstraction, useValue: mockMasterPasswordService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: TwoFactorAuthComponentService, useValue: mockTwoFactorAuthCompService },
        { provide: EnvironmentService, useValue: mockEnvService },
        { provide: AnonLayoutWrapperDataService, useValue: anonLayoutWrapperDataService },
        { provide: LoginSuccessHandlerService, useValue: mockLoginSuccessHandlerService },
      ],
    });

    fixture = TestBed.createComponent(TestTwoFactorComponent);
    component = fixture.componentInstance;
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
      await component.submit("testToken");

      // Assert
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["set-password"], {
        queryParams: {
          identifier: component.orgSsoIdentifier,
        },
      });
    });
  };

  const testForceResetOnSuccessfulLogin = (reasonString: string) => {
    it(`navigates to the component's defined forcePasswordResetRoute route when response.forcePasswordReset is ${reasonString}`, async () => {
      // Act
      await component.submit("testToken");

      // expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["update-temp-password"], {
        queryParams: {
          identifier: component.orgSsoIdentifier,
        },
      });
    });
  };

  describe("Standard 2FA scenarios", () => {
    describe("submit", () => {
      const token = "testToken";
      const remember = false;
      const currentAuthTypeSubject = new BehaviorSubject<AuthenticationType>(
        AuthenticationType.Password,
      );

      beforeEach(() => {
        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.withMasterPassword);

        mockLoginStrategyService.currentAuthType$ = currentAuthTypeSubject.asObservable();
      });

      it("calls authService.logInTwoFactor with correct parameters when form is submitted", async () => {
        // Arrange
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit(token, remember);

        // Assert
        expect(mockLoginStrategyService.logInTwoFactor).toHaveBeenCalledWith(
          new TokenTwoFactorRequest(component.selectedProviderType, token, remember),
          "",
        );
      });

      it("calls loginEmailService.clearValues() when login is successful", async () => {
        // Arrange
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());
        // spy on loginEmailService.clearValues
        const clearValuesSpy = jest.spyOn(mockLoginEmailService, "clearValues");

        // Act
        await component.submit(token, remember);

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

          await component.submit(token, remember);

          expect(mockRouter.navigate).not.toHaveBeenCalledWith(["set-password"], {
            queryParams: {
              identifier: component.orgSsoIdentifier,
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

      it("navigates to the component's defined success route (vault is default) when the login is successful", async () => {
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());

        // Act
        await component.submit("testToken");

        // Assert
        expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith(["vault"], {
          queryParams: {
            identifier: component.orgSsoIdentifier,
          },
        });
      });

      it.each([
        [AuthenticationType.Sso, "lock"],
        [AuthenticationType.UserApiKey, "lock"],
      ])(
        "navigates to the lock component when the authentication type is %s",
        async (authType, expectedRoute) => {
          mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());
          currentAuthTypeSubject.next(authType);

          // Act
          await component.submit("testToken");

          // Assert
          expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledWith(["lock"], {
            queryParams: {
              identifier: component.orgSsoIdentifier,
            },
          });
        },
      );
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

      describe("Trusted Device Encryption scenarios", () => {
        describe("Given Trusted Device Encryption is enabled and user needs to set a master password", () => {
          beforeEach(() => {
            selectedUserDecryptionOptions.next(
              mockUserDecryptionOpts.noMasterPasswordWithTrustedDeviceWithManageResetPassword,
            );

            const authResult = new AuthResult();
            authResult.userId = userId;
            mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
          });

          it("navigates to the login-initiated route and sets correct flag when user doesn't have a MP and key connector isn't enabled", async () => {
            // Act
            await component.submit(token, remember);

            // Assert
            expect(mockMasterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
              ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
              userId,
            );

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(["login-initiated"]);
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

          it("navigates to the login-initiated route when login is successful", async () => {
            await component.submit(token, remember);

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(["login-initiated"]);
          });
        });
      });
    });
  });
});
