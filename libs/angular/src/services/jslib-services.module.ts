// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ErrorHandler, LOCALE_ID, NgModule } from "@angular/core";
import { Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  CollectionService,
  DefaultCollectionService,
  DefaultOrganizationUserApiService,
  DefaultOrganizationUserService,
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import {
  ChangePasswordService,
  DefaultChangePasswordService,
} from "@bitwarden/angular/auth/password-management/change-password";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DefaultLoginComponentService,
  DefaultLoginDecryptionOptionsService,
  DefaultNewDeviceVerificationComponentService,
  DefaultRegistrationFinishService,
  DefaultTwoFactorAuthComponentService,
  DefaultTwoFactorAuthWebAuthnComponentService,
  LoginComponentService,
  LoginDecryptionOptionsService,
  NewDeviceVerificationComponentService,
  RegistrationFinishService as RegistrationFinishServiceAbstraction,
  TwoFactorAuthComponentService,
  TwoFactorAuthWebAuthnComponentService,
} from "@bitwarden/auth/angular";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AuthRequestApiServiceAbstraction,
  AuthRequestService,
  AuthRequestServiceAbstraction,
  DefaultAuthRequestApiService,
  DefaultLoginSuccessHandlerService,
  DefaultLogoutService,
  InternalUserDecryptionOptionsServiceAbstraction,
  LoginEmailService,
  LoginEmailServiceAbstraction,
  LoginStrategyService,
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  LogoutReason,
  LogoutService,
  UserDecryptionOptionsService,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService as ApiServiceAbstraction } from "@bitwarden/common/abstractions/api.service";
