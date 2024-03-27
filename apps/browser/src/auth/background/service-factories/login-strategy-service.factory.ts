import { LoginStrategyService, LoginStrategyServiceAbstraction } from "@bitwarden/auth/common";

import {
  policyServiceFactory,
  PolicyServiceInitOptions,
} from "../../../admin-console/background/service-factories/policy-service.factory";
import {
  apiServiceFactory,
  ApiServiceInitOptions,
} from "../../../platform/background/service-factories/api-service.factory";
import { appIdServiceFactory } from "../../../platform/background/service-factories/app-id-service.factory";
import {
  billingAccountProfileStateServiceFactory,
  BillingAccountProfileStateServiceInitOptions,
} from "../../../platform/background/service-factories/billing-account-profile-state-service.factory";
import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  EncryptServiceInitOptions,
  encryptServiceFactory,
} from "../../../platform/background/service-factories/encrypt-service.factory";
import {
  environmentServiceFactory,
  EnvironmentServiceInitOptions,
} from "../../../platform/background/service-factories/environment-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  globalStateProviderFactory,
  GlobalStateProviderInitOptions,
} from "../../../platform/background/service-factories/global-state-provider.factory";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  logServiceFactory,
  LogServiceInitOptions,
} from "../../../platform/background/service-factories/log-service.factory";
import {
  messagingServiceFactory,
  MessagingServiceInitOptions,
} from "../../../platform/background/service-factories/messaging-service.factory";
import {
  platformUtilsServiceFactory,
  PlatformUtilsServiceInitOptions,
} from "../../../platform/background/service-factories/platform-utils-service.factory";
import {
  stateServiceFactory,
  StateServiceInitOptions,
} from "../../../platform/background/service-factories/state-service.factory";
import {
  passwordStrengthServiceFactory,
  PasswordStrengthServiceInitOptions,
} from "../../../tools/background/service_factories/password-strength-service.factory";

import { accountServiceFactory, AccountServiceInitOptions } from "./account-service.factory";
import {
  authRequestServiceFactory,
  AuthRequestServiceInitOptions,
} from "./auth-request-service.factory";
import {
  deviceTrustCryptoServiceFactory,
  DeviceTrustCryptoServiceInitOptions,
} from "./device-trust-crypto-service.factory";
import {
  keyConnectorServiceFactory,
  KeyConnectorServiceInitOptions,
} from "./key-connector-service.factory";
import {
  internalMasterPasswordServiceFactory,
  MasterPasswordServiceInitOptions,
} from "./master-password-service.factory";
import { tokenServiceFactory, TokenServiceInitOptions } from "./token-service.factory";
import { twoFactorServiceFactory, TwoFactorServiceInitOptions } from "./two-factor-service.factory";
import {
  internalUserDecryptionOptionServiceFactory,
  UserDecryptionOptionsServiceInitOptions,
} from "./user-decryption-options-service.factory";

type LoginStrategyServiceFactoryOptions = FactoryOptions;

export type LoginStrategyServiceInitOptions = LoginStrategyServiceFactoryOptions &
  AccountServiceInitOptions &
  MasterPasswordServiceInitOptions &
  CryptoServiceInitOptions &
  ApiServiceInitOptions &
  TokenServiceInitOptions &
  PlatformUtilsServiceInitOptions &
  MessagingServiceInitOptions &
  LogServiceInitOptions &
  KeyConnectorServiceInitOptions &
  EnvironmentServiceInitOptions &
  StateServiceInitOptions &
  TwoFactorServiceInitOptions &
  I18nServiceInitOptions &
  EncryptServiceInitOptions &
  PolicyServiceInitOptions &
  PasswordStrengthServiceInitOptions &
  DeviceTrustCryptoServiceInitOptions &
  AuthRequestServiceInitOptions &
  UserDecryptionOptionsServiceInitOptions &
  GlobalStateProviderInitOptions &
  BillingAccountProfileStateServiceInitOptions;

export function loginStrategyServiceFactory(
  cache: { loginStrategyService?: LoginStrategyServiceAbstraction } & CachedServices,
  opts: LoginStrategyServiceInitOptions,
): Promise<LoginStrategyServiceAbstraction> {
  return factory(
    cache,
    "loginStrategyService",
    opts,
    async () =>
      new LoginStrategyService(
        await accountServiceFactory(cache, opts),
        await internalMasterPasswordServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await apiServiceFactory(cache, opts),
        await tokenServiceFactory(cache, opts),
        await appIdServiceFactory(cache, opts),
        await platformUtilsServiceFactory(cache, opts),
        await messagingServiceFactory(cache, opts),
        await logServiceFactory(cache, opts),
        await keyConnectorServiceFactory(cache, opts),
        await environmentServiceFactory(cache, opts),
        await stateServiceFactory(cache, opts),
        await twoFactorServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await encryptServiceFactory(cache, opts),
        await passwordStrengthServiceFactory(cache, opts),
        await policyServiceFactory(cache, opts),
        await deviceTrustCryptoServiceFactory(cache, opts),
        await authRequestServiceFactory(cache, opts),
        await internalUserDecryptionOptionServiceFactory(cache, opts),
        await globalStateProviderFactory(cache, opts),
        await billingAccountProfileStateServiceFactory(cache, opts),
      ),
  );
}
