import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

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
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import {
  InternalMasterPasswordServiceAbstraction,
  MasterPasswordServiceAbstraction,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { DialogService, ToastService, AnonLayoutWrapperDataService } from "@bitwarden/components";

import { TwoFactorAuthComponentCacheService } from "./two-factor-auth-component-cache.service";
import { TwoFactorAuthComponentService } from "./two-factor-auth-component.service";
import { TwoFactorAuthComponent } from "./two-factor-auth.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ standalone: false })
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
  let mockMasterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let mockAccountService: FakeAccountService;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockTwoFactorAuthCompService: MockProxy<TwoFactorAuthComponentService>;
  let anonLayoutWrapperDataService: MockProxy<AnonLayoutWrapperDataService>;
  let mockEnvService: MockProxy<EnvironmentService>;
  let mockLoginSuccessHandlerService: MockProxy<LoginSuccessHandlerService>;
  let mockTwoFactorAuthCompCacheService: MockProxy<TwoFactorAuthComponentCacheService>;
  let mockAuthService: MockProxy<AuthService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockKeyConnnectorService: MockProxy<KeyConnectorService>;

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
    mockMasterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    mockDialogService = mock<DialogService>();
    mockToastService = mock<ToastService>();
    mockTwoFactorAuthCompService = mock<TwoFactorAuthComponentService>();
    mockAuthService = mock<AuthService>();
    mockConfigService = mock<ConfigService>();
    mockKeyConnnectorService = mock<KeyConnectorService>();
    mockKeyConnnectorService.requiresDomainConfirmation$.mockReturnValue(of(null));

    mockEnvService = mock<EnvironmentService>();
    mockLoginSuccessHandlerService = mock<LoginSuccessHandlerService>();

    anonLayoutWrapperDataService = mock<AnonLayoutWrapperDataService>();

    mockTwoFactorAuthCompCacheService = mock<TwoFactorAuthComponentCacheService>();
    mockTwoFactorAuthCompCacheService.getCachedData.mockReturnValue(null);

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

    selectedUserDecryptionOptions = new BehaviorSubject<UserDecryptionOptions>(
      mockUserDecryptionOpts.withMasterPassword,
    );
    mockUserDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
      selectedUserDecryptionOptions,
    );

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
        {
          provide: TwoFactorAuthComponentCacheService,
          useValue: mockTwoFactorAuthCompCacheService,
        },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MasterPasswordServiceAbstraction, useValue: mockMasterPasswordService },
        { provide: KeyConnectorService, useValue: mockKeyConnnectorService },
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
        );
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

          it("navigates to the /set-initial-password route when user doesn't have a MP and key connector isn't enabled", async () => {
            // Arrange
            mockConfigService.getFeatureFlag.mockResolvedValue(true);

            // Act
            await component.submit("testToken");

            // Assert
            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(["set-initial-password"], {
              queryParams: {
                identifier: component.orgSsoIdentifier,
              },
            });
          });
        });

        it("does not navigate to the /set-initial-password route when the user has key connector even if user has no master password", async () => {
          mockConfigService.getFeatureFlag.mockResolvedValue(true);

          selectedUserDecryptionOptions.next(
            mockUserDecryptionOpts.noMasterPasswordWithKeyConnector,
          );

          await component.submit(token, remember);

          expect(mockRouter.navigate).not.toHaveBeenCalledWith(["set-initial-password"], {
            queryParams: {
              identifier: component.orgSsoIdentifier,
            },
          });
        });
      });

      it("navigates to the component's defined success route (vault is default) when the login is successful", async () => {
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(new AuthResult());
        mockAuthService.activeAccountStatus$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
        mockMasterPasswordService.forceSetPasswordReason$.mockReturnValue(
          of(ForceSetPasswordReason.None),
        );

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
          mockAuthService.activeAccountStatus$ = new BehaviorSubject(AuthenticationStatus.Locked);

          // Act
          await component.submit("testToken");

          // Assert
          expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
          expect(mockRouter.navigate).toHaveBeenCalledWith([expectedRoute], {
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
            expect(mockMasterPasswordService.setForceSetPasswordReason).toHaveBeenCalledWith(
              ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
              userId,
            );

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(["login-initiated"]);
          });
        });

        describe("Given Trusted Device Encryption is enabled and user doesn't need to set a MP", () => {
          let authResult;
          beforeEach(() => {
            selectedUserDecryptionOptions.next(
              mockUserDecryptionOpts.withMasterPasswordAndTrustedDevice,
            );

            authResult = new AuthResult();
            mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);
          });

          it("navigates to the login-initiated route when login is successful", async () => {
            await component.submit(token, remember);

            expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
            expect(mockRouter.navigate).toHaveBeenCalledWith(["login-initiated"]);
          });
        });
      });

      it("navigates to /confirm-key-connector-domain when Key Connector is enabled and user has no master password", async () => {
        selectedUserDecryptionOptions.next(mockUserDecryptionOpts.noMasterPasswordWithKeyConnector);
        mockKeyConnnectorService.requiresDomainConfirmation$.mockReturnValue(
          of({
            keyConnectorUrl:
              mockUserDecryptionOpts.noMasterPasswordWithKeyConnector.keyConnectorOption!
                .keyConnectorUrl,
          }),
        );
        const authResult = new AuthResult();
        authResult.userId = userId;
        mockLoginStrategyService.logInTwoFactor.mockResolvedValue(authResult);

        await component.submit(token, remember);

        expect(mockRouter.navigate).toHaveBeenCalledWith(["confirm-key-connector-domain"]);
      });
    });
  });
});