import { AuditService as AuditServiceAbstraction } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService as EventCollectionServiceAbstraction } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventUploadService as EventUploadServiceAbstraction } from "@bitwarden/common/abstractions/event/event-upload.service";
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
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import {
  InternalPolicyService,
  PolicyService as PolicyServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderService as ProviderServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { DefaultOrganizationService } from "@bitwarden/common/admin-console/services/organization/default-organization.service";
import { OrganizationApiService } from "@bitwarden/common/admin-console/services/organization/organization-api.service";
import { OrgDomainApiService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain-api.service";
import { OrgDomainService } from "@bitwarden/common/admin-console/services/organization-domain/org-domain.service";
import { DefaultOrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/services/organization-management-preferences/default-organization-management-preferences.service";
import { DefaultPolicyService } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { PolicyApiService } from "@bitwarden/common/admin-console/services/policy/policy-api.service";
import { ProviderApiService } from "@bitwarden/common/admin-console/services/provider/provider-api.service";
import { ProviderService } from "@bitwarden/common/admin-console/services/provider.service";
import { AccountApiService as AccountApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/account-api.service";
import {
  AccountService,
  AccountService as AccountServiceAbstraction,
  InternalAccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AnonymousHubService as AnonymousHubServiceAbstraction } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthRequestAnsweringServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-answering/auth-request-answering.service.abstraction";
import { AuthService as AuthServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService as AvatarServiceAbstraction } from "@bitwarden/common/auth/abstractions/avatar.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { MasterPasswordApiService as MasterPasswordApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService as TokenServiceAbstraction } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService as TwoFactorServiceAbstraction } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { UserVerificationApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { WebAuthnLoginApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { SendTokenService, DefaultSendTokenService } from "@bitwarden/common/auth/send-access";
import { AccountApiServiceImplementation } from "@bitwarden/common/auth/services/account-api.service";
import { AccountServiceImplementation } from "@bitwarden/common/auth/services/account.service";
import { AnonymousHubService } from "@bitwarden/common/auth/services/anonymous-hub.service";
import { NoopAuthRequestAnsweringService } from "@bitwarden/common/auth/services/auth-request-answering/noop-auth-request-answering.service";
import { PendingAuthRequestsStateService } from "@bitwarden/common/auth/services/auth-request-answering/pending-auth-requests.state";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { AvatarService } from "@bitwarden/common/auth/services/avatar.service";
import { DefaultActiveUserAccessor } from "@bitwarden/common/auth/services/default-active-user.accessor";
import { DevicesServiceImplementation } from "@bitwarden/common/auth/services/devices/devices.service.implementation";
import { DevicesApiServiceImplementation } from "@bitwarden/common/auth/services/devices-api.service.implementation";
import { MasterPasswordApiService } from "@bitwarden/common/auth/services/master-password/master-password-api.service.implementation";
import { DefaultOrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/default-organization-invite.service";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { PasswordResetEnrollmentServiceImplementation } from "@bitwarden/common/auth/services/password-reset-enrollment.service.implementation";
import { SsoLoginService } from "@bitwarden/common/auth/services/sso-login.service";
import { TokenService } from "@bitwarden/common/auth/services/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/services/two-factor.service";
import { UserVerificationApiService } from "@bitwarden/common/auth/services/user-verification/user-verification-api.service";
import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";
import { WebAuthnLoginApiService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login-api.service";
import { WebAuthnLoginPrfKeyService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login-prf-key.service";
import { WebAuthnLoginService } from "@bitwarden/common/auth/services/webauthn-login/webauthn-login.service";
import { TwoFactorApiService, DefaultTwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import {
  AutofillSettingsService,
  AutofillSettingsServiceAbstraction,
} from "@bitwarden/common/autofill/services/autofill-settings.service";
import {
  BadgeSettingsService,
  BadgeSettingsServiceAbstraction,
} from "@bitwarden/common/autofill/services/badge-settings.service";
import {
  DefaultDomainSettingsService,
  DomainSettingsService,
} from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  BillingApiServiceAbstraction,
  OrganizationBillingServiceAbstraction,
} from "@bitwarden/common/billing/abstractions";
import { AccountBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/account/account-billing-api.service.abstraction";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-billing-api.service.abstraction";
import { OrganizationSponsorshipApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/organizations/organization-sponsorship-api.service.abstraction";
import { SubscriptionPricingServiceAbstraction } from "@bitwarden/common/billing/abstractions/subscription-pricing.service.abstraction";
import { AccountBillingApiService } from "@bitwarden/common/billing/services/account/account-billing-api.service";
import { DefaultBillingAccountProfileStateService } from "@bitwarden/common/billing/services/account/billing-account-profile-state.service";
import { BillingApiService } from "@bitwarden/common/billing/services/billing-api.service";
import { OrganizationBillingApiService } from "@bitwarden/common/billing/services/organization/organization-billing-api.service";
import { DefaultOrganizationMetadataService } from "@bitwarden/common/billing/services/organization/organization-metadata.service";
import { OrganizationSponsorshipApiService } from "@bitwarden/common/billing/services/organization/organization-sponsorship-api.service";
import { OrganizationBillingService } from "@bitwarden/common/billing/services/organization-billing.service";
import { DefaultSubscriptionPricingService } from "@bitwarden/common/billing/services/subscription-pricing.service";
import { HibpApiService } from "@bitwarden/common/dirt/services/hibp-api.service";
import {
  DefaultKeyGenerationService,
  KeyGenerationService,
} from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService as CryptoFunctionServiceAbstraction } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncryptServiceImplementation } from "@bitwarden/common/key-management/crypto/services/encrypt.service.implementation";
import { WebCryptoFunctionService } from "@bitwarden/common/key-management/crypto/services/web-crypto-function.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { DeviceTrustService } from "@bitwarden/common/key-management/device-trust/services/device-trust.service.implementation";
import { DefaultChangeKdfApiService } from "@bitwarden/common/key-management/kdf/change-kdf-api.service";
import { ChangeKdfApiService } from "@bitwarden/common/key-management/kdf/change-kdf-api.service.abstraction";
import { DefaultChangeKdfService } from "@bitwarden/common/key-management/kdf/change-kdf-service";
import { ChangeKdfService } from "@bitwarden/common/key-management/kdf/change-kdf-service.abstraction";
import { KeyConnectorService as KeyConnectorServiceAbstraction } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/services/key-connector.service";
import { KeyApiService } from "@bitwarden/common/key-management/keys/services/abstractions/key-api-service.abstraction";
import { DefaultKeyApiService } from "@bitwarden/common/key-management/keys/services/default-key-api-service.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import {
  InternalMasterPasswordServiceAbstraction,
  MasterPasswordServiceAbstraction,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { DefaultMasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/services/default-master-password-unlock.service";
import { MasterPasswordService } from "@bitwarden/common/key-management/master-password/services/master-password.service";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { PinStateService } from "@bitwarden/common/key-management/pin/pin-state.service.implementation";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { PinService } from "@bitwarden/common/key-management/pin/pin.service.implementation";
import { SecurityStateService } from "@bitwarden/common/key-management/security-state/abstractions/security-state.service";
import { DefaultSecurityStateService } from "@bitwarden/common/key-management/security-state/services/security-state.service";
import {
  SendPasswordService,
  DefaultSendPasswordService,
} from "@bitwarden/common/key-management/sends";
import {
  DefaultVaultTimeoutService,
  DefaultVaultTimeoutSettingsService,
  VaultTimeoutService,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService as AppIdServiceAbstraction } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigApiServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config-api.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { FileUploadService as FileUploadServiceAbstraction } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService as I18nServiceAbstraction } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService as MessagingServiceAbstraction } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService as PlatformUtilsServiceAbstraction } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService as StateServiceAbstraction } from "@bitwarden/common/platform/abstractions/state.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { ValidationService as ValidationServiceAbstraction } from "@bitwarden/common/platform/abstractions/validation.service";
import { ActionsService } from "@bitwarden/common/platform/actions";
import { UnsupportedActionsService } from "@bitwarden/common/platform/actions/unsupported-actions.service";
import { Message, MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
// eslint-disable-next-line no-restricted-imports -- Used for dependency injection
import { SubjectMessageSender } from "@bitwarden/common/platform/messaging/internal";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import {
  DefaultTaskSchedulerService,
  TaskSchedulerService,
} from "@bitwarden/common/platform/scheduling";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
// eslint-disable-next-line no-restricted-imports -- Needed for service creation
import {
  DefaultServerNotificationsService,
  NoopServerNotificationsService,
  SignalRConnectionService,
  UnsupportedWebPushConnectionService,
  WebPushConnectionService,
  WebPushNotificationsApiService,
} from "@bitwarden/common/platform/server-notifications/internal";
import { AppIdService } from "@bitwarden/common/platform/services/app-id.service";
import { ConfigApiService } from "@bitwarden/common/platform/services/config/config-api.service";
import { DefaultConfigService } from "@bitwarden/common/platform/services/config/default-config.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { DefaultBroadcasterService } from "@bitwarden/common/platform/services/default-broadcaster.service";
import { DefaultEnvironmentService } from "@bitwarden/common/platform/services/default-environment.service";
import { DefaultServerSettingsService } from "@bitwarden/common/platform/services/default-server-settings.service";
import { FileUploadService } from "@bitwarden/common/platform/services/file-upload/file-upload.service";
import { MigrationBuilderService } from "@bitwarden/common/platform/services/migration-builder.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { StorageServiceProvider } from "@bitwarden/common/platform/services/storage-service.provider";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { ValidationService } from "@bitwarden/common/platform/services/validation.service";
import { SyncService } from "@bitwarden/common/platform/sync";
// eslint-disable-next-line no-restricted-imports -- Needed for DI
import { DefaultSyncService } from "@bitwarden/common/platform/sync/internal";
import { SystemNotificationsService } from "@bitwarden/common/platform/system-notifications";
import { UnsupportedSystemNotificationsService } from "@bitwarden/common/platform/system-notifications/unsupported-system-notifications.service";
import {
  DefaultThemeStateService,
  ThemeStateService,
} from "@bitwarden/common/platform/theming/theme-state.service";
import { ApiService } from "@bitwarden/common/services/api.service";
import { AuditService } from "@bitwarden/common/services/audit.service";
import { EventCollectionService } from "@bitwarden/common/services/event/event-collection.service";
import { EventUploadService } from "@bitwarden/common/services/event/event-upload.service";
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
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherService as CipherServiceAbstraction } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherFileUploadService as CipherFileUploadServiceAbstraction } from "@bitwarden/common/vault/abstractions/file-upload/cipher-file-upload.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import {
  FolderService as FolderServiceAbstraction,
  InternalFolderService,
} from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SearchService as SearchServiceAbstraction } from "@bitwarden/common/vault/abstractions/search.service";
import { TotpService as TotpServiceAbstraction } from "@bitwarden/common/vault/abstractions/totp.service";
import { VaultSettingsService as VaultSettingsServiceAbstraction } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import {
  DefaultEndUserNotificationService,
  EndUserNotificationService,
} from "@bitwarden/common/vault/notifications";
import {
  CipherAuthorizationService,
  DefaultCipherAuthorizationService,
} from "@bitwarden/common/vault/services/cipher-authorization.service";
import { CipherService } from "@bitwarden/common/vault/services/cipher.service";
import { DefaultCipherArchiveService } from "@bitwarden/common/vault/services/default-cipher-archive.service";
import { DefaultCipherEncryptionService } from "@bitwarden/common/vault/services/default-cipher-encryption.service";
import { CipherFileUploadService } from "@bitwarden/common/vault/services/file-upload/cipher-file-upload.service";
import { FolderApiService } from "@bitwarden/common/vault/services/folder/folder-api.service";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { SearchService } from "@bitwarden/common/vault/services/search.service";
import { TotpService } from "@bitwarden/common/vault/services/totp.service";
import { VaultSettingsService } from "@bitwarden/common/vault/services/vault-settings/vault-settings.service";
import { DefaultTaskService, TaskService } from "@bitwarden/common/vault/tasks";
import {
  AnonLayoutWrapperDataService,
  DefaultAnonLayoutWrapperDataService,
  ToastService,
} from "@bitwarden/components";
import {
  GeneratorHistoryService,
  LocalGeneratorHistoryService,
} from "@bitwarden/generator-history";
import {
  legacyPasswordGenerationServiceFactory,
  legacyUsernameGenerationServiceFactory,
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";
import {
  BiometricsService,
  BiometricStateService,
  DefaultBiometricStateService,
  DefaultKdfConfigService,
  DefaultKeyService,
  DefaultUserAsymmetricKeysRegenerationApiService,
  DefaultUserAsymmetricKeysRegenerationService,
  KdfConfigService,
  KeyService,
  UserAsymmetricKeysRegenerationApiService,
  UserAsymmetricKeysRegenerationService,
} from "@bitwarden/key-management";
import {
  ActiveUserStateProvider,
  DerivedStateProvider,
  GlobalStateProvider,
  SingleUserStateProvider,
  StateEventRegistrarService,
  StateEventRunnerService,
  StateProvider,
} from "@bitwarden/state";
import {
  ActiveUserAccessor,
  DefaultActiveUserStateProvider,
  DefaultDerivedStateProvider,
  DefaultGlobalStateProvider,
  DefaultSingleUserStateProvider,
  DefaultStateEventRegistrarService,
  DefaultStateEventRunnerService,
  DefaultStateProvider,
  DefaultStateService,
} from "@bitwarden/state-internal";
import { SafeInjectionToken } from "@bitwarden/ui-common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordRepromptService } from "@bitwarden/vault";
import {
  IndividualVaultExportService,
  IndividualVaultExportServiceAbstraction,
  DefaultVaultExportApiService,
  VaultExportApiService,
  OrganizationVaultExportService,
  OrganizationVaultExportServiceAbstraction,
  VaultExportService,
  VaultExportServiceAbstraction,
} from "@bitwarden/vault-export-core";

import { DefaultLoginApprovalDialogComponentService } from "../auth/login-approval/default-login-approval-dialog-component.service";
import { LoginApprovalDialogComponentServiceAbstraction } from "../auth/login-approval/login-approval-dialog-component.service.abstraction";
import { DefaultSetInitialPasswordService } from "../auth/password-management/set-initial-password/default-set-initial-password.service.implementation";
import { SetInitialPasswordService } from "../auth/password-management/set-initial-password/set-initial-password.service.abstraction";
import { DeviceTrustToastService as DeviceTrustToastServiceAbstraction } from "../auth/services/device-trust-toast.service.abstraction";
import { DeviceTrustToastService } from "../auth/services/device-trust-toast.service.implementation";
import { FormValidationErrorsService as FormValidationErrorsServiceAbstraction } from "../platform/abstractions/form-validation-errors.service";
import { DocumentLangSetter } from "../platform/i18n";
import { FormValidationErrorsService } from "../platform/services/form-validation-errors.service";
import { LoggingErrorHandler } from "../platform/services/logging-error-handler";
import { AngularThemingService } from "../platform/services/theming/angular-theming.service";
import { AbstractThemingService } from "../platform/services/theming/theming.service.abstraction";
import { safeProvider, SafeProvider } from "../platform/utils/safe-provider";
import { ViewCacheService } from "../platform/view-cache";
// eslint-disable-next-line no-restricted-imports -- Needed for DI
import { NoopViewCacheService } from "../platform/view-cache/internal";

import {
  CLIENT_TYPE,
  DEFAULT_VAULT_TIMEOUT,
  DOCUMENT,
  ENV_ADDITIONAL_REGIONS,
  HTTP_OPERATIONS,
  INTRAPROCESS_MESSAGING_SUBJECT,
  LOCALES_DIRECTORY,
  LOCKED_CALLBACK,
  LOG_MAC_FAILURES,
  LOGOUT_CALLBACK,
  OBSERVABLE_DISK_STORAGE,
  OBSERVABLE_MEMORY_STORAGE,
  REFRESH_ACCESS_TOKEN_ERROR_CALLBACK,
  SECURE_STORAGE,
  SUPPORTS_SECURE_STORAGE,
  SYSTEM_LANGUAGE,
  SYSTEM_THEME_OBSERVABLE,
  WINDOW,
} from "./injection-tokens";
import { ModalService } from "./modal.service";

/**
 * Provider definitions used in the ngModule.
 * Add your provider definition here using the safeProvider function as a wrapper. This will give you type safety.
 * If you need help please ask for it, do NOT change the type of this array.
 */
const safeProviders: SafeProvider[] = [
  safeProvider(ModalService),
  safeProvider(PasswordRepromptService),
  safeProvider({ provide: WINDOW, useValue: window }),
  safeProvider({ provide: DOCUMENT, useValue: document }),
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
  // TODO: PM-21212 - Deprecate LogoutCallback in favor of LogoutService
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
    deps: [OBSERVABLE_DISK_STORAGE, LogService],
  }),
  safeProvider({
    provide: AuditServiceAbstraction,
    useClass: AuditService,
    deps: [CryptoFunctionServiceAbstraction, ApiServiceAbstraction, HibpApiService],
  }),
  safeProvider({
    provide: HibpApiService,
    useClass: HibpApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: AuthServiceAbstraction,
    useClass: AuthService,
    deps: [
      AccountServiceAbstraction,
      MessagingServiceAbstraction,
      KeyService,
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
      KeyService,
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
      VaultTimeoutSettingsService,
      KdfConfigService,
      TaskSchedulerService,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: FileUploadServiceAbstraction,
    useClass: FileUploadService,
    deps: [LogService, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: CipherFileUploadServiceAbstraction,
    useClass: CipherFileUploadService,
    deps: [ApiServiceAbstraction, FileUploadServiceAbstraction],
  }),
  safeProvider({
    provide: DomainSettingsService,
    useClass: DefaultDomainSettingsService,
    deps: [StateProvider, PolicyServiceAbstraction, AccountService],
  }),
  safeProvider({
    provide: CipherServiceAbstraction,
    useFactory: (
      keyService: KeyService,
      domainSettingsService: DomainSettingsService,
      apiService: ApiServiceAbstraction,
      i18nService: I18nServiceAbstraction,
      searchService: SearchServiceAbstraction,
      autofillSettingsService: AutofillSettingsServiceAbstraction,
      encryptService: EncryptService,
      fileUploadService: CipherFileUploadServiceAbstraction,
      configService: ConfigService,
      stateProvider: StateProvider,
      accountService: AccountServiceAbstraction,
      logService: LogService,
      cipherEncryptionService: CipherEncryptionService,
      messagingService: MessagingServiceAbstraction,
    ) =>
      new CipherService(
        keyService,
        domainSettingsService,
        apiService,
        i18nService,
        searchService,
        autofillSettingsService,
        encryptService,
        fileUploadService,
        configService,
        stateProvider,
        accountService,
        logService,
        cipherEncryptionService,
        messagingService,
      ),
    deps: [
      KeyService,
      DomainSettingsService,
      ApiServiceAbstraction,
      I18nServiceAbstraction,
      SearchServiceAbstraction,
      AutofillSettingsServiceAbstraction,
      EncryptService,
      CipherFileUploadServiceAbstraction,
      ConfigService,
      StateProvider,
      AccountServiceAbstraction,
      LogService,
      CipherEncryptionService,
      MessagingServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: InternalFolderService,
    useClass: FolderService,
    deps: [
      KeyService,
      EncryptService,
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
    deps: [MessagingServiceAbstraction, LogService, GlobalStateProvider, SingleUserStateProvider],
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
  safeProvider({
    provide: LogService,
    useFactory: () => new ConsoleLogService(process.env.NODE_ENV === "development"),
    deps: [],
  }),
  safeProvider({
    provide: CollectionService,
    useClass: DefaultCollectionService,
    deps: [KeyService, EncryptService, I18nServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: ENV_ADDITIONAL_REGIONS,
    useValue: process.env.ADDITIONAL_REGIONS as unknown as RegionConfig[],
  }),
  safeProvider({
    provide: EnvironmentService,
    useClass: DefaultEnvironmentService,
    deps: [StateProvider, AccountServiceAbstraction, ENV_ADDITIONAL_REGIONS],
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
    deps: [SdkService],
  }),
  safeProvider({
    provide: TokenServiceAbstraction,
    useClass: TokenService,
    deps: [
      SingleUserStateProvider,
      GlobalStateProvider,
      SUPPORTS_SECURE_STORAGE,
      SECURE_STORAGE,
      KeyGenerationService,
      EncryptService,
      LogService,
      LOGOUT_CALLBACK,
    ],
  }),
  safeProvider({
    provide: KeyGenerationService,
    useClass: DefaultKeyGenerationService,
    deps: [CryptoFunctionServiceAbstraction],
  }),
  safeProvider({
    provide: KeyService,
    useClass: DefaultKeyService,
    deps: [
      InternalMasterPasswordServiceAbstraction,
      KeyGenerationService,
      CryptoFunctionServiceAbstraction,
      EncryptService,
      PlatformUtilsServiceAbstraction,
      LogService,
      StateServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
      KdfConfigService,
    ],
  }),
  safeProvider({
    provide: SecurityStateService,
    useClass: DefaultSecurityStateService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: RestrictedItemTypesService,
    useClass: RestrictedItemTypesService,
    deps: [AccountService, OrganizationServiceAbstraction, PolicyServiceAbstraction],
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
      KeyService,
      PolicyServiceAbstraction,
      AccountServiceAbstraction,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: GeneratorHistoryService,
    useClass: LocalGeneratorHistoryService,
    deps: [EncryptService, KeyService, StateProvider],
  }),
  safeProvider({
    provide: UsernameGenerationServiceAbstraction,
    useFactory: legacyUsernameGenerationServiceFactory,
    deps: [
      ApiServiceAbstraction,
      I18nServiceAbstraction,
      KeyService,
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
    provide: HTTP_OPERATIONS,
    useValue: { createRequest: (url, request) => new Request(url, request) },
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
      VaultTimeoutSettingsService,
      AccountService,
      HTTP_OPERATIONS,
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
      AccountServiceAbstraction,
      KeyService,
      I18nServiceAbstraction,
      KeyGenerationService,
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
    provide: KeyApiService,
    useClass: DefaultKeyApiService,
    deps: [ApiServiceAbstraction],
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
      KeyService,
      CollectionService,
      MessagingServiceAbstraction,
      InternalPolicyService,
      InternalSendService,
      LogService,
      KeyConnectorServiceAbstraction,
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
      StateProvider,
      SecurityStateService,
      KdfConfigService,
    ],
  }),
  safeProvider({
    provide: BroadcasterService,
    useClass: DefaultBroadcasterService,
    deps: [MessageListener],
  }),
  safeProvider({
    provide: VaultTimeoutSettingsService,
    useClass: DefaultVaultTimeoutSettingsService,
    deps: [
      AccountServiceAbstraction,
      PinStateServiceAbstraction,
      UserDecryptionOptionsServiceAbstraction,
      KeyService,
      TokenServiceAbstraction,
      PolicyServiceAbstraction,
      BiometricStateService,
      StateProvider,
      LogService,
      DEFAULT_VAULT_TIMEOUT,
    ],
  }),
  safeProvider({
    provide: DefaultVaultTimeoutService,
    useClass: DefaultVaultTimeoutService,
    deps: [
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      CipherServiceAbstraction,
      FolderServiceAbstraction,
      CollectionService,
      PlatformUtilsServiceAbstraction,
      MessagingServiceAbstraction,
      SearchServiceAbstraction,
      StateServiceAbstraction,
      TokenServiceAbstraction,
      AuthServiceAbstraction,
      VaultTimeoutSettingsService,
      StateEventRunnerService,
      TaskSchedulerService,
      LogService,
      BiometricsService,
      LOCKED_CALLBACK,
      LogoutService,
    ],
  }),
  safeProvider({
    provide: VaultTimeoutService,
    useExisting: DefaultVaultTimeoutService,
  }),
  safeProvider({
    provide: SsoLoginServiceAbstraction,
    useClass: SsoLoginService,
    deps: [StateProvider, LogService, PolicyServiceAbstraction],
  }),
  safeProvider({
    provide: StateServiceAbstraction,
    useClass: DefaultStateService,
    deps: [AbstractStorageService, SECURE_STORAGE, ActiveUserAccessor],
  }),
  safeProvider({
    provide: IndividualVaultExportServiceAbstraction,
    useClass: IndividualVaultExportService,
    deps: [
      FolderServiceAbstraction,
      CipherServiceAbstraction,
      PinServiceAbstraction,
      KeyService,
      EncryptService,
      CryptoFunctionServiceAbstraction,
      KdfConfigService,
      ApiServiceAbstraction,
      RestrictedItemTypesService,
    ],
  }),
  safeProvider({
    provide: VaultExportApiService,
    useClass: DefaultVaultExportApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: OrganizationVaultExportServiceAbstraction,
    useClass: OrganizationVaultExportService,
    deps: [
      CipherServiceAbstraction,
      VaultExportApiService,
      PinServiceAbstraction,
      KeyService,
      EncryptService,
      CryptoFunctionServiceAbstraction,
      CollectionService,
      KdfConfigService,
      RestrictedItemTypesService,
    ],
  }),
  safeProvider({
    provide: VaultExportServiceAbstraction,
    useClass: VaultExportService,
    deps: [
      IndividualVaultExportServiceAbstraction,
      OrganizationVaultExportServiceAbstraction,
      AccountServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: SearchServiceAbstraction,
    useClass: SearchService,
    deps: [LogService, I18nServiceAbstraction, StateProvider],
  }),
  safeProvider({
    provide: WebPushNotificationsApiService,
    useClass: WebPushNotificationsApiService,
    deps: [ApiServiceAbstraction, AppIdServiceAbstraction],
  }),
  safeProvider({
    provide: SignalRConnectionService,
    useClass: SignalRConnectionService,
    deps: [ApiServiceAbstraction, LogService, PlatformUtilsServiceAbstraction],
  }),
  safeProvider({
    provide: WebPushConnectionService,
    useClass: UnsupportedWebPushConnectionService,
    deps: [],
  }),
  safeProvider({
    provide: ActionsService,
    useClass: UnsupportedActionsService,
    deps: [],
  }),
  safeProvider({
    provide: ActionsService,
    useClass: UnsupportedActionsService,
    deps: [],
  }),
  safeProvider({
    provide: SystemNotificationsService,
    useClass: UnsupportedSystemNotificationsService,
    deps: [],
  }),
  safeProvider({
    provide: PendingAuthRequestsStateService,
    useClass: PendingAuthRequestsStateService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: AuthRequestAnsweringServiceAbstraction,
    useClass: NoopAuthRequestAnsweringService,
    deps: [],
  }),
  safeProvider({
    provide: ServerNotificationsService,
    useClass: devFlagEnabled("noopNotifications")
      ? NoopServerNotificationsService
      : DefaultServerNotificationsService,
    deps: [
      LogService,
      SyncService,
      AppIdServiceAbstraction,
      EnvironmentService,
      LOGOUT_CALLBACK,
      MessagingServiceAbstraction,
      AccountServiceAbstraction,
      SignalRConnectionService,
      AuthServiceAbstraction,
      WebPushConnectionService,
      AuthRequestAnsweringServiceAbstraction,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: CryptoFunctionServiceAbstraction,
    useClass: WebCryptoFunctionService,
    deps: [WINDOW],
  }),
  safeProvider({
    provide: EncryptService,
    useClass: EncryptServiceImplementation,
    deps: [CryptoFunctionServiceAbstraction, LogService, LOG_MAC_FAILURES],
  }),
  safeProvider({
    provide: EventUploadServiceAbstraction,
    useClass: EventUploadService,
    deps: [
      ApiServiceAbstraction,
      StateProvider,
      LogService,
      AuthServiceAbstraction,
      TaskSchedulerService,
    ],
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
    useClass: DefaultPolicyService,
    deps: [StateProvider, OrganizationServiceAbstraction],
  }),
  safeProvider({
    provide: PolicyServiceAbstraction,
    useExisting: InternalPolicyService,
  }),
  safeProvider({
    provide: PolicyApiServiceAbstraction,
    useClass: PolicyApiService,
    deps: [InternalPolicyService, ApiServiceAbstraction, AccountService],
  }),
  safeProvider({
    provide: InternalMasterPasswordServiceAbstraction,
    useClass: MasterPasswordService,
    deps: [
      StateProvider,
      KeyGenerationService,
      LogService,
      CryptoFunctionServiceAbstraction,
      AccountServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: MasterPasswordServiceAbstraction,
    useExisting: InternalMasterPasswordServiceAbstraction,
  }),
  safeProvider({
    provide: MasterPasswordUnlockService,
    useClass: DefaultMasterPasswordUnlockService,
    deps: [InternalMasterPasswordServiceAbstraction, KeyService],
  }),
  safeProvider({
    provide: KeyConnectorServiceAbstraction,
    useClass: KeyConnectorService,
    deps: [
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      KeyService,
      ApiServiceAbstraction,
      TokenServiceAbstraction,
      LogService,
      OrganizationServiceAbstraction,
      KeyGenerationService,
      LOGOUT_CALLBACK,
      StateProvider,
    ],
  }),
  safeProvider({
    provide: UserVerificationServiceAbstraction,
    useClass: UserVerificationService,
    deps: [
      KeyService,
      AccountServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      I18nServiceAbstraction,
      UserVerificationApiServiceAbstraction,
      UserDecryptionOptionsServiceAbstraction,
      PinServiceAbstraction,
      KdfConfigService,
      BiometricsService,
    ],
  }),
  safeProvider({
    provide: InternalOrganizationServiceAbstraction,
    useClass: DefaultOrganizationService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: OrganizationUserService,
    useClass: DefaultOrganizationUserService,
    deps: [
      KeyService,
      EncryptService,
      OrganizationUserApiService,
      AccountService,
      I18nServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: OrganizationServiceAbstraction,
    useExisting: InternalOrganizationServiceAbstraction,
  }),

  safeProvider({
    provide: OrganizationUserApiService,
    useClass: DefaultOrganizationUserApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: PasswordResetEnrollmentServiceAbstraction,
    useClass: PasswordResetEnrollmentServiceImplementation,
    deps: [
      OrganizationApiServiceAbstraction,
      AccountServiceAbstraction,
      KeyService,
      EncryptService,
      OrganizationUserApiService,
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
    provide: OrganizationSponsorshipApiServiceAbstraction,
    useClass: OrganizationSponsorshipApiService,
    deps: [ApiServiceAbstraction, PlatformUtilsServiceAbstraction],
  }),
  safeProvider({
    provide: OrganizationBillingApiServiceAbstraction,
    useClass: OrganizationBillingApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: AccountBillingApiServiceAbstraction,
    useClass: AccountBillingApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: DefaultConfigService,
    useClass: DefaultConfigService,
    deps: [
      ConfigApiServiceAbstraction,
      EnvironmentService,
      LogService,
      StateProvider,
      AuthServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: ConfigService,
    useExisting: DefaultConfigService,
  }),
  safeProvider({
    provide: ConfigApiServiceAbstraction,
    useClass: ConfigApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: AnonymousHubServiceAbstraction,
    useClass: AnonymousHubService,
    deps: [EnvironmentService, AuthRequestServiceAbstraction, PlatformUtilsServiceAbstraction],
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
    deps: [AppIdServiceAbstraction, DevicesApiServiceAbstraction, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: AuthRequestApiServiceAbstraction,
    useClass: DefaultAuthRequestApiService,
    deps: [ApiServiceAbstraction, LogService],
  }),
  safeProvider({
    provide: DeviceTrustServiceAbstraction,
    useClass: DeviceTrustService,
    deps: [
      KeyGenerationService,
      CryptoFunctionServiceAbstraction,
      KeyService,
      EncryptService,
      AppIdServiceAbstraction,
      DevicesApiServiceAbstraction,
      I18nServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      StateProvider,
      SECURE_STORAGE,
      UserDecryptionOptionsServiceAbstraction,
      LogService,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: ChangeKdfApiService,
    useClass: DefaultChangeKdfApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: ChangeKdfService,
    useClass: DefaultChangeKdfService,
    deps: [ChangeKdfApiService, SdkService],
  }),
  safeProvider({
    provide: AuthRequestServiceAbstraction,
    useClass: AuthRequestService,
    deps: [
      AppIdServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      KeyService,
      EncryptService,
      ApiServiceAbstraction,
      StateProvider,
      AuthRequestApiServiceAbstraction,
      AccountServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: PinStateServiceAbstraction,
    useClass: PinStateService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: PinServiceAbstraction,
    useClass: PinService,
    deps: [
      AccountServiceAbstraction,
      EncryptService,
      KdfConfigService,
      KeyGenerationService,
      LogService,
      KeyService,
      SdkService,
      PinStateServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: WebAuthnLoginPrfKeyServiceAbstraction,
    useClass: WebAuthnLoginPrfKeyService,
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
      WebAuthnLoginPrfKeyServiceAbstraction,
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
    useClass: DefaultStateEventRegistrarService,
    deps: [GlobalStateProvider, StorageServiceProvider],
  }),
  safeProvider({
    provide: StateEventRunnerService,
    useClass: DefaultStateEventRunnerService,
    deps: [GlobalStateProvider, StorageServiceProvider],
  }),
  safeProvider({
    provide: GlobalStateProvider,
    useClass: DefaultGlobalStateProvider,
    deps: [StorageServiceProvider, LogService],
  }),
  safeProvider({
    provide: ActiveUserAccessor,
    useClass: DefaultActiveUserAccessor,
    deps: [AccountServiceAbstraction],
  }),
  safeProvider({
    provide: ActiveUserStateProvider,
    useClass: DefaultActiveUserStateProvider,
    deps: [ActiveUserAccessor, SingleUserStateProvider],
  }),
  safeProvider({
    provide: SingleUserStateProvider,
    useClass: DefaultSingleUserStateProvider,
    deps: [StorageServiceProvider, StateEventRegistrarService, LogService],
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
      BillingApiServiceAbstraction,
      KeyService,
      EncryptService,
      I18nServiceAbstraction,
      OrganizationApiServiceAbstraction,
      SyncService,
    ],
  }),
  safeProvider({
    provide: AutofillSettingsServiceAbstraction,
    useClass: AutofillSettingsService,
    deps: [StateProvider, PolicyServiceAbstraction, AccountService, RestrictedItemTypesService],
  }),
  safeProvider({
    provide: BadgeSettingsServiceAbstraction,
    useClass: BadgeSettingsService,
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
    deps: [StateProvider, RestrictedItemTypesService],
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
    provide: OrganizationMetadataServiceAbstraction,
    useClass: DefaultOrganizationMetadataService,
    deps: [BillingApiServiceAbstraction, ConfigService],
  }),
  safeProvider({
    provide: BillingAccountProfileStateService,
    useClass: DefaultBillingAccountProfileStateService,
    deps: [StateProvider, PlatformUtilsServiceAbstraction, ApiServiceAbstraction],
  }),
  safeProvider({
    provide: SubscriptionPricingServiceAbstraction,
    useClass: DefaultSubscriptionPricingService,
    deps: [BillingApiServiceAbstraction, ConfigService, I18nServiceAbstraction, LogService],
  }),
  safeProvider({
    provide: OrganizationManagementPreferencesService,
    useClass: DefaultOrganizationManagementPreferencesService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: UserAutoUnlockKeyService,
    useClass: UserAutoUnlockKeyService,
    deps: [KeyService],
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
    provide: TaskSchedulerService,
    useClass: DefaultTaskSchedulerService,
    deps: [LogService],
  }),
  safeProvider({
    provide: ProviderApiServiceAbstraction,
    useClass: ProviderApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: KdfConfigService,
    useClass: DefaultKdfConfigService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: OrganizationInviteService,
    useClass: DefaultOrganizationInviteService,
    deps: [],
  }),
  safeProvider({
    provide: SetInitialPasswordService,
    useClass: DefaultSetInitialPasswordService,
    deps: [
      ApiServiceAbstraction,
      EncryptService,
      I18nServiceAbstraction,
      KdfConfigService,
      KeyService,
      MasterPasswordApiServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
      OrganizationApiServiceAbstraction,
      OrganizationUserApiService,
      InternalUserDecryptionOptionsServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: DefaultServerSettingsService,
    useClass: DefaultServerSettingsService,
    deps: [ConfigService],
  }),
  safeProvider({
    provide: AnonLayoutWrapperDataService,
    useClass: DefaultAnonLayoutWrapperDataService,
    deps: [],
  }),
  safeProvider({
    provide: RegistrationFinishServiceAbstraction,
    useClass: DefaultRegistrationFinishService,
    deps: [KeyService, AccountApiServiceAbstraction],
  }),
  safeProvider({
    provide: TwoFactorAuthComponentService,
    useClass: DefaultTwoFactorAuthComponentService,
    deps: [],
  }),
  safeProvider({
    provide: TwoFactorAuthWebAuthnComponentService,
    useClass: DefaultTwoFactorAuthWebAuthnComponentService,
    deps: [],
  }),
  safeProvider({
    provide: TwoFactorApiService,
    useClass: DefaultTwoFactorApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: ViewCacheService,
    useExisting: NoopViewCacheService,
    deps: [],
  }),
  safeProvider({
    provide: LoginComponentService,
    useClass: DefaultLoginComponentService,
    deps: [
      CryptoFunctionServiceAbstraction,
      EnvironmentService,
      PasswordGenerationServiceAbstraction,
      PlatformUtilsServiceAbstraction,
      SsoLoginServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: SdkService,
    useClass: DefaultSdkService,
    deps: [
      SdkClientFactory,
      EnvironmentService,
      PlatformUtilsServiceAbstraction,
      AccountServiceAbstraction,
      KdfConfigService,
      KeyService,
      SecurityStateService,
      ApiServiceAbstraction,
      StateProvider,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: CipherAuthorizationService,
    useClass: DefaultCipherAuthorizationService,
    deps: [CollectionService, OrganizationServiceAbstraction, AccountServiceAbstraction],
  }),
  safeProvider({
    provide: SendPasswordService,
    useClass: DefaultSendPasswordService,
    deps: [CryptoFunctionServiceAbstraction],
  }),
  safeProvider({
    provide: LoginApprovalDialogComponentServiceAbstraction,
    useClass: DefaultLoginApprovalDialogComponentService,
    deps: [],
  }),
  safeProvider({
    provide: LoginDecryptionOptionsService,
    useClass: DefaultLoginDecryptionOptionsService,
    deps: [MessagingServiceAbstraction],
  }),
  safeProvider({
    provide: UserAsymmetricKeysRegenerationApiService,
    useClass: DefaultUserAsymmetricKeysRegenerationApiService,
    deps: [ApiServiceAbstraction],
  }),
  safeProvider({
    provide: UserAsymmetricKeysRegenerationService,
    useClass: DefaultUserAsymmetricKeysRegenerationService,
    deps: [
      KeyService,
      CipherServiceAbstraction,
      UserAsymmetricKeysRegenerationApiService,
      LogService,
      SdkService,
      ApiServiceAbstraction,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: LoginSuccessHandlerService,
    useClass: DefaultLoginSuccessHandlerService,
    deps: [
      ConfigService,
      LoginEmailService,
      SsoLoginServiceAbstraction,
      SyncService,
      UserAsymmetricKeysRegenerationService,
      LogService,
    ],
  }),
  safeProvider({
    provide: TaskService,
    useClass: DefaultTaskService,
    deps: [
      StateProvider,
      ApiServiceAbstraction,
      OrganizationServiceAbstraction,
      AuthServiceAbstraction,
      ServerNotificationsService,
      MessageListener,
    ],
  }),
  safeProvider({
    provide: SendTokenService,
    useClass: DefaultSendTokenService,
    deps: [GlobalStateProvider, SdkService, SendPasswordService],
  }),
  safeProvider({
    provide: EndUserNotificationService,
    useClass: DefaultEndUserNotificationService,
    deps: [
      StateProvider,
      ApiServiceAbstraction,
      ServerNotificationsService,
      AuthServiceAbstraction,
      LogService,
    ],
  }),
  safeProvider({
    provide: DeviceTrustToastServiceAbstraction,
    useClass: DeviceTrustToastService,
    deps: [
      AuthRequestServiceAbstraction,
      DeviceTrustServiceAbstraction,
      I18nServiceAbstraction,
      ToastService,
    ],
  }),
  safeProvider({
    provide: MasterPasswordApiServiceAbstraction,
    useClass: MasterPasswordApiService,
    deps: [ApiServiceAbstraction, LogService],
  }),
  safeProvider({
    provide: LogoutService,
    useClass: DefaultLogoutService,
    deps: [MessagingServiceAbstraction],
  }),
  safeProvider({
    provide: DocumentLangSetter,
    useClass: DocumentLangSetter,
    deps: [DOCUMENT, I18nServiceAbstraction],
  }),
  safeProvider({
    provide: CipherEncryptionService,
    useClass: DefaultCipherEncryptionService,
    deps: [SdkService, LogService],
  }),
  safeProvider({
    provide: ChangePasswordService,
    useClass: DefaultChangePasswordService,
    deps: [
      KeyService,
      MasterPasswordApiServiceAbstraction,
      InternalMasterPasswordServiceAbstraction,
    ],
  }),
  safeProvider({
    provide: CipherArchiveService,
    useClass: DefaultCipherArchiveService,
    deps: [
      CipherServiceAbstraction,
      ApiServiceAbstraction,
      BillingAccountProfileStateService,
      ConfigService,
    ],
  }),
  safeProvider({
    provide: NewDeviceVerificationComponentService,
    useClass: DefaultNewDeviceVerificationComponentService,
    deps: [],
  }),
];

@NgModule({
  declarations: [],
  // Do not register your dependency here! Add it to the typesafeProviders array using the helper function
  providers: safeProviders,
})
export class JslibServicesModule {}
