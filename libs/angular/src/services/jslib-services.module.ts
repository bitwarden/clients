import { ErrorHandler, LOCALE_ID, NgModule } from "@angular/core";
import { Subject } from "rxjs";

import {
  AuthRequestServiceAbstraction,
  AuthRequestService,
  PinServiceAbstraction,
  PinService,
  LoginStrategyServiceAbstraction,
  LoginStrategyService,
  LoginEmailServiceAbstraction,
  LoginEmailService,
  InternalUserDecryptionOptionsServiceAbstraction,
  UserDecryptionOptionsService,
  UserDecryptionOptionsServiceAbstraction,
  LogoutReason,
} from "@bitwarden/auth/common";
import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService as EventCollectionServiceAbstraction } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService as VaultTimeoutServiceAbstraction } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  InternalOrganizationServiceAbstraction,
  OrganizationService as OrganizationServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import {
  OrgDomainInternalServiceAbstraction,
  OrgDomainServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain.service.abstraction";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import {
  InternalPolicyService,
  PolicyService as PolicyServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderService as ProviderServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/services/organization/organization.service";
import { OrgDomainApiService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain-api.service";
import { OrgDomainService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain.service";
import { DefaultOrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/services/organization-management-preferences/default-organization-management-preferences.service";
import { OrganizationUserServiceImplementation } from "@bitwarden/common/admin-console/services/organization-user/organization-user.service.implementation";
import { PolicyApiService } from "@bitwarden/common/admin-console/services/policy/policy-api.service";
import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { ProviderApiService } from "@bitwarden/common/admin-console/services/provider/provider-api.service";
import { ProviderService } from "@bitwarden/common/admin-console/services/provider.service";
import { AccountApiService as AccountApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/account-api.service";
import {
  AccountService as AccountServiceAbstraction,
  InternalAccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AnonymousHubService as AnonymousHubServiceAbstraction } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService as AvatarServiceAbstraction } from "@bitwarden/common/auth/abstractions/avatar.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { KdfConfigService as KdfConfigServiceAbstraction } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "@bitwarden/common/auth/abstractions/key-connector.service";
import {
  InternalMasterPasswordServiceAbstraction,
  MasterPasswordServiceAbstraction,
} from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService as TokenServiceAbstraction } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { UserVerificationApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebAuthnLoginApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginPrfCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-crypto.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { AccountApiServiceImplementation } from "@bitwarden/common/auth/services/account-api.service";
import { AccountServiceImplementation } from "@bitwarden/common/auth/services/account.service";
import { AnonymousHubService } from "@bitwarden/common/auth/services/anonymous-hub.service";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { AvatarService } from "@bitwarden/common/auth/services/avatar.service";
import { DeviceTrustService } from "@bitwarden/common/auth/services/device-trust.service.implementation";
import { DevicesServiceImplementation } from "@bitwarden/common/auth/services/devices/devices.service.implementation";
import { DevicesApiServiceImplementation } from "@bitwarden/common/auth/services/devices-api.service.implementation";
import { KdfConfigService } from "@bitwarden/common/auth/services/kdf-config.service";
import { KeyConnectorService } from "@bitwarden/common/auth/services/key-connector.service";
import { MasterPasswordService } from "@bitwarden/common/auth/services/master-password/master-password.service";
import { PasswordResetEnrollmentServiceImplementation } from "@bitwarden/common/auth/services/password-reset-enrollment.service.implementation";
import { SsoLoginService } from "@bitwarden/common/auth/services/sso-login.service";
import { TokenService } from "@bitwarden/common/auth/services/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/services/two-factor.service";
import { UserVerificationApiService } from "@bitwarden/common/auth/services/user-verification/user-verification-api.service";
import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";
import { WebAuthnLoginApiService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login-api.service";
import { WebAuthnLoginPrfCryptoService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login-prf-crypto.service";
import { WebAuthnLoginService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login.service";
import {
  AutofillSettingsServiceAbstraction,
  AutofillSettingsService,
} from "@bitwarden/common/autofill/services/autofill-settings.service";
import {
  BadgeSettingsServiceAbstraction,
  BadgeSettingsService,
} from "@bitwarden/common/autofill/services/badge-settings.service";
import {
  DomainSettingsService,
  DefaultDomainSettingsService,
} from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  BillingApiServiceAbstraction,
  BraintreeServiceAbstraction,
  OrganizationBillingServiceAbstraction,
  PaymentMethodWarningsServiceAbstraction,
  StripeServiceAbstraction,
} from "@bitwarden/common/billing/abstractions";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { DefaultBillingAccountProfileStateService } from "@bitwarden/common/billing/services/account/billing-account-profile-state.service";
import { BillingApiService } from "@bitwarden/common/billing/services/billing-api.service";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { PaymentMethodWarningsService } from "@bitwarden/common/billing/services/payment-method-warnings.service";
import { BraintreeService } from "@bitwarden/common/billing/services/payment-processors/braintree.service";
import { StripeService } from "@bitwarden/common/billing/services/payment-processors/stripe.service";
import { AppIdService as AppIdServiceAbstraction } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileUploadService as FileUploadServiceAbstraction } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { KeyGenerationService as KeyGenerationServiceAbstraction } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { ValidationService as ValidationServiceAbstraction } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  BiometricStateService,
  DefaultBiometricStateService,
} from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Used for dependency injection
import { SubjectMessageSender } from "@bitwarden/common/platform/messaging/internal";
import { devFlagEnabled, flagEnabled } from "@bitwarden/common/platform/misc/flags";
import { Account } from "@bitwarden/common/platform/models/domain/account";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";
import { DefaultConfigService } from "@bitwarden/common/platform/services/config/default-config.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";
import { EncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/encrypt.service.implementation";
import { MultithreadEncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/multithread-encrypt.service.implementation";
import { DefaultBroadcasterService } from "@bitwarden/common/platform/services/default-broadcaster.service";
import { DefaultEnvironmentService } from "@bitwarden/common/platform/services/default-environment.service";
import { FileUploadService } from "@bitwarden/common/platform/services/file-upload/file-upload.service";
import { KeyGenerationService } from "@bitwarden/common/platform/services/key-generation.service";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { NoopNotificationsService } from "@bitwarden/common/platform/services/noop-notifications.service";
import { StateService } from "@bitwarden/common/platform/services/state.service";
import { StorageServiceProvider } from "@bitwarden/common/platform/services/storage-service.provider";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { ValidationService } from "@bitwarden/common/platform/services/validation.service";
import { WebCryptoFunctionService } from "@bitwarden/common/platform/services/web-crypto-function.service";
import {
  ActiveUserStateProvider,
  GlobalStateProvider,
  SingleUserStateProvider,
  StateProvider,
  DerivedStateProvider,
} from "@bitwarden/common/platform/state";
/* eslint-disable import/no-restricted-paths -- We need the implementations to inject, but generally these should not be accessed */
import { DefaultActiveUserStateProvider } from "@bitwarden/common/platform/state/implementations/default-active-user-state.provider";
import { DefaultDerivedStateProvider } from "@bitwarden/common/platform/state/implementations/default-derived-state.provider";
import { DefaultGlobalStateProvider } from "@bitwarden/common/platform/state/implementations/default-global-state.provider";
import { DefaultSingleUserStateProvider } from "@bitwarden/common/platform/state/implementations/default-single-user-state.provider";
import { DefaultStateProvider } from "@bitwarden/common/platform/state/implementations/default-state.provider";
import { StateEventRegistrarService } from "@bitwarden/common/platform/state/state-event-registrar.service";
import { StateEventRunnerService } from "@bitwarden/common/platform/state/state-event-runner.service";
/* eslint-enable import/no-restricted-paths */
import { SyncService } from "@bitwarden/common/platform/sync";
// eslint-disable-next-line no-restricted-imports -- Needed for DI
import { DefaultSyncService } from "@bitwarden/common/platform/sync/internal";
import {
  DefaultThemeStateService,
  ThemeStateService,
} from "@bitwarden/common/platform/theming/theme-state.service";
import { ApiService } from "@bitwarden/common/services/api.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { EventCollectionService } from "@bitwarden/common/services/event/event-collection.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/services/notifications.service";
import { SearchService } from "@bitwarden/common/services/search.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/services/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vault-timeout/vault-timeout.service";
import {
  PasswordStrengthService,
  PasswordStrengthServiceAbstraction,
} from "@bitwarden/common/tools/password-strength";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendStateProvider as SendStateProvider } from "@bitwarden/common/tools/send/services/send-state.provider";
import { SendStateProvider as SendStateProviderAbstraction } from "@bitwarden/common/tools/send/services/send-state.provider.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service";
import {
  InternalSendService,
  SendService as SendServiceAbstraction,
} from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService as CollectionServiceAbstraction } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherFileUploadService as CipherFileUploadServiceAbstraction } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import {
  FolderService as FolderServiceAbstraction,
  InternalFolderService,
} from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService as VaultSettingsServiceAbstraction } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/services/collection.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/services/file-upload/cipher-file-upload.service";
import { FolderApiService } from "@bitwarden/common/vault/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { TotpService } from "@bitwarden/common/vault/services/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/services/vault-settings/vault-settings.service";
import { ToastService } from "@bitwarden/components";
import {
  legacyPasswordGenerationServiceFactory,
  legacyUsernameGenerationServiceFactory,
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";
import {
  ImportApiService,
  ImportApiServiceAbstraction,
  ImportService,
  ImportServiceAbstraction,
} from "@bitwarden/importer/core";
import { PasswordRepromptService } from "@bitwarden/vault";
import {
  VaultExportService,
  VaultExportServiceAbstraction,
  OrganizationVaultExportService,
  OrganizationVaultExportServiceAbstraction,
  IndividualVaultExportService,
  IndividualVaultExportServiceAbstraction,
} from "@bitwarden/vault-export-core";

import { AuthGuard } from "../auth/guards/auth.guard";
import { UnauthGuard } from "../auth/guards/unauth.guard";
import { FormValidationErrorsService as FormValidationErrorsServiceAbstraction } from "../platform/abstractions/form-validation-errors.service";
import { FormValidationErrorsService } from "../platform/services/form-validation-errors.service";
import { LoggingErrorHandler } from "../platform/services/logging-error-handler";
import { AngularThemingService } from "../platform/services/theming/angular-theming.service";
import { AbstractThemingService } from "../platform/services/theming/theming.service.abstraction";
import { safeProvider, SafeProvider } from "../platform/utils/safe-provider";

import {
  LOCALES_DIRECTORY,
  LOCKED_CALLBACK,
  LOGOUT_CALLBACK,
  LOG_MAC_FAILURES,
  MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  SafeInjectionToken,
  SECURE_STORAGE,
  STATE_FACTORY,
  SUPPORTS_SECURE_STORAGE,
  SYSTEM_LANGUAGE,
  SYSTEM_THEME_OBSERVABLE,
  WINDOW,
  DEFAULT_VAULT_TIMEOUT,
  INTRAPROCESS_MESSAGING_SUBJECT,
  CLIENT_TYPE,
  REFRESH_ACCESS_TOKEN_ERROR_CALLBACK,
} from "./injection-tokens";
import { ModalService } from "./modal.service";

/**
 * Provider definitions used in the ngModule.
 * Add your provider definition here using the safeProvider function as a wrapper. This will give you type safety.
 * If you need help please ask for it, do NOT change the type of this array.
 */
const safeProviders: SafeProvider[] = [
  safeProvider(AuthGuard),
  safeProvider(UnauthGuard),
  safeProvider(ModalService),
  safeProvider(PasswordRepromptService),
  safeProvider({ provide: WINDOW, useValue: window }),
  safeProvider({
    provide: LOCALE_ID as SafeInjectionToken<string>,
    useFactory: (i18nService: I18nServiceAbstraction) => i18nService.translationLocale,
    deps: [I18nServiceAbstraction],
  }),
  safeProvider({
    provide: SUPPORTS_SECURE_STORAGE,
    useFactory: (platformUtilsService: PlatformUtilsServiceAbstraction) =>
      platformUtilsService.supportsSecureStorage(),
    deps: [PlatformUtilsServiceAbstraction],
  }),
  safeProvider({
    provide: LOCALES_DIRECTORY,
    useValue: "./locales",
  }),
  safeProvider({
    provide: SYSTEM_LANGUAGE,
    useFactory: (window: Window) => window.navigator.language,
    deps: [WINDOW],
  }),
  safeProvider({
    provide: STATE_FACTORY,
    useValue: new StateFactory(GlobalState, Account),
  }),
  safeProvider({
    provide: LOGOUT_CALLBACK,
    useFactory:
      (messagingService: MessagingServiceAbstraction) =>
      async (logoutReason: LogoutReason, userId?: string) => {
        return Promise.resolve(
          messagingService.send("logout", { logoutReason: logoutReason, userId: userId }),
        );
      },
    deps: [MessagingServiceAbstraction],
  }),
  safeProvider({
    provide: LOCKED_CALLBACK,
    useValue: null,
  }),
  safeProvider({
    provide: LOG_MAC_FAILURES,
    useValue: true,
  }),
  safeProvider({
    provide: SYSTEM_THEME_OBSERVABLE,
    useFactory: (window: Window) => AngularThemingService.createSystemThemeFromWindow(window),
    deps: [WINDOW],
  }),
  safeProvider({
    provide: ThemeStateService,
    useClass: DefaultThemeStateService,
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: AbstractThemingService,
    useClass: AngularThemingService,
    deps: [ThemeStateService, SYSTEM_THEME_OBSERVABLE],
  }),
  safeProvider({
    provide: AppIdServiceAbstraction,
    useClass: AppIdService,
    deps: [GlobalStateProvider],
  }),
  safeProvider({
    provide: AuditServiceAbstraction,
    useClass: AuditService,
    deps: [CryptoFunctionServiceAbstraction, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: AuthServiceAbstraction,
    useClass: AuthService,
    deps: [
      AccountServiceAbstraction,
      MessagingServiceAbstraction,
      CryptoServiceAbstraction,
      ApiServiceAbstraction,
      StateServiceAbstraction,
      TokenServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: LoginStrategyServiceAbstraction,
    useClass: LoginStrategyService,
    deps: [
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      CryptoServiceAbstraction,
      ApiServiceAbstraction,
      TokenServiceAbstraction,
      AppIdServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      MessagingServiceAbstraction,
      LogService,
      KeyConnectorServiceAbstraction,
      EnvironmentService,
      StateServiceAbstraction,
      TwoFactorServiceAbstraction,
      I18nServiceAbstraction,
      EncryptService,
      PasswordStrengthServiceAbstraction,
      PolicyServiceAbstraction,
      DeviceTrustServiceAbstraction,
      AuthRequestServiceAbstraction,
      InternalUserDecryptionOptionsServiceAbstraction,
      GlobalStateProvider,
      BillingAccountProfileStateService,
      VaultTimeoutSettingsServiceAbstraction,
      KdfConfigServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: FileUploadServiceAbstraction,
    useClass: FileUploadService,
    deps: [LogService],
  }),
  safeProvider({
    provide: CipherFileUploadServiceAbstraction,
    useClass: CipherFileUploadService,
    deps: [ApiServiceAbstraction, FileUploadServiceAbstraction],
  }),
  safeProvider({
    provide: CipherServiceAbstraction,
    useFactory: (
      cryptoService: CryptoServiceAbstraction,
      domainSettingsService: DomainSettingsService,
      apiService: ApiServiceAbstraction,
      i18nService: I18nServiceAbstraction,
      searchService: SearchServiceAbstraction,
      stateService: StateServiceAbstraction,
      autofillSettingsService: AutofillSettingsServiceAbstraction,
      encryptService: EncryptService,
      fileUploadService: CipherFileUploadServiceAbstraction,
      configService: ConfigService,
      stateProvider: StateProvider,
    ) =>
      new CipherService(
        cryptoService,
        domainSettingsService,
        apiService,
        i18nService,
        searchService,
        stateService,
        autofillSettingsService,
        encryptService,
        fileUploadService,
        configService,
        stateProvider,
      ),
    deps: [
      CryptoServiceAbstraction,
      DomainSettingsService,
      ApiServiceAbstraction,
      I18nServiceAbstraction,
      SearchServiceAbstraction,
      StateServiceAbstraction,
      AutofillSettingsServiceAbstraction,
      EncryptService,
      CipherFileUploadServiceAbstraction,
      ConfigService,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: InternalFolderService,
    useClass: FolderService,
    deps: [
      CryptoServiceAbstraction,
      I18nServiceAbstraction,
      CipherServiceAbstraction,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: FolderServiceAbstraction,
    useExisting: InternalFolderService,
  }),
  safeProvider({
    provide: FolderApiServiceAbstraction,
    useClass: FolderApiService,
    deps: [InternalFolderService, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: AccountApiServiceAbstraction,
    useClass: AccountApiServiceImplementation,
    deps: [
      ApiServiceAbstraction,
      UserVerificationServiceAbstraction,
      LogService,
      InternalAccountService,
      EnvironmentService,
    ],
  }),
  safeProvider({
    provide: InternalAccountService,
    useClass: AccountServiceImplementation,
    deps: [MessagingServiceAbstraction, LogService, GlobalStateProvider],
  }),
  safeProvider({
    provide: AccountServiceAbstraction,
    useExisting: InternalAccountService,
  }),
  safeProvider({
    provide: AvatarServiceAbstraction,
    useClass: AvatarService,
    deps: [ApiServiceAbstraction, StateProvider],
  }),
  safeProvider({ provide: LogService, useFactory: () => new ConsoleLogService(false), deps: [] }),
  safeProvider({
    provide: CollectionServiceAbstraction,
    useClass: CollectionService,
    deps: [CryptoServiceAbstraction, I18nServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: EnvironmentService,
    useClass: DefaultEnvironmentService,
    deps: [StateProvider, AccountServiceAbstraction],
  }),
  safeProvider({
    provide: InternalUserDecryptionOptionsServiceAbstraction,
    useClass: UserDecryptionOptionsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: UserDecryptionOptionsServiceAbstraction,
    useExisting: InternalUserDecryptionOptionsServiceAbstraction,
  }),
  safeProvider({
    provide: TotpServiceAbstraction,
    useClass: TotpService,
    deps: [CryptoFunctionServiceAbstraction, LogService],
  }),
  safeProvider({
    provide: TokenServiceAbstraction,
    useClass: TokenService,
    deps: [
      SingleUserStateProvider,
      GlobalStateProvider,
      SUPPORTS_SECURE_STORAGE,
      SECURE_STORAGE,
      KeyGenerationServiceAbstraction,
      EncryptService,
      LogService,
      LOGOUT_CALLBACK,
    ],
  }),
  safeProvider({
    provide: KeyGenerationServiceAbstraction,
    useClass: KeyGenerationService,
    deps: [CryptoFunctionServiceAbstraction],
  }),
  safeProvider({
    provide: CryptoServiceAbstraction,
    useClass: CryptoService,
    deps: [
      PinServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      KeyGenerationServiceAbstraction,
      CryptoFunctionServiceAbstraction,
      EncryptService,
      PlatformUtilsServiceAbstraction,
      LogService,
      StateServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
      KdfConfigServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: PasswordStrengthServiceAbstraction,
    useClass: PasswordStrengthService,
    deps: [],
  }),
  safeProvider({
    provide: PasswordGenerationServiceAbstraction,
    useFactory: legacyPasswordGenerationServiceFactory,
    deps: [
      EncryptService,
      CryptoServiceAbstraction,
      PolicyServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: UsernameGenerationServiceAbstraction,
    useFactory: legacyUsernameGenerationServiceFactory,
    deps: [
      ApiServiceAbstraction,
      I18nServiceAbstraction,
      CryptoServiceAbstraction,
      EncryptService,
      PolicyServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: REFRESH_ACCESS_TOKEN_ERROR_CALLBACK,
    useFactory: (toastService: ToastService, i18nService: I18nServiceAbstraction) => () => {
      toastService.showToast({
        variant: "error",
        title: i18nService.t("errorRefreshingAccessToken"),
        message: i18nService.t("errorRefreshingAccessTokenDesc"),
      });
    },
    deps: [ToastService, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: ApiServiceAbstraction,
    useClass: ApiService,
    deps: [
      TokenServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      EnvironmentService,
      AppIdServiceAbstraction,
      REFRESH_ACCESS_TOKEN_ERROR_CALLBACK,
      LogService,
      LOGOUT_CALLBACK,
      VaultTimeoutSettingsServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: SendServiceAbstraction,
    useExisting: InternalSendService,
  }),
  safeProvider({
    provide: InternalSendService,
    useClass: SendService,
    deps: [
      CryptoServiceAbstraction,
      I18nServiceAbstraction,
      KeyGenerationServiceAbstraction,
      SendStateProviderAbstraction,
      EncryptService,
    ],
  }),
  safeProvider({
    provide: SendStateProviderAbstraction,
    useClass: SendStateProvider,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: SendApiServiceAbstraction,
    useClass: SendApiService,
    deps: [ApiServiceAbstraction, FileUploadServiceAbstraction, InternalSendService],
  }),
  safeProvider({
    provide: SyncService,
    useClass: DefaultSyncService,
    deps: [
      InternalMasterPasswordServiceAbstraction,
      AccountServiceAbstraction,
      ApiServiceAbstraction,
      DomainSettingsService,
      InternalFolderService,
      CipherServiceAbstraction,
      CryptoServiceAbstraction,
      CollectionServiceAbstraction,
      MessagingServiceAbstraction,
      InternalPolicyService,
      InternalSendService,
      LogService,
      KeyConnectorServiceAbstraction,
      StateServiceAbstraction,
      ProviderServiceAbstraction,
      FolderApiServiceAbstraction,
      InternalOrganizationServiceAbstraction,
      SendApiServiceAbstraction,
      UserDecryptionOptionsServiceAbstraction,
      AvatarServiceAbstraction,
      LOGOUT_CALLBACK,
      BillingAccountProfileStateService,
      TokenServiceAbstraction,
      AuthServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: BroadcasterService,
    useClass: DefaultBroadcasterService,
    deps: [MessageListener],
  }),
  safeProvider({
    provide: VaultTimeoutSettingsServiceAbstraction,
    useClass: VaultTimeoutSettingsService,
    deps: [
      AccountServiceAbstraction,
      PinServiceAbstraction,
      UserDecryptionOptionsServiceAbstraction,
      CryptoServiceAbstraction,
      TokenServiceAbstraction,
      PolicyServiceAbstraction,
      BiometricStateService,
      StateProvider,
      LogService,
      DEFAULT_VAULT_TIMEOUT,
    ],
  }),
  safeProvider({
    provide: VaultTimeoutService,
    useClass: VaultTimeoutService,
    deps: [
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      CipherServiceAbstraction,
      FolderServiceAbstraction,
      CollectionServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      MessagingServiceAbstraction,
      SearchServiceAbstraction,
      StateServiceAbstraction,
      AuthServiceAbstraction,
      VaultTimeoutSettingsServiceAbstraction,
      StateEventRunnerService,
      LOCKED_CALLBACK,
      LOGOUT_CALLBACK,
    ],
  }),
  safeProvider({
    provide: VaultTimeoutServiceAbstraction,
    useExisting: VaultTimeoutService,
  }),
  safeProvider({
    provide: SsoLoginServiceAbstraction,
    useClass: SsoLoginService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: StateServiceAbstraction,
    useClass: StateService,
    deps: [
      AbstractStorageService,
      SECURE_STORAGE,
      MEMORY_STORAGE,
      LogService,
      STATE_FACTORY,
      AccountServiceAbstraction,
      EnvironmentService,
      TokenServiceAbstraction,
      MigrationRunner,
    ],
  }),
  safeProvider({
    provide: ImportApiServiceAbstraction,
    useClass: ImportApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: ImportServiceAbstraction,
    useClass: ImportService,
    deps: [
      CipherServiceAbstraction,
      FolderServiceAbstraction,
      ImportApiServiceAbstraction,
      I18nServiceAbstraction,
      CollectionServiceAbstraction,
      CryptoServiceAbstraction,
      PinServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: IndividualVaultExportServiceAbstraction,
    useClass: IndividualVaultExportService,
    deps: [
      FolderServiceAbstraction,
      CipherServiceAbstraction,
      PinServiceAbstraction,
      CryptoServiceAbstraction,
      CryptoFunctionServiceAbstraction,
      KdfConfigServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: OrganizationVaultExportServiceAbstraction,
    useClass: OrganizationVaultExportService,
    deps: [
      CipherServiceAbstraction,
      ApiServiceAbstraction,
      PinServiceAbstraction,
      CryptoServiceAbstraction,
      CryptoFunctionServiceAbstraction,
      CollectionServiceAbstraction,
      KdfConfigServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: VaultExportServiceAbstraction,
    useClass: VaultExportService,
    deps: [IndividualVaultExportServiceAbstraction, OrganizationVaultExportServiceAbstraction],
  }),
  safeProvider({
    provide: SearchServiceAbstraction,
    useClass: SearchService,
    deps: [LogService, I18nServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: NotificationsServiceAbstraction,
    useClass: devFlagEnabled("noopNotifications") ? NoopNotificationsService : NotificationsService,
    deps: [
      LogService,
      SyncService,
      AppIdServiceAbstraction,
      ApiServiceAbstraction,
      EnvironmentService,
      LOGOUT_CALLBACK,
      StateServiceAbstraction,
      AuthServiceAbstraction,
      MessagingServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: CryptoFunctionServiceAbstraction,
    useClass: WebCryptoFunctionService,
    deps: [WINDOW],
  }),
  safeProvider({
    provide: EncryptService,
    useFactory: encryptServiceFactory,
    deps: [CryptoFunctionServiceAbstraction, LogService, LOG_MAC_FAILURES],
  }),
  safeProvider({
    provide: EventUploadServiceAbstraction,
    useClass: EventUploadService,
    deps: [ApiServiceAbstraction, StateProvider, LogService, AuthServiceAbstraction],
  }),
  safeProvider({
    provide: EventCollectionServiceAbstraction,
    useClass: EventCollectionService,
    deps: [
      CipherServiceAbstraction,
      StateProvider,
      OrganizationServiceAbstraction,
      EventUploadServiceAbstraction,
      AuthServiceAbstraction,
      AccountServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: InternalPolicyService,
    useClass: PolicyService,
    deps: [StateProvider, OrganizationServiceAbstraction],
  }),
  safeProvider({
    provide: PolicyServiceAbstraction,
    useExisting: InternalPolicyService,
  }),
  safeProvider({
    provide: PolicyApiServiceAbstraction,
    useClass: PolicyApiService,
    deps: [InternalPolicyService, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: InternalMasterPasswordServiceAbstraction,
    useClass: MasterPasswordService,
    deps: [StateProvider, StateServiceAbstraction, KeyGenerationServiceAbstraction, EncryptService],
  }),
  safeProvider({
    provide: MasterPasswordServiceAbstraction,
    useExisting: InternalMasterPasswordServiceAbstraction,
  }),
  safeProvider({
    provide: KeyConnectorServiceAbstraction,
    useClass: KeyConnectorService,
    deps: [
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      CryptoServiceAbstraction,
      ApiServiceAbstraction,
      TokenServiceAbstraction,
      LogService,
      OrganizationServiceAbstraction,
      KeyGenerationServiceAbstraction,
      LOGOUT_CALLBACK,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: UserVerificationServiceAbstraction,
    useClass: UserVerificationService,
    deps: [
      CryptoServiceAbstraction,
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      I18nServiceAbstraction,
      UserVerificationApiServiceAbstraction,
      UserDecryptionOptionsServiceAbstraction,
      PinServiceAbstraction,
      LogService,
      VaultTimeoutSettingsServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      KdfConfigServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: InternalOrganizationServiceAbstraction,
    useClass: OrganizationService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: OrganizationServiceAbstraction,
    useExisting: InternalOrganizationServiceAbstraction,
  }),
  safeProvider({
    provide: OrganizationUserService,
    useClass: OrganizationUserServiceImplementation,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: PasswordResetEnrollmentServiceAbstraction,
    useClass: PasswordResetEnrollmentServiceImplementation,
    deps: [
      OrganizationApiServiceAbstraction,
      AccountServiceAbstraction,
      CryptoServiceAbstraction,
      OrganizationUserService,
      I18nServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: ProviderServiceAbstraction,
    useClass: ProviderService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: TwoFactorServiceAbstraction,
    useClass: TwoFactorService,
    deps: [I18nServiceAbstraction, PlatformUtilsServiceAbstraction, GlobalStateProvider],
  }),
  safeProvider({
    provide: FormValidationErrorsServiceAbstraction,
    useClass: FormValidationErrorsService,
    deps: [],
  }),
  safeProvider({
    provide: UserVerificationApiServiceAbstraction,
    useClass: UserVerificationApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: OrganizationApiServiceAbstraction,
    useClass: OrganizationApiService,
    // This is a slightly odd dependency tree for a specialized api service
    // it depends on SyncService so that new data can be retrieved through the sync
    // rather than updating the OrganizationService directly. Instead OrganizationService
    // subscribes to sync notifications and will update itself based on that.
    deps: [ApiServiceAbstraction, SyncService],
  }),
  safeProvider({
    provide: DefaultConfigService,
    useClass: DefaultConfigService,
    deps: [ConfigApiServiceAbstraction, EnvironmentService, LogService, StateProvider],
  }),
  safeProvider({
    provide: ConfigService,
    useExisting: DefaultConfigService,
  }),
  safeProvider({
    provide: ConfigApiServiceAbstraction,
    useClass: ConfigApiService,
    deps: [ApiServiceAbstraction, TokenServiceAbstraction],
  }),
  safeProvider({
    provide: AnonymousHubServiceAbstraction,
    useClass: AnonymousHubService,
    deps: [EnvironmentService, AuthRequestServiceAbstraction],
  }),
  safeProvider({
    provide: ValidationServiceAbstraction,
    useClass: ValidationService,
    deps: [I18nServiceAbstraction, PlatformUtilsServiceAbstraction],
  }),
  safeProvider({
    provide: LoginEmailServiceAbstraction,
    useClass: LoginEmailService,
    deps: [AccountServiceAbstraction, AuthServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: OrgDomainInternalServiceAbstraction,
    useClass: OrgDomainService,
    deps: [PlatformUtilsServiceAbstraction, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: OrgDomainServiceAbstraction,
    useExisting: OrgDomainInternalServiceAbstraction,
  }),
  safeProvider({
    provide: OrgDomainApiServiceAbstraction,
    useClass: OrgDomainApiService,
    deps: [OrgDomainInternalServiceAbstraction, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: DevicesApiServiceAbstraction,
    useClass: DevicesApiServiceImplementation,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: DevicesServiceAbstraction,
    useClass: DevicesServiceImplementation,
    deps: [DevicesApiServiceAbstraction],
  }),
  safeProvider({
    provide: DeviceTrustServiceAbstraction,
    useClass: DeviceTrustService,
    deps: [
      KeyGenerationServiceAbstraction,
      CryptoFunctionServiceAbstraction,
      CryptoServiceAbstraction,
      EncryptService,
      AppIdServiceAbstraction,
      DevicesApiServiceAbstraction,
      I18nServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      StateProvider,
      SECURE_STORAGE,
      UserDecryptionOptionsServiceAbstraction,
      LogService,
    ],
  }),
  safeProvider({
    provide: AuthRequestServiceAbstraction,
    useClass: AuthRequestService,
    deps: [
      AppIdServiceAbstraction,
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      CryptoServiceAbstraction,
      ApiServiceAbstraction,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: PinServiceAbstraction,
    useClass: PinService,
    deps: [
      AccountServiceAbstraction,
      CryptoFunctionServiceAbstraction,
      EncryptService,
      KdfConfigServiceAbstraction,
      KeyGenerationServiceAbstraction,
      LogService,
      MasterPasswordServiceAbstraction,
      StateProvider,
      StateServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: WebAuthnLoginPrfCryptoServiceAbstraction,
    useClass: WebAuthnLoginPrfCryptoService,
    deps: [CryptoFunctionServiceAbstraction],
  }),
  safeProvider({
    provide: WebAuthnLoginApiServiceAbstraction,
    useClass: WebAuthnLoginApiService,
    deps: [ApiServiceAbstraction, EnvironmentService],
  }),
  safeProvider({
    provide: WebAuthnLoginServiceAbstraction,
    useClass: WebAuthnLoginService,
    deps: [
      WebAuthnLoginApiServiceAbstraction,
      LoginStrategyServiceAbstraction,
      WebAuthnLoginPrfCryptoServiceAbstraction,
      WINDOW,
      LogService,
    ],
  }),
  safeProvider({
    provide: StorageServiceProvider,
    useClass: StorageServiceProvider,
    deps: [OBSERVABLE_DISK_STORAGE, OBSERVABLE_MEMORY_STORAGE],
  }),
  safeProvider({
    provide: StateEventRegistrarService,
    useClass: StateEventRegistrarService,
    deps: [GlobalStateProvider, StorageServiceProvider],
  }),
  safeProvider({
    provide: StateEventRunnerService,
    useClass: StateEventRunnerService,
    deps: [GlobalStateProvider, StorageServiceProvider],
  }),
  safeProvider({
    provide: GlobalStateProvider,
    useClass: DefaultGlobalStateProvider,
    deps: [StorageServiceProvider],
  }),
  safeProvider({
    provide: ActiveUserStateProvider,
    useClass: DefaultActiveUserStateProvider,
    deps: [AccountServiceAbstraction, SingleUserStateProvider],
  }),
  safeProvider({
    provide: SingleUserStateProvider,
    useClass: DefaultSingleUserStateProvider,
    deps: [StorageServiceProvider, StateEventRegistrarService],
  }),
  safeProvider({
    provide: DerivedStateProvider,
    useClass: DefaultDerivedStateProvider,
    deps: [],
  }),
  safeProvider({
    provide: StateProvider,
    useClass: DefaultStateProvider,
    deps: [
      ActiveUserStateProvider,
      SingleUserStateProvider,
      GlobalStateProvider,
      DerivedStateProvider,
    ],
  }),
  safeProvider({
    provide: OrganizationBillingServiceAbstraction,
    useClass: OrganizationBillingService,
    deps: [
      ApiServiceAbstraction,
      CryptoServiceAbstraction,
      EncryptService,
      I18nServiceAbstraction,
      OrganizationApiServiceAbstraction,
      SyncService,
    ],
  }),
  safeProvider({
    provide: AutofillSettingsServiceAbstraction,
    useClass: AutofillSettingsService,
    deps: [StateProvider, PolicyServiceAbstraction],
  }),
  safeProvider({
    provide: BadgeSettingsServiceAbstraction,
    useClass: BadgeSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: DomainSettingsService,
    useClass: DefaultDomainSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: BiometricStateService,
    useClass: DefaultBiometricStateService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: VaultSettingsServiceAbstraction,
    useClass: VaultSettingsService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: MigrationRunner,
    useClass: MigrationRunner,
    deps: [AbstractStorageService, LogService, MigrationBuilderService, CLIENT_TYPE],
  }),
  safeProvider({
    provide: MigrationBuilderService,
    useClass: MigrationBuilderService,
    deps: [],
  }),
  safeProvider({
    provide: BillingApiServiceAbstraction,
    useClass: BillingApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: PaymentMethodWarningsServiceAbstraction,
    useClass: PaymentMethodWarningsService,
    deps: [BillingApiServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: BillingAccountProfileStateService,
    useClass: DefaultBillingAccountProfileStateService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: OrganizationManagementPreferencesService,
    useClass: DefaultOrganizationManagementPreferencesService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: UserAutoUnlockKeyService,
    useClass: UserAutoUnlockKeyService,
    deps: [CryptoServiceAbstraction],
  }),
  safeProvider({
    provide: ErrorHandler,
    useClass: LoggingErrorHandler,
    deps: [],
  }),
  safeProvider({
    provide: INTRAPROCESS_MESSAGING_SUBJECT,
    useFactory: () => new Subject<Message<Record<string, unknown>>>(),
    deps: [],
  }),
  safeProvider({
    provide: MessageListener,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>) =>
      new MessageListener(subject.asObservable()),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT],
  }),
  safeProvider({
    provide: MessageSender,
    useFactory: (subject: Subject<Message<Record<string, unknown>>>) =>
      new SubjectMessageSender(subject),
    deps: [INTRAPROCESS_MESSAGING_SUBJECT],
  }),
  safeProvider({
    provide: ProviderApiServiceAbstraction,
    useClass: ProviderApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: KdfConfigServiceAbstraction,
    useClass: KdfConfigService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: BraintreeServiceAbstraction,
    useClass: BraintreeService,
    deps: [LogService],
  }),
  safeProvider({
    provide: StripeServiceAbstraction,
    useClass: StripeService,
    deps: [LogService],
  }),
];

function encryptServiceFactory(
  cryptoFunctionservice: CryptoFunctionServiceAbstraction,
  logService: LogService,
  logMacFailures: boolean,
): EncryptService {
  return flagEnabled("multithreadDecryption")
    ? new MultithreadEncryptServiceImplementation(cryptoFunctionservice, logService, logMacFailures)
    : new EncryptServiceImplementation(cryptoFunctionservice, logService, logMacFailures);
}

@NgModule({
  declarations: [],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class JslibServicesModule {}
