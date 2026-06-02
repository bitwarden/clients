import { catchError, EMPTY, firstValueFrom, map } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { LogService } from "@bitwarden/logging";
import {
  KeyRotationMethod,
  PasswordChangeAndRotateUserKeysRequest,
  RotateUserKeysRequest,
  UpgradeTokenAction,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { UserCryptoDialogService } from "./user-crypto-dialog.service.abstraction";
import {
  TrustVerificationResult,
  UserKeyRotationService,
} from "./user-key-rotation.service.abstraction";

/**
 * Service for rotating user keys using the SDK.
 * Handles key rotation and trust verification for organizations and emergency access users.
 */
export class DefaultUserKeyRotationService implements UserKeyRotationService {
  constructor(
    private sdkService: SdkService,
    private logService: LogService,
    private userCryptoDialogService: UserCryptoDialogService,
  ) {}

  async changePasswordAndRotateUserKey(
    currentMasterPassword: string,
    newMasterPassword: string,
    hint: string | undefined,
    userId: UserId,
  ): Promise<boolean> {
    // First, the provided organizations and emergency access users need to be verified;
    // this is currently done by providing the user a manual confirmation dialog.
    const { wasTrustDenied, trustedOrganizationPublicKeys, trustedEmergencyAccessUserPublicKeys } =
      await this.verifyTrust(userId);
    if (wasTrustDenied) {
      this.logService.info("[Userkey rotation] Trust was denied by user. Aborting!");
      return false;
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          this.logService.info("[UserKey Rotation] Re-encrypting user data with new user key...");
          await ref.value.user_crypto_management().password_change_and_rotate_user_keys({
            old_password: currentMasterPassword,
            password: newMasterPassword,
            hint: hint,
            trusted_emergency_access_public_keys: trustedEmergencyAccessUserPublicKeys,
            trusted_organization_public_keys: trustedOrganizationPublicKeys,
          } as PasswordChangeAndRotateUserKeysRequest);
          return true;
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to rotate user keys: ${error}`);
          return EMPTY;
        }),
      ),
    );
  }

  async rotateUserKey(
    keyRotationMethod: KeyRotationMethod,
    upgradeTokenAction: UpgradeTokenAction,
    userId: UserId,
  ): Promise<boolean> {
    const { wasTrustDenied, trustedOrganizationPublicKeys, trustedEmergencyAccessUserPublicKeys } =
      await this.verifyTrust(userId);
    if (wasTrustDenied) {
      this.logService.info("[UserKeyRotationService] Trust was denied by user. Aborting!");
      return false;
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          this.logService.info(
            "[UserKeyRotationService] Re-encrypting user data with new user key...",
          );
          await ref.value.user_crypto_management().rotate_user_keys({
            key_rotation_method: keyRotationMethod,
            trusted_emergency_access_public_keys: trustedEmergencyAccessUserPublicKeys,
            trusted_organization_public_keys: trustedOrganizationPublicKeys,
            upgrade_token_action: upgradeTokenAction,
          } as RotateUserKeysRequest);
          return true;
        }),
      ),
    );
  }

  async verifyTrust(userId: UserId): Promise<TrustVerificationResult> {
    // Since currently the joined organizations and emergency access grantees are
    // not signed, manual trust prompts are required, to verify that the server
    // does not inject public keys here.
    //
    // Once signing is implemented, this is the place to also sign the keys and
    // upload the signed trust claims.
    this.logService.info("[Userkey rotation] Verifying trust...");
    const [emergencyAccessV1Memberships, organizationV1Memberships] = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          const emergencyAccessV1Memberships = await ref.value
            .user_crypto_management()
            .get_untrusted_emergency_access_public_keys();
          const organizationV1Memberships = await ref.value
            .user_crypto_management()
            .get_untrusted_organization_public_keys();
          return [emergencyAccessV1Memberships, organizationV1Memberships] as const;
        }),
      ),
    );
    this.logService.info("result", { emergencyAccessV1Memberships, organizationV1Memberships });

    return this.userCryptoDialogService.verifyTrust(
      organizationV1Memberships,
      emergencyAccessV1Memberships,
    );
  }
}
