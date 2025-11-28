import { LogService } from "@bitwarden/logging";
import { AbstractStorageService } from "@bitwarden/storage-core";

import { MigrationBuilder } from "./migration-builder";
import { EverHadUserKeyMigrator } from "./migrations/10-move-ever-had-user-key-to-state-providers";
import { OrganizationKeyMigrator } from "./migrations/11-move-org-keys-to-state-providers";
import { MoveEnvironmentStateToProviders } from "./migrations/12-move-environment-state-to-providers";
import { ProviderKeyMigrator } from "./migrations/13-move-provider-keys-to-state-providers";
import { MoveBiometricClientKeyHalfToStateProviders } from "./migrations/14-move-biometric-client-key-half-state-to-providers";
import { FolderMigrator } from "./migrations/15-move-folder-state-to-state-provider";
import { LastSyncMigrator } from "./migrations/16-move-last-sync-to-state-provider";
import { EnablePasskeysMigrator } from "./migrations/17-move-enable-passkeys-to-state-providers";
import { AutofillSettingsKeyMigrator } from "./migrations/18-move-autofill-settings-to-state-providers";
import { RequirePasswordOnStartMigrator } from "./migrations/19-migrate-require-password-on-start";
import { PrivateKeyMigrator } from "./migrations/20-move-private-key-to-state-providers";
import { CollectionMigrator } from "./migrations/21-move-collections-state-to-state-provider";
import { CollapsedGroupingsMigrator } from "./migrations/22-move-collapsed-groupings-to-state-provider";
import { MoveBiometricPromptsToStateProviders } from "./migrations/23-move-biometric-prompts-to-state-providers";
import { SmOnboardingTasksMigrator } from "./migrations/24-move-sm-onboarding-key-to-state-providers";
import { ClearClipboardDelayMigrator } from "./migrations/25-move-clear-clipboard-to-autofill-settings-state-provider";
import { RevertLastSyncMigrator } from "./migrations/26-revert-move-last-sync-to-state-provider";
import { BadgeSettingsMigrator } from "./migrations/27-move-badge-settings-to-state-providers";
import { MoveBiometricUnlockToStateProviders } from "./migrations/28-move-biometric-unlock-to-state-providers";
import { UserNotificationSettingsKeyMigrator } from "./migrations/29-move-user-notification-settings-to-state-provider";
import { PolicyMigrator } from "./migrations/30-move-policy-state-to-state-provider";
import { EnableContextMenuMigrator } from "./migrations/31-move-enable-context-menu-to-autofill-settings-state-provider";
import { PreferredLanguageMigrator } from "./migrations/32-move-preferred-language";
import { AppIdMigrator } from "./migrations/33-move-app-id-to-state-providers";
import { DomainSettingsMigrator } from "./migrations/34-move-domain-settings-to-state-providers";
import { MoveThemeToStateProviderMigrator } from "./migrations/35-move-theme-to-state-providers";
import { VaultSettingsKeyMigrator } from "./migrations/36-move-show-card-and-identity-to-state-provider";
import { AvatarColorMigrator } from "./migrations/37-move-avatar-color-to-state-providers";
import { TokenServiceStateProviderMigrator } from "./migrations/38-migrate-token-svc-to-state-provider";
import { MoveBillingAccountProfileMigrator } from "./migrations/39-move-billing-account-profile-to-state-providers";
import { RemoveEverBeenUnlockedMigrator } from "./migrations/4-remove-ever-been-unlocked";
import { OrganizationMigrator } from "./migrations/40-move-organization-state-to-state-provider";
import { EventCollectionMigrator } from "./migrations/41-move-event-collection-to-state-provider";
import { EnableFaviconMigrator } from "./migrations/42-move-enable-favicon-to-domain-settings-state-provider";
import { AutoConfirmFingerPrintsMigrator } from "./migrations/43-move-auto-confirm-finger-prints-to-state-provider";
import { UserDecryptionOptionsMigrator } from "./migrations/44-move-user-decryption-options-to-state-provider";
import { MergeEnvironmentState } from "./migrations/45-merge-environment-state";
import { DeleteBiometricPromptCancelledData } from "./migrations/46-delete-orphaned-biometric-prompt-data";
import { MoveDesktopSettingsMigrator } from "./migrations/47-move-desktop-settings";
import { MoveDdgToStateProviderMigrator } from "./migrations/48-move-ddg-to-state-provider";
import { AccountServerConfigMigrator } from "./migrations/49-move-account-server-configs";
import { AddKeyTypeToOrgKeysMigrator } from "./migrations/5-add-key-type-to-org-keys";
import { KeyConnectorMigrator } from "./migrations/50-move-key-connector-to-state-provider";
import { RememberedEmailMigrator } from "./migrations/51-move-remembered-email-to-state-providers";
import { DeleteInstalledVersion } from "./migrations/52-delete-installed-version";
import { DeviceTrustServiceStateProviderMigrator } from "./migrations/53-migrate-device-trust-svc-to-state-providers";
import { SendMigrator } from "./migrations/54-move-encrypted-sends";
import { MoveMasterKeyStateToProviderMigrator } from "./migrations/55-move-master-key-state-to-provider";
import { AuthRequestMigrator } from "./migrations/56-move-auth-requests";
import { CipherServiceMigrator } from "./migrations/57-move-cipher-service-to-state-provider";
import { RemoveRefreshTokenMigratedFlagMigrator } from "./migrations/58-remove-refresh-token-migrated-state-provider-flag";
import { KdfConfigMigrator } from "./migrations/59-move-kdf-config-to-state-provider";
import { RemoveLegacyEtmKeyMigrator } from "./migrations/6-remove-legacy-etm-key";
import { KnownAccountsMigrator } from "./migrations/60-known-accounts";
import { PinStateMigrator } from "./migrations/61-move-pin-state-to-providers";
import { VaultTimeoutSettingsServiceStateProviderMigrator } from "./migrations/62-migrate-vault-timeout-settings-svc-to-state-provider";
import { PasswordOptionsMigrator } from "./migrations/63-migrate-password-settings";
import { GeneratorHistoryMigrator } from "./migrations/64-migrate-generator-history";
import { ForwarderOptionsMigrator } from "./migrations/65-migrate-forwarder-settings";
import { MoveFinalDesktopSettingsMigrator } from "./migrations/66-move-final-desktop-settings";
import { RemoveUnassignedItemsBannerDismissed } from "./migrations/67-remove-unassigned-items-banner-dismissed";
import { MoveLastSyncDate } from "./migrations/68-move-last-sync-date";
import { MigrateIncorrectFolderKey } from "./migrations/69-migrate-incorrect-folder-key";
import { MoveBiometricAutoPromptToAccount } from "./migrations/7-move-biometric-auto-prompt-to-account";
import { RemoveAcBannersDismissed } from "./migrations/70-remove-ac-banner-dismissed";
import { RemoveNewCustomizationOptionsCalloutDismissed } from "./migrations/71-remove-new-customization-options-callout-dismissed";
import { RemoveAccountDeprovisioningBannerDismissed } from "./migrations/72-remove-account-deprovisioning-banner-dismissed";
import { AddMasterPasswordUnlockData } from "./migrations/73-add-master-password-unlock-data";
import { MoveStateVersionMigrator } from "./migrations/8-move-state-version";
import { MoveBrowserSettingsToGlobal } from "./migrations/9-move-browser-settings-to-global";
import { MinVersionMigrator } from "./migrations/min-version";

