import { catchError, EMPTY, firstValueFrom, map } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import {
  AccountRecoveryTrustComponent,
  EmergencyAccessTrustComponent,
  KeyRotationTrustInfoComponent,
} from "@bitwarden/key-management-ui";
import { LogService } from "@bitwarden/logging";
import { RotateUserKeysRequest } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

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
    private dialogService: DialogService,
  ) {}

  async changePasswordAndRotateUserKey(
    currentMasterPassword: string,
    newMasterPassword: string,
    hint: string | undefined,
    userId: UserId,
  ): Promise<void> {
    // First, the provided organizations and emergency access users need to be verified;
    // this is currently done by providing the user a manual confirmation dialog.
    const { wasTrustDenied, trustedOrganizationPublicKeys, trustedEmergencyAccessUserPublicKeys } =
      await this.verifyTrust(userId);
    if (wasTrustDenied) {
      this.logService.info("[Userkey rotation] Trust was denied by user. Aborting!");
      return;
    }

    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          this.logService.info("[UserKey Rotation] Re-encrypting user data with new user key...");
          await ref.value.user_crypto_management().rotate_user_keys({
            master_key_unlock_method: {
              Password: {
                old_password: currentMasterPassword,
                password: newMasterPassword,
                hint: hint,
              },
            },
            trusted_emergency_access_public_keys: trustedEmergencyAccessUserPublicKeys,
            trusted_organization_public_keys: trustedOrganizationPublicKeys,
          } as RotateUserKeysRequest);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to rotate user keys: ${error}`);
          return EMPTY;
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
    //
    // The flow works in 3 steps:
    // 1. Prepare the user by showing them a dialog telling them they'll be asked
    //    to verify the trust of their organizations and emergency access users.
    // 2. Show the user a dialog for each organization and ask them to verify the trust.
    // 3. Show the user a dialog for each emergency access user and ask them to verify the trust.
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

    if (organizationV1Memberships.length > 0 || emergencyAccessV1Memberships.length > 0) {
      this.logService.info("[Userkey rotation] Showing trust info dialog...");
      const trustInfoDialog = KeyRotationTrustInfoComponent.open(this.dialogService, {
        numberOfEmergencyAccessUsers: emergencyAccessV1Memberships.length,
        orgName:
          organizationV1Memberships.length > 0 ? organizationV1Memberships[0].name : undefined,
      });
      if (!(await firstValueFrom(trustInfoDialog.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    for (const organization of organizationV1Memberships) {
      const dialogRef = AccountRecoveryTrustComponent.open(this.dialogService, {
        name: organization.name,
        orgId: organization.organization_id as string,
        publicKey: Utils.fromB64ToArray(organization.public_key),
      });
      if (!(await firstValueFrom(dialogRef.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    for (const details of emergencyAccessV1Memberships) {
      const dialogRef = EmergencyAccessTrustComponent.open(this.dialogService, {
        name: details.name,
        userId: details.id as string,
        publicKey: Utils.fromB64ToArray(details.public_key),
      });
      if (!(await firstValueFrom(dialogRef.closed))) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
    }

    this.logService.info(
      "[Userkey rotation] Trust verified for all organizations and emergency access users",
    );
    return {
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: organizationV1Memberships.map((d) => d.public_key),
      trustedEmergencyAccessUserPublicKeys: emergencyAccessV1Memberships.map((d) => d.public_key),
    };
  }
}
