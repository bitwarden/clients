import { LOCALE_ID, NgModule } from "@angular/core";

import {
  PinCryptoServiceAbstraction,
  PinCryptoService,
  LoginStrategyServiceAbstraction,
  LoginStrategyService,
} from "@bitwarden/auth/common";
import { AvatarUpdateService as AccountUpdateServiceAbstraction } from "@bitwarden/common/abstractions/account/avatar-update.service";
import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService as EventCollectionServiceAbstraction } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
import { NotificationsService as NotificationsServiceAbstraction } from "@bitwarden/common/abstractions/notifications.service";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/abstractions/search.service";
import { SettingsService as SettingsServiceAbstraction } from "@bitwarden/common/abstractions/settings.service";
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
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import {
  InternalPolicyService,
  PolicyService as PolicyServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService as ProviderServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/services/organization/organization.service";
import { OrgDomainApiService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain-api.service";
import { OrgDomainService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain.service";
import { OrganizationUserServiceImplementation } from "@bitwarden/common/admin-console/services/organization-user/organization-user.service.implementation";
import { PolicyApiService } from "@bitwarden/common/admin-console/services/policy/policy-api.service";
import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { ProviderService } from "@bitwarden/common/admin-console/services/provider.service";
import { AccountApiService as AccountApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/account-api.service";
import {
  AccountService as AccountServiceAbstraction,
  InternalAccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AnonymousHubService as AnonymousHubServiceAbstraction } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthRequestCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-crypto.service.abstraction";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { LoginService as LoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/login.service";
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
import { AuthRequestCryptoServiceImplementation } from "@bitwarden/common/auth/services/auth-request-crypto.service.implementation";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { DeviceTrustCryptoService } from "@bitwarden/common/auth/services/device-trust-crypto.service.implementation";
import { DevicesServiceImplementation } from "@bitwarden/common/auth/services/devices/devices.service.implementation";
import { DevicesApiServiceImplementation } from "@bitwarden/common/auth/services/devices-api.service.implementation";
import { KeyConnectorService } from "@bitwarden/common/auth/services/key-connector.service";
import { LoginService } from "@bitwarden/common/auth/services/login.service";
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
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billilng-api.service.abstraction";
import { BillingBannerServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-banner.service.abstraction";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-billing.service";
import { BillingApiService } from "@bitwarden/common/billing/services/billing-api.service";
import { BillingBannerService } from "@bitwarden/common/billing/services/billing-banner.service";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { AppIdService as AppIdServiceAbstraction } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService as BroadcasterServiceAbstraction } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService as CryptoServiceAbstraction } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService as EnvironmentServiceAbstraction } from "@bitwarden/common/platform/abstractions/environment.service";
import { FileUploadService as FileUploadServiceAbstraction } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
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
import { devFlagEnabled, flagEnabled } from "@bitwarden/common/platform/misc/flags";
import { Account } from "@bitwarden/common/platform/models/domain/account";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { CryptoService } from "@bitwarden/common/platform/services/crypto.service";
import { EncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/encrypt.service.implementation";
import { MultithreadEncryptServiceImplementation } from "@bitwarden/common/platform/services/cryptography/multithread-encrypt.service.implementation";
import { EnvironmentService } from "@bitwarden/common/platform/services/environment.service";
import { FileUploadService } from "@bitwarden/common/platform/services/file-upload/file-upload.service";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { NoopNotificationsService } from "@bitwarden/common/platform/services/noop-notifications.service";
import { StateService } from "@bitwarden/common/platform/services/state.service";
import { ValidationService } from "@bitwarden/common/platform/services/validation.service";
import { WebCryptoFunctionService } from "@bitwarden/common/platform/services/web-crypto-function.service";
import {
  ActiveUserStateProvider,
  DerivedStateProvider,
  GlobalStateProvider,
  SingleUserStateProvider,
  StateProvider,
} from "@bitwarden/common/platform/state";
/* eslint-disable import/no-restricted-paths -- We need the implementations to inject, but generally these should not be accessed */
import { DefaultActiveUserStateProvider } from "@bitwarden/common/platform/state/implementations/default-active-user-state.provider";
import { DefaultDerivedStateProvider } from "@bitwarden/common/platform/state/implementations/default-derived-state.provider";
import { DefaultGlobalStateProvider } from "@bitwarden/common/platform/state/implementations/default-global-state.provider";
import { DefaultSingleUserStateProvider } from "@bitwarden/common/platform/state/implementations/default-single-user-state.provider";
import { DefaultStateProvider } from "@bitwarden/common/platform/state/implementations/default-state.provider";
/* eslint-enable import/no-restricted-paths */
import { AvatarUpdateService } from "@bitwarden/common/services/account/avatar-update.service";
import { ApiService } from "@bitwarden/common/services/api.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { EventCollectionService } from "@bitwarden/common/services/event/event-collection.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
import { NotificationsService } from "@bitwarden/common/services/notifications.service";
import { SearchService } from "@bitwarden/common/services/search.service";
import { SettingsService } from "@bitwarden/common/services/settings.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/services/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/services/vault-timeout/vault-timeout.service";
import {
  PasswordGenerationService,
  PasswordGenerationServiceAbstraction,
} from "@bitwarden/common/tools/generator/password";
import {
  UsernameGenerationService,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/common/tools/generator/username";
import {
  PasswordStrengthService,
  PasswordStrengthServiceAbstraction,
} from "@bitwarden/common/tools/password-strength";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service";
import { SendService as SendServiceAbstraction } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService as CollectionServiceAbstraction } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherFileUploadService as CipherFileUploadServiceAbstraction } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import {
  FolderService as FolderServiceAbstraction,
  InternalFolderService,
} from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncNotifierService as SyncNotifierServiceAbstraction } from "@bitwarden/common/vault/abstractions/sync/sync-notifier.service.abstraction";
import { SyncService as SyncServiceAbstraction } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService as VaultSettingsServiceAbstraction } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/services/collection.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/services/file-upload/cipher-file-upload.service";
import { FolderApiService } from "@bitwarden/common/vault/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { SyncNotifierService } from "@bitwarden/common/vault/services/sync/sync-notifier.service";
import { SyncService } from "@bitwarden/common/vault/services/sync/sync.service";
import { TotpService } from "@bitwarden/common/vault/services/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/services/vault-settings/vault-settings.service";
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
import { BroadcasterService } from "../platform/services/broadcaster.service";
import { FormValidationErrorsService } from "../platform/services/form-validation-errors.service";
import { ThemingService } from "../platform/services/theming/theming.service";
import { AbstractThemingService } from "../platform/services/theming/theming.service.abstraction";

