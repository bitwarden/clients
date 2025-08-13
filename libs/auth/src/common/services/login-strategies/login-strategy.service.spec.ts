import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { PreloginResponse } from "@bitwarden/common/auth/models/response/prelogin.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import {
  FakeAccountService,
  FakeGlobalState,
  FakeGlobalStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfConfigService, KdfType, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import {
  AuthRequestServiceAbstraction,
  InternalUserDecryptionOptionsServiceAbstraction,
} from "../../abstractions";
import { PasswordLoginCredentials } from "../../models";
import { UserDecryptionOptionsService } from "../user-decryption-options/user-decryption-options.service";

import { LoginStrategyService } from "./login-strategy.service";
import { CACHE_EXPIRATION_KEY } from "./login-strategy.state";

describe("LoginStrategyService", () => {
  let sut: LoginStrategyService;

  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let keyService: MockProxy<KeyService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let environmentService: MockProxy<EnvironmentService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let i18nService: MockProxy<I18nService>;
  let encryptService: MockProxy<EncryptService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let authRequestService: MockProxy<AuthRequestServiceAbstraction>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let configService: MockProxy<ConfigService>;

  let stateProvider: FakeGlobalStateProvider;
  let loginStrategyCacheExpirationState: FakeGlobalState<Date | null>;

  const userId = "USER_ID" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();
    keyService = mock<KeyService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    keyConnectorService = mock<KeyConnectorService>();
    environmentService = mock<EnvironmentService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    i18nService = mock<I18nService>();
    encryptService = mock<EncryptService>();
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    policyService = mock<PolicyService>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    authRequestService = mock<AuthRequestServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    stateProvider = new FakeGlobalStateProvider();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    taskSchedulerService = mock<TaskSchedulerService>();
    configService = mock<ConfigService>();

    sut = new LoginStrategyService(
      accountService,
      masterPasswordService,
      keyService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      keyConnectorService,
      environmentService,
      stateService,
      twoFactorService,
      i18nService,
      encryptService,
      passwordStrengthService,
      policyService,
      deviceTrustService,
      authRequestService,
      userDecryptionOptionsService,
      stateProvider,
      billingAccountProfileStateService,
      vaultTimeoutSettingsService,
      kdfConfigService,
      taskSchedulerService,
      configService,
    );

    loginStrategyCacheExpirationState = stateProvider.getFake(CACHE_EXPIRATION_KEY);

    const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
    const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
      mockVaultTimeoutAction,
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      mockVaultTimeoutActionBSub.asObservable(),
    );

    const mockVaultTimeout = 1000;

    const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      mockVaultTimeoutBSub.asObservable(),
    );
  });

  it("should return an AuthResult on successful login", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );
    apiService.postPrelogin.mockResolvedValue(
      new PreloginResponse({
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
      }),
    );

    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    const result = await sut.logIn(credentials);

    expect(result).toBeInstanceOf(AuthResult);
  });

  it("should return an AuthResult on successful 2fa login", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValueOnce(
      new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      }),
    );

    apiService.postPrelogin.mockResolvedValue(
      new PreloginResponse({
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
      }),
    );

    await sut.logIn(credentials);

    const twoFactorToken = new TokenTwoFactorRequest(
      TwoFactorProviderType.Authenticator,
      "TWO_FACTOR_TOKEN",
      true,
    );
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );

    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    const result = await sut.logInTwoFactor(twoFactorToken);

    expect(result).toBeInstanceOf(AuthResult);
  });

  it("should clear the cache if more than 2 mins have passed since expiration date", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      }),
    );

    apiService.postPrelogin.mockResolvedValue(
      new PreloginResponse({
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
      }),
    );

    await sut.logIn(credentials);

    loginStrategyCacheExpirationState.stateSubject.next(new Date(Date.now() - 1000 * 60 * 5));

    const twoFactorToken = new TokenTwoFactorRequest(
      TwoFactorProviderType.Authenticator,
      "TWO_FACTOR_TOKEN",
      true,
    );

    await expect(sut.logInTwoFactor(twoFactorToken)).rejects.toThrow();
  });

  it("throw error on too low kdf config", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    apiService.postIdentityToken.mockResolvedValue(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.PBKDF2_SHA256,
        KdfIterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );
    apiService.postPrelogin.mockResolvedValue(
      new PreloginResponse({
        Kdf: KdfType.PBKDF2_SHA256,
        KdfIterations: PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1,
      }),
    );

    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    await expect(sut.logIn(credentials)).rejects.toThrow(
      `PBKDF2 iterations must be at least ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN}, but was ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN - 1}; possible pre-login downgrade attack detected.`,
    );
  });

  it("returns an AuthResult on successful new device verification", async () => {
    const credentials = new PasswordLoginCredentials("EMAIL", "MASTER_PASSWORD");
    const deviceVerificationOtp = "123456";

    // Setup initial login and device verification response
    apiService.postPrelogin.mockResolvedValue(
      new PreloginResponse({
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
      }),
    );

    apiService.postIdentityToken.mockResolvedValueOnce(
      new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      }),
    );

    await sut.logIn(credentials);

    // Successful device verification login
    apiService.postIdentityToken.mockResolvedValueOnce(
      new IdentityTokenResponse({
        ForcePasswordReset: false,
        Kdf: KdfType.Argon2id,
        KdfIterations: 2,
        KdfMemory: 16,
        KdfParallelism: 1,
        Key: "KEY",
        PrivateKey: "PRIVATE_KEY",
        ResetMasterPassword: false,
        access_token: "ACCESS_TOKEN",
        expires_in: 3600,
        refresh_token: "REFRESH_TOKEN",
        scope: "api offline_access",
        token_type: "Bearer",
      }),
    );

    tokenService.decodeAccessToken.calledWith("ACCESS_TOKEN").mockResolvedValue({
      sub: "USER_ID",
      name: "NAME",
      email: "EMAIL",
      premium: false,
    });

    const result = await sut.logInNewDeviceVerification(deviceVerificationOtp);

    expect(result).toBeInstanceOf(AuthResult);
    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        newDeviceOtp: deviceVerificationOtp,
      }),
    );
  });
});