export const MIN_VERSION = 3;
export const CURRENT_VERSION = 73;
export type MinVersion = typeof MIN_VERSION;

export function createMigrationBuilder() {
  return MigrationBuilder.create()
    .with(MinVersionMigrator)
    .with(RemoveEverBeenUnlockedMigrator, 3, 4)
    .with(AddKeyTypeToOrgKeysMigrator, 4, 5)
    .with(RemoveLegacyEtmKeyMigrator, 5, 6)
    .with(MoveBiometricAutoPromptToAccount, 6, 7)
    .with(MoveStateVersionMigrator, 7, 8)
    .with(MoveBrowserSettingsToGlobal, 8, 9)
    .with(EverHadUserKeyMigrator, 9, 10)
    .with(OrganizationKeyMigrator, 10, 11)
    .with(MoveEnvironmentStateToProviders, 11, 12)
    .with(ProviderKeyMigrator, 12, 13)
    .with(MoveBiometricClientKeyHalfToStateProviders, 13, 14)
    .with(FolderMigrator, 14, 15)
    .with(LastSyncMigrator, 15, 16)
    .with(EnablePasskeysMigrator, 16, 17)
    .with(AutofillSettingsKeyMigrator, 17, 18)
    .with(RequirePasswordOnStartMigrator, 18, 19)
    .with(PrivateKeyMigrator, 19, 20)
    .with(CollectionMigrator, 20, 21)
    .with(CollapsedGroupingsMigrator, 21, 22)
    .with(MoveBiometricPromptsToStateProviders, 22, 23)
    .with(SmOnboardingTasksMigrator, 23, 24)
    .with(ClearClipboardDelayMigrator, 24, 25)
    .with(RevertLastSyncMigrator, 25, 26)
    .with(BadgeSettingsMigrator, 26, 27)
    .with(MoveBiometricUnlockToStateProviders, 27, 28)
    .with(UserNotificationSettingsKeyMigrator, 28, 29)
    .with(PolicyMigrator, 29, 30)
    .with(EnableContextMenuMigrator, 30, 31)
    .with(PreferredLanguageMigrator, 31, 32)
    .with(AppIdMigrator, 32, 33)
    .with(DomainSettingsMigrator, 33, 34)
    .with(MoveThemeToStateProviderMigrator, 34, 35)
    .with(VaultSettingsKeyMigrator, 35, 36)
    .with(AvatarColorMigrator, 36, 37)
    .with(TokenServiceStateProviderMigrator, 37, 38)
    .with(MoveBillingAccountProfileMigrator, 38, 39)
    .with(OrganizationMigrator, 39, 40)
    .with(EventCollectionMigrator, 40, 41)
    .with(EnableFaviconMigrator, 41, 42)
    .with(AutoConfirmFingerPrintsMigrator, 42, 43)
    .with(UserDecryptionOptionsMigrator, 43, 44)
    .with(MergeEnvironmentState, 44, 45)
    .with(DeleteBiometricPromptCancelledData, 45, 46)
    .with(MoveDesktopSettingsMigrator, 46, 47)
    .with(MoveDdgToStateProviderMigrator, 47, 48)
    .with(AccountServerConfigMigrator, 48, 49)
    .with(KeyConnectorMigrator, 49, 50)
    .with(RememberedEmailMigrator, 50, 51)
    .with(DeleteInstalledVersion, 51, 52)
    .with(DeviceTrustServiceStateProviderMigrator, 52, 53)
    .with(SendMigrator, 53, 54)
    .with(MoveMasterKeyStateToProviderMigrator, 54, 55)
    .with(AuthRequestMigrator, 55, 56)
    .with(CipherServiceMigrator, 56, 57)
    .with(RemoveRefreshTokenMigratedFlagMigrator, 57, 58)
    .with(KdfConfigMigrator, 58, 59)
    .with(KnownAccountsMigrator, 59, 60)
    .with(PinStateMigrator, 60, 61)
    .with(VaultTimeoutSettingsServiceStateProviderMigrator, 61, 62)
    .with(PasswordOptionsMigrator, 62, 63)
    .with(GeneratorHistoryMigrator, 63, 64)
    .with(ForwarderOptionsMigrator, 64, 65)
    .with(MoveFinalDesktopSettingsMigrator, 65, 66)
    .with(RemoveUnassignedItemsBannerDismissed, 66, 67)
    .with(MoveLastSyncDate, 67, 68)
    .with(MigrateIncorrectFolderKey, 68, 69)
    .with(RemoveAcBannersDismissed, 69, 70)
    .with(RemoveNewCustomizationOptionsCalloutDismissed, 70, 71)
    .with(RemoveAccountDeprovisioningBannerDismissed, 71, 72)
    .with(AddMasterPasswordUnlockData, 72, CURRENT_VERSION);
}

