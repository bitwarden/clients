import { UserDecryptionOptionsService } from "@bitwarden/auth/common";
import { DefaultOrganizationService } from "@bitwarden/common/admin-console/services/organization/default-organization.service";
import { DefaultNewPolicyService } from "@bitwarden/common/admin-console/services/policy/default-new-policy.service";
import { DefaultPolicyService } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { DefaultActiveUserAccessor } from "@bitwarden/common/auth/services/default-active-user.accessor";
import { TokenService } from "@bitwarden/common/auth/services/token.service";
import { DefaultAccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/default-account-cryptographic-state.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { DefaultKeyGenerationService } from "@bitwarden/common/key-management/crypto/key-generation/default-key-generation.service";
import { EncryptServiceImplementation } from "@bitwarden/common/key-management/crypto/services/encrypt.service.implementation";
import { MasterPasswordService } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import { DefaultV2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/services/default-v2-upgrade-token-state.service";
import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import {
  DefaultVaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";
import { DefaultConfigService } from "@bitwarden/common/platform/services/config/default-config.service";
import { DefaultSdkClientFactory } from "@bitwarden/common/platform/services/sdk/default-sdk-client-factory";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import {
  GlobalStateProvider,
  SingleUserStateProvider,
  StateProvider,
} from "@bitwarden/common/platform/state";
import { ApiService } from "@bitwarden/common/services/api.service";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { DefaultCipherSdkService } from "@bitwarden/common/vault/services/cipher-sdk.service";
import { DefaultKdfConfigService, DefaultKeyService } from "@bitwarden/key-management";
import { DefaultStateService } from "@bitwarden/state-internal";

import { MainSessionTimeoutTypeService } from "../../key-management/session-timeout/services/main-session-timeout-type.service";

import { MainPlatformUtilsService } from "./main-platform-utils.service";
import { MainSecureStorageService } from "./main-secure-storage.service";

/**
 * Dependencies the main process has already constructed in `main.ts` and passes into the factory.
 */
export interface MainSdkServiceDeps {
  logService: LogService;
  cryptoFunctionService: CryptoFunctionService;
  storageService: AbstractStorageService;
  accountService: AccountService;
  stateProvider: StateProvider;
  singleUserStateProvider: SingleUserStateProvider;
  globalStateProvider: GlobalStateProvider;
  environmentService: EnvironmentService;
  biometricStateService: ConstructorParameters<typeof DefaultVaultTimeoutSettingsService>[5];
  messagingService: MessageSender;
  userKeyStateService: UserKeyStateService;
}

export interface MainSdkServices {
  sdkService: DefaultSdkService;
  cipherSdkService: CipherSdkService;
}

/**
 * Construct the main-process SDK service graph, mirroring the CLI's non-Angular ServiceContainer
 * (`apps/cli/src/service-container/service-container.ts`). This produces a `DefaultSdkService`
 * capable of per-user crypto init + vault decryption in the main process, backed by the OS
 * credential store ({@link MainSecureStorageService}).
 *
 * ⚠️ NOT WIRED / UNVALIDATED. This factory is intentionally not called from `main.ts` yet. It
 * introduces decrypted vault data, auth tokens, and user keys into the main-process trust boundary
 * and MUST be reviewed by the key-management team and validated with the app running (cross-process
 * cache freshness, per-user state load ordering, feature-flag map, token refresh) before being
 * enabled. See the Stage 3 gate in the plan. Verified by type-check only.
 */
export async function createMainSdkService(deps: MainSdkServiceDeps): Promise<MainSdkServices> {
  const {
    logService,
    cryptoFunctionService,
    storageService,
    accountService,
    stateProvider,
    singleUserStateProvider,
    globalStateProvider,
    environmentService,
    biometricStateService,
    messagingService,
    userKeyStateService,
  } = deps;

  const platformUtilsService = new MainPlatformUtilsService();
  const secureStorageService = new MainSecureStorageService(logService);

  const encryptService = new EncryptServiceImplementation(cryptoFunctionService, logService, true);
  const keyGenerationService = new DefaultKeyGenerationService(cryptoFunctionService);

  const activeUserAccessor = new DefaultActiveUserAccessor(accountService);
  const stateService = new DefaultStateService(
    storageService,
    secureStorageService,
    activeUserAccessor,
  );

  const kdfConfigService = new DefaultKdfConfigService(stateProvider);
  const accountCryptographicStateService = new DefaultAccountCryptographicStateService(
    stateProvider,
  );
  const v2UpgradeTokenStateService = new DefaultV2UpgradeTokenStateService(stateProvider);

  const masterPasswordService = new MasterPasswordService(
    stateProvider,
    keyGenerationService,
    logService,
    cryptoFunctionService,
    accountService,
  );

  const keyService = new DefaultKeyService(
    masterPasswordService,
    keyGenerationService,
    cryptoFunctionService,
    encryptService,
    platformUtilsService,
    logService,
    stateService,
    accountService,
    stateProvider,
    kdfConfigService,
    accountCryptographicStateService,
    userKeyStateService,
  );

  const logoutCallback = async () => {
    /* no-op: the main SDK service does not drive logout */
  };

  const tokenService = new TokenService(
    singleUserStateProvider,
    globalStateProvider,
    platformUtilsService.supportsSecureStorage(),
    secureStorageService,
    encryptService,
    logService,
    logoutCallback,
  );

  const appIdService = new AppIdService(storageService, logService);

  // Policy + vault-timeout chain — required transitively by the base ApiService.
  const organizationService = new DefaultOrganizationService(stateProvider);
  const newPolicyService = new DefaultNewPolicyService(stateProvider);
  const userDecryptionOptionsService = new UserDecryptionOptionsService(singleUserStateProvider);
  const sessionTimeoutTypeService: SessionTimeoutTypeService = new MainSessionTimeoutTypeService();

  // sdkService is referenced lazily by the policy service to break a circular dependency.
  const sdkServiceHolder: { value?: DefaultSdkService } = {};
  const policyService = new DefaultPolicyService(
    stateProvider,
    organizationService,
    accountService,
    newPolicyService,
    () => sdkServiceHolder.value as DefaultSdkService,
  );

  const vaultTimeoutSettingsService = new DefaultVaultTimeoutSettingsService(
    accountService,
    userDecryptionOptionsService,
    keyService,
    tokenService,
    policyService,
    biometricStateService,
    stateProvider,
    logService,
    VaultTimeoutStringType.Never,
    sessionTimeoutTypeService,
  );

  const refreshAccessTokenErrorCallback = () => {
    throw new Error("Refresh Access token error");
  };
  const version = await platformUtilsService.getApplicationVersionNumber();
  const customUserAgent = `Bitwarden_Desktop/${version} (${platformUtilsService
    .getDeviceString()
    .toUpperCase()})`;

  const apiService = new ApiService(
    tokenService,
    platformUtilsService,
    environmentService,
    appIdService,
    refreshAccessTokenErrorCallback,
    logService,
    logoutCallback,
    vaultTimeoutSettingsService,
    accountService,
    { createRequest: (url, request) => new Request(url, request) },
    customUserAgent,
  );

  const configApiService = new ConfigApiService(apiService);
  const authService = new AuthService(
    accountService,
    messagingService,
    keyService,
    apiService,
    stateService,
    tokenService,
  );
  const configService = new DefaultConfigService(
    configApiService,
    environmentService,
    logService,
    stateProvider,
    authService,
  );

  const sdkClientFactory = new DefaultSdkClientFactory();
  const sdkService = new DefaultSdkService(
    sdkClientFactory,
    environmentService,
    platformUtilsService,
    accountService,
    kdfConfigService,
    keyService,
    accountCryptographicStateService,
    apiService,
    stateProvider,
    configService,
    v2UpgradeTokenStateService,
    userKeyStateService,
    customUserAgent,
  );
  sdkServiceHolder.value = sdkService;

  const cipherSdkService = new DefaultCipherSdkService(sdkService, logService);

  return { sdkService, cipherSdkService };
}