import {
  LOCALES_DIRECTORY,
  LOCKED_CALLBACK,
  LOG_MAC_FAILURES,
  LOGOUT_CALLBACK,
  MEMORY_STORAGE,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  SECURE_STORAGE,
  STATE_FACTORY,
  STATE_SERVICE_USE_CACHE,
  SYSTEM_LANGUAGE,
  WINDOW,
} from "./injection-tokens";
import { ModalService } from "./modal.service";

@NgModule({
  declarations: [],
  providers: [
    AuthGuard,
    UnauthGuard,
    ModalService,
    PasswordRepromptService,

    { provide: WINDOW, useValue: window },
    {
      provide: LOCALE_ID,
      useFactory: (i18nService: I18nServiceAbstraction) => i18nService.translationLocale,
      deps: [I18nServiceAbstraction],
    },
    {
      provide: LOCALES_DIRECTORY,
      useValue: "./locales",
    },
    {
      provide: SYSTEM_LANGUAGE,
      useFactory: (window: Window) => window.navigator.language,
      deps: [WINDOW],
    },
    {
      provide: STATE_FACTORY,
      useValue: new StateFactory(GlobalState, Account),
    },
    {
      provide: STATE_SERVICE_USE_CACHE,
      useValue: true,
    },
    {
      provide: LOGOUT_CALLBACK,
      useFactory:
        (messagingService: MessagingServiceAbstraction) => (expired: boolean, userId?: string) =>
          messagingService.send("logout", { expired: expired, userId: userId }),
      deps: [MessagingServiceAbstraction],
    },
    {
      provide: LOCKED_CALLBACK,
      useValue: null,
    },
    {
      provide: LOG_MAC_FAILURES,
      useValue: true,
    },
    {
      provide: AppIdServiceAbstraction,
      useClass: AppIdService,
      deps: [AbstractStorageService],
    },
    {
      provide: AuditServiceAbstraction,
      useClass: AuditService,
      deps: [CryptoFunctionServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: AuthServiceAbstraction,
      useClass: AuthService,
      deps: [
        MessagingServiceAbstraction,
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        StateServiceAbstraction,
      ],
    },
    {
      provide: LoginStrategyServiceAbstraction,
      useClass: LoginStrategyService,
      deps: [
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        TokenServiceAbstraction,
        AppIdServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        MessagingServiceAbstraction,
        LogService,
        KeyConnectorServiceAbstraction,
        EnvironmentServiceAbstraction,
        StateServiceAbstraction,
        TwoFactorServiceAbstraction,
        I18nServiceAbstraction,
        EncryptService,
        PasswordStrengthServiceAbstraction,
        PolicyServiceAbstraction,
        DeviceTrustCryptoServiceAbstraction,
        AuthRequestCryptoServiceAbstraction,
      ],
    },
    {
      provide: FileUploadServiceAbstraction,
      useClass: FileUploadService,
      deps: [LoginServiceAbstraction],
    },
    {
      provide: CipherFileUploadServiceAbstraction,
      useClass: CipherFileUploadService,
      deps: [ApiServiceAbstraction, FileUploadServiceAbstraction],
    },
    {
      provide: CipherServiceAbstraction,
      useFactory: (
        cryptoService: CryptoServiceAbstraction,
        settingsService: SettingsServiceAbstraction,
        apiService: ApiServiceAbstraction,
        i18nService: I18nServiceAbstraction,
        searchService: SearchServiceAbstraction,
        stateService: StateServiceAbstraction,
        autofillSettingsService: AutofillSettingsServiceAbstraction,
        encryptService: EncryptService,
        fileUploadService: CipherFileUploadServiceAbstraction,
        configService: ConfigServiceAbstraction,
      ) =>
        new CipherService(
          cryptoService,
          settingsService,
          apiService,
          i18nService,
          searchService,
          stateService,
          autofillSettingsService,
          encryptService,
          fileUploadService,
          configService,
        ),
      deps: [
        CryptoServiceAbstraction,
        SettingsServiceAbstraction,
        ApiServiceAbstraction,
        I18nServiceAbstraction,
        SearchServiceAbstraction,
        StateServiceAbstraction,
        AutofillSettingsServiceAbstraction,
        EncryptService,
        CipherFileUploadServiceAbstraction,
        ConfigServiceAbstraction,
      ],
    },
    {
      provide: FolderServiceAbstraction,
      useClass: FolderService,
      deps: [
        CryptoServiceAbstraction,
        I18nServiceAbstraction,
        CipherServiceAbstraction,
        StateServiceAbstraction,
        StateProvider,
      ],
    },
    {
      provide: InternalFolderService,
      useExisting: FolderServiceAbstraction,
    },
    {
      provide: FolderApiServiceAbstraction,
      useClass: FolderApiService,
      deps: [FolderServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: AccountApiServiceAbstraction,
      useClass: AccountApiServiceImplementation,
      deps: [
        ApiServiceAbstraction,
        UserVerificationServiceAbstraction,
        LogService,
        InternalAccountService,
      ],
    },
    {
      provide: AccountServiceAbstraction,
      useClass: AccountServiceImplementation,
      deps: [MessagingServiceAbstraction, LogService, GlobalStateProvider],
    },
    {
      provide: InternalAccountService,
      useExisting: AccountServiceAbstraction,
    },
    {
      provide: AccountUpdateServiceAbstraction,
      useClass: AvatarUpdateService,
      deps: [ApiServiceAbstraction, StateServiceAbstraction],
    },
    { provide: LogService, useFactory: () => new ConsoleLogService(false) },
    {
      provide: CollectionServiceAbstraction,
      useClass: CollectionService,
      deps: [CryptoServiceAbstraction, I18nServiceAbstraction, StateProvider],
    },
    {
      provide: EnvironmentServiceAbstraction,
      useClass: EnvironmentService,
      deps: [StateProvider, AccountServiceAbstraction],
    },
    {
      provide: TotpServiceAbstraction,
      useClass: TotpService,
      deps: [CryptoFunctionServiceAbstraction, LogService, StateServiceAbstraction],
    },
    { provide: TokenServiceAbstraction, useClass: TokenService, deps: [StateServiceAbstraction] },
    {
      provide: CryptoServiceAbstraction,
      useClass: CryptoService,
      deps: [
        CryptoFunctionServiceAbstraction,
        EncryptService,
        PlatformUtilsServiceAbstraction,
        LogService,
        StateServiceAbstraction,
        AccountServiceAbstraction,
        StateProvider,
      ],
    },
    {
      provide: PasswordStrengthServiceAbstraction,
      useClass: PasswordStrengthService,
      deps: [],
    },
    {
      provide: PasswordGenerationServiceAbstraction,
      useClass: PasswordGenerationService,
      deps: [CryptoServiceAbstraction, PolicyServiceAbstraction, StateServiceAbstraction],
    },
    {
      provide: UsernameGenerationServiceAbstraction,
      useClass: UsernameGenerationService,
      deps: [CryptoServiceAbstraction, StateServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: ApiServiceAbstraction,
      useClass: ApiService,
      deps: [
        TokenServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        EnvironmentServiceAbstraction,
        AppIdServiceAbstraction,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: SendServiceAbstraction,
      useClass: SendService,
      deps: [
        CryptoServiceAbstraction,
        I18nServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        StateServiceAbstraction,
      ],
    },
    {
      provide: SendApiServiceAbstraction,
      useClass: SendApiService,
      deps: [ApiServiceAbstraction, FileUploadServiceAbstraction, SendServiceAbstraction],
    },
    {
      provide: SyncServiceAbstraction,
      useClass: SyncService,
      deps: [
        ApiServiceAbstraction,
        SettingsServiceAbstraction,
        FolderServiceAbstraction,
        CipherServiceAbstraction,
        CryptoServiceAbstraction,
        CollectionServiceAbstraction,
        MessagingServiceAbstraction,
        PolicyServiceAbstraction,
        SendServiceAbstraction,
        LogService,
        KeyConnectorServiceAbstraction,
        StateServiceAbstraction,
        ProviderServiceAbstraction,
        FolderApiServiceAbstraction,
        OrganizationServiceAbstraction,
        SendApiServiceAbstraction,
        StateProvider,
        LOGOUT_CALLBACK,
      ],
    },
    { provide: BroadcasterServiceAbstraction, useClass: BroadcasterService },
    {
      provide: SettingsServiceAbstraction,
      useClass: SettingsService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: VaultTimeoutSettingsServiceAbstraction,
      useClass: VaultTimeoutSettingsService,
      deps: [
        CryptoServiceAbstraction,
        TokenServiceAbstraction,
        PolicyServiceAbstraction,
        StateServiceAbstraction,
        StateProvider,
      ],
    },
    {
      provide: VaultTimeoutService,
      useClass: VaultTimeoutService,
      deps: [
        CipherServiceAbstraction,
        FolderServiceAbstraction,
        CollectionServiceAbstraction,
        CryptoServiceAbstraction,
        PlatformUtilsServiceAbstraction,
        MessagingServiceAbstraction,
        SearchServiceAbstraction,
        StateServiceAbstraction,
        AuthServiceAbstraction,
        VaultTimeoutSettingsServiceAbstraction,
        LOCKED_CALLBACK,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: VaultTimeoutServiceAbstraction,
      useExisting: VaultTimeoutService,
    },
    {
      provide: SsoLoginServiceAbstraction,
      useClass: SsoLoginService,
      deps: [StateProvider],
    },
    {
      provide: StateServiceAbstraction,
      useClass: StateService,
      deps: [
        AbstractStorageService,
        SECURE_STORAGE,
        MEMORY_STORAGE,
        LogService,
        STATE_FACTORY,
        AccountServiceAbstraction,
        EnvironmentServiceAbstraction,
        MigrationRunner,
        STATE_SERVICE_USE_CACHE,
      ],
    },
    {
      provide: ImportApiServiceAbstraction,
      useClass: ImportApiService,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: ImportServiceAbstraction,
      useClass: ImportService,
      deps: [
        CipherServiceAbstraction,
        FolderServiceAbstraction,
        ImportApiServiceAbstraction,
        I18nServiceAbstraction,
        CollectionServiceAbstraction,
        CryptoServiceAbstraction,
      ],
    },
    {
      provide: IndividualVaultExportServiceAbstraction,
      useClass: IndividualVaultExportService,
      deps: [
        FolderServiceAbstraction,
        CipherServiceAbstraction,
        CryptoServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        StateServiceAbstraction,
      ],
    },
    {
      provide: OrganizationVaultExportServiceAbstraction,
      useClass: OrganizationVaultExportService,
      deps: [
        CipherServiceAbstraction,
        ApiServiceAbstraction,
        CryptoServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        StateServiceAbstraction,
        CollectionServiceAbstraction,
      ],
    },
    {
      provide: VaultExportServiceAbstraction,
      useClass: VaultExportService,
      deps: [IndividualVaultExportServiceAbstraction, OrganizationVaultExportServiceAbstraction],
    },
    {
      provide: SearchServiceAbstraction,
      useClass: SearchService,
      deps: [LogService, I18nServiceAbstraction],
    },
    {
      provide: NotificationsServiceAbstraction,
      useClass: devFlagEnabled("noopNotifications")
        ? NoopNotificationsService
        : NotificationsService,
      deps: [
        LogService,
        SyncServiceAbstraction,
        AppIdServiceAbstraction,
        ApiServiceAbstraction,
        EnvironmentServiceAbstraction,
        LOGOUT_CALLBACK,
        StateServiceAbstraction,
        AuthServiceAbstraction,
        MessagingServiceAbstraction,
      ],
    },
    {
      provide: CryptoFunctionServiceAbstraction,
      useClass: WebCryptoFunctionService,
      deps: [WINDOW],
    },
    {
      provide: EncryptService,
      useFactory: encryptServiceFactory,
      deps: [CryptoFunctionServiceAbstraction, LogService, LOG_MAC_FAILURES],
    },
    {
      provide: EventUploadServiceAbstraction,
      useClass: EventUploadService,
      deps: [ApiServiceAbstraction, StateServiceAbstraction, LogService],
    },
    {
      provide: EventCollectionServiceAbstraction,
      useClass: EventCollectionService,
      deps: [
        CipherServiceAbstraction,
        StateServiceAbstraction,
        OrganizationServiceAbstraction,
        EventUploadServiceAbstraction,
      ],
    },
    {
      provide: PolicyServiceAbstraction,
      useClass: PolicyService,
      deps: [StateServiceAbstraction, OrganizationServiceAbstraction],
    },
    {
      provide: InternalPolicyService,
      useExisting: PolicyServiceAbstraction,
    },
    {
      provide: PolicyApiServiceAbstraction,
      useClass: PolicyApiService,
      deps: [PolicyServiceAbstraction, ApiServiceAbstraction, StateServiceAbstraction],
    },
    {
      provide: KeyConnectorServiceAbstraction,
      useClass: KeyConnectorService,
      deps: [
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        ApiServiceAbstraction,
        TokenServiceAbstraction,
        LogService,
        OrganizationServiceAbstraction,
        CryptoFunctionServiceAbstraction,
        LOGOUT_CALLBACK,
      ],
    },
    {
      provide: UserVerificationServiceAbstraction,
      useClass: UserVerificationService,
      deps: [
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        I18nServiceAbstraction,
        UserVerificationApiServiceAbstraction,
        PinCryptoServiceAbstraction,
        LogService,
        VaultTimeoutSettingsServiceAbstraction,
        PlatformUtilsServiceAbstraction,
      ],
    },
    {
      provide: OrganizationServiceAbstraction,
      useClass: OrganizationService,
      deps: [StateServiceAbstraction, StateProvider],
    },
    {
      provide: InternalOrganizationServiceAbstraction,
      useExisting: OrganizationServiceAbstraction,
    },
    {
      provide: OrganizationUserService,
      useClass: OrganizationUserServiceImplementation,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: PasswordResetEnrollmentServiceAbstraction,
      useClass: PasswordResetEnrollmentServiceImplementation,
      deps: [
        OrganizationApiServiceAbstraction,
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        OrganizationUserService,
        I18nServiceAbstraction,
      ],
    },
    {
      provide: ProviderServiceAbstraction,
      useClass: ProviderService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: TwoFactorServiceAbstraction,
      useClass: TwoFactorService,
      deps: [I18nServiceAbstraction, PlatformUtilsServiceAbstraction],
    },
    {
      provide: AbstractThemingService,
      useClass: ThemingService,
    },
    {
      provide: FormValidationErrorsServiceAbstraction,
      useClass: FormValidationErrorsService,
    },
    {
      provide: UserVerificationApiServiceAbstraction,
      useClass: UserVerificationApiService,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: OrganizationApiServiceAbstraction,
      useClass: OrganizationApiService,
      // This is a slightly odd dependency tree for a specialized api service
      // it depends on SyncService so that new data can be retrieved through the sync
      // rather than updating the OrganizationService directly. Instead OrganizationService
      // subscribes to sync notifications and will update itself based on that.
      deps: [ApiServiceAbstraction, SyncServiceAbstraction],
    },
    {
      provide: SyncNotifierServiceAbstraction,
      useClass: SyncNotifierService,
    },
    {
      provide: ConfigService,
      useClass: ConfigService,
      deps: [
        StateServiceAbstraction,
        ConfigApiServiceAbstraction,
        AuthServiceAbstraction,
        EnvironmentServiceAbstraction,
        LogService,
      ],
    },
    {
      provide: ConfigServiceAbstraction,
      useExisting: ConfigService,
    },
    {
      provide: ConfigApiServiceAbstraction,
      useClass: ConfigApiService,
      deps: [ApiServiceAbstraction, AuthServiceAbstraction],
    },
    {
      provide: AnonymousHubServiceAbstraction,
      useClass: AnonymousHubService,
      deps: [EnvironmentServiceAbstraction, LoginStrategyServiceAbstraction, LogService],
    },
    {
      provide: ValidationServiceAbstraction,
      useClass: ValidationService,
      deps: [I18nServiceAbstraction, PlatformUtilsServiceAbstraction],
    },
    {
      provide: LoginServiceAbstraction,
      useClass: LoginService,
      deps: [StateServiceAbstraction],
    },
    {
      provide: OrgDomainServiceAbstraction,
      useClass: OrgDomainService,
      deps: [PlatformUtilsServiceAbstraction, I18nServiceAbstraction],
    },
    {
      provide: OrgDomainInternalServiceAbstraction,
      useExisting: OrgDomainServiceAbstraction,
    },
    {
      provide: OrgDomainApiServiceAbstraction,
      useClass: OrgDomainApiService,
      deps: [OrgDomainServiceAbstraction, ApiServiceAbstraction],
    },
    {
      provide: DevicesApiServiceAbstraction,
      useClass: DevicesApiServiceImplementation,
      deps: [ApiServiceAbstraction],
    },
    {
      provide: DevicesServiceAbstraction,
      useClass: DevicesServiceImplementation,
      deps: [DevicesApiServiceAbstraction],
    },
    {
      provide: DeviceTrustCryptoServiceAbstraction,
      useClass: DeviceTrustCryptoService,
      deps: [
        CryptoFunctionServiceAbstraction,
        CryptoServiceAbstraction,
        EncryptService,
        StateServiceAbstraction,
        AppIdServiceAbstraction,
        DevicesApiServiceAbstraction,
        I18nServiceAbstraction,
        PlatformUtilsServiceAbstraction,
      ],
    },
    {
      provide: AuthRequestCryptoServiceAbstraction,
      useClass: AuthRequestCryptoServiceImplementation,
      deps: [CryptoServiceAbstraction],
    },
    {
      provide: PinCryptoServiceAbstraction,
      useClass: PinCryptoService,
      deps: [
        StateServiceAbstraction,
        CryptoServiceAbstraction,
        VaultTimeoutSettingsServiceAbstraction,
        LogService,
      ],
    },

    {
      provide: WebAuthnLoginPrfCryptoServiceAbstraction,
      useClass: WebAuthnLoginPrfCryptoService,
      deps: [CryptoFunctionServiceAbstraction],
    },
    {
      provide: WebAuthnLoginApiServiceAbstraction,
      useClass: WebAuthnLoginApiService,
      deps: [ApiServiceAbstraction, EnvironmentServiceAbstraction],
    },
    {
      provide: WebAuthnLoginServiceAbstraction,
      useClass: WebAuthnLoginService,
      deps: [
        WebAuthnLoginApiServiceAbstraction,
        LoginStrategyServiceAbstraction,
        WebAuthnLoginPrfCryptoServiceAbstraction,
        WINDOW,
        LogService,
      ],
    },
    {
      provide: GlobalStateProvider,
      useClass: DefaultGlobalStateProvider,
      deps: [OBSERVABLE_MEMORY_STORAGE, OBSERVABLE_DISK_STORAGE],
    },
    {
      provide: ActiveUserStateProvider,
      useClass: DefaultActiveUserStateProvider,
      deps: [AccountServiceAbstraction, OBSERVABLE_MEMORY_STORAGE, OBSERVABLE_DISK_STORAGE],
    },
    {
      provide: SingleUserStateProvider,
      useClass: DefaultSingleUserStateProvider,
      deps: [OBSERVABLE_MEMORY_STORAGE, OBSERVABLE_DISK_STORAGE],
    },
    {
      provide: DerivedStateProvider,
      useClass: DefaultDerivedStateProvider,
      deps: [OBSERVABLE_MEMORY_STORAGE],
    },
    {
      provide: StateProvider,
      useClass: DefaultStateProvider,
      deps: [
        ActiveUserStateProvider,
        SingleUserStateProvider,
        GlobalStateProvider,
        DerivedStateProvider,
      ],
    },
    {
      provide: BillingBannerServiceAbstraction,
      useClass: BillingBannerService,
      deps: [StateProvider],
    },
    {
      provide: OrganizationBillingServiceAbstraction,
      useClass: OrganizationBillingService,
      deps: [
        CryptoServiceAbstraction,
        EncryptService,
        I18nServiceAbstraction,
        OrganizationApiServiceAbstraction,
      ],
    },
    {
      provide: AutofillSettingsServiceAbstraction,
      useClass: AutofillSettingsService,
      deps: [StateProvider, PolicyServiceAbstraction],
    },
    {
      provide: BiometricStateService,
      useClass: DefaultBiometricStateService,
      deps: [StateProvider],
    },
    {
      provide: VaultSettingsServiceAbstraction,
      useClass: VaultSettingsService,
      deps: [StateProvider],
    },
    {
      provide: MigrationRunner,
      useClass: MigrationRunner,
      deps: [AbstractStorageService, LogService, MigrationBuilderService],
    },
    {
      provide: MigrationBuilderService,
      useClass: MigrationBuilderService,
    },
    {
      provide: BillingApiServiceAbstraction,
      useClass: BillingApiService,
      deps: [ApiServiceAbstraction],
    },
  ],
})
export class JslibServicesModule {}

function encryptServiceFactory(
  cryptoFunctionservice: CryptoFunctionServiceAbstraction,
  logService: LogService,
  logMacFailures: boolean,
): EncryptService {
  return flagEnabled("multithreadDecryption")
    ? new MultithreadEncryptServiceImplementation(cryptoFunctionservice, logService, logMacFailures)
    : new EncryptServiceImplementation(cryptoFunctionservice, logService, logMacFailures);
}