export async function currentVersion(
  storageService: AbstractStorageService,
  logService: LogService,
) {
  let state = await storageService.get<number>("stateVersion");
  if (state == null) {
    // Pre v8
    state = (await storageService.get<{ stateVersion: number }>("global"))?.stateVersion;
  }
  if (state == null) {
    logService.info("No state version found, assuming empty state.");
    return -1;
  }
  logService.info(`State version: ${state}`);
  return state;
}

/**
 * Waits for migrations to have a chance to run and will resolve the promise once they are.
 *
 * @param storageService Disk storage where the `stateVersion` will or is already saved in.
 * @param logService Log service
 */
export async function waitForMigrations(
  storageService: AbstractStorageService,
  logService: LogService,
) {
  const isReady = async () => {
    const version = await currentVersion(storageService, logService);
    // The saved version is what we consider the latest
    // migrations should be complete, the state version
    // shouldn't become larger than `CURRENT_VERSION` in
    // any normal usage of the application but it is common
    // enough in dev scenarios where we want to consider that
    // ready as well and return true in that scenario.
    return version >= CURRENT_VERSION;
  };

  const wait = async (time: number) => {
    // Wait exponentially
    const nextTime = time * 2;
    if (nextTime > 8192) {
      // Don't wait longer than ~8 seconds in a single wait,
      // if the migrations still haven't happened. They aren't
      // likely to.
      return;
    }
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        if (!(await isReady())) {
          logService.info(`Waiting for migrations to finish, waiting for ${nextTime}ms`);
          await wait(nextTime);
        }
        resolve();
      }, time);
    });
  };

  if (!(await isReady())) {
    // Wait for 2ms to start with
    await wait(2);
  }
}
