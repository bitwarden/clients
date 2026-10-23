import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";
import { V1EmergencyAccessMembership, V1OrganizationMembership } from "@bitwarden/sdk-internal";
import {
  TrustVerificationResult,
  UserCryptoDialogService,
} from "@bitwarden/user-crypto-management";

import { KeyRotationTrustInfoComponent } from "../key-rotation/key-rotation-trust-info.component";

import { AccountRecoveryTrustComponent } from "./account-recovery-trust.component";
import { EmergencyAccessBulkTrustComponent } from "./emergency-access-bulk-trust.component";

/**
 * Default implementation of {@link UserCryptoDialogService} that prompts the user
 * to verify trust for organizations and emergency access grantees during user key
 * rotation by opening the corresponding Angular dialog components.
 */
export class DefaultUserCryptoDialogService implements UserCryptoDialogService {
  constructor(private dialogService: DialogService) {}

  async verifyTrust(
    organizationV1Memberships: V1OrganizationMembership[],
    emergencyAccessV1Memberships: V1EmergencyAccessMembership[],
  ): Promise<TrustVerificationResult> {
    // Emergency access contacts are listed in their own dialog, so the info dialog only covers
    // organizations.
    if (organizationV1Memberships.length > 0) {
      const trustInfoDialog = KeyRotationTrustInfoComponent.open(this.dialogService, {
        numberOfEmergencyAccessUsers: 0,
        orgName: organizationV1Memberships[0].name,
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

    let trustedEmergencyAccessMemberships: V1EmergencyAccessMembership[] = [];
    if (emergencyAccessV1Memberships.length > 0) {
      const dialogRef = EmergencyAccessBulkTrustComponent.open(this.dialogService, {
        contacts: emergencyAccessV1Memberships.map((details) => ({
          id: details.id as string,
          granteeId: details.grantee_id as string,
          name: details.name,
          publicKey: Utils.fromB64ToArray(details.public_key),
        })),
      });
      const trustedIds = await firstValueFrom(dialogRef.closed);
      if (trustedIds == null) {
        return {
          wasTrustDenied: true,
          trustedOrganizationPublicKeys: [],
          trustedEmergencyAccessUserPublicKeys: [],
        };
      }
      trustedEmergencyAccessMemberships = emergencyAccessV1Memberships.filter((details) =>
        trustedIds.includes(details.id as string),
      );
    }

    return {
      wasTrustDenied: false,
      trustedOrganizationPublicKeys: organizationV1Memberships.map((d) => d.public_key),
      trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessMemberships.map(
        (d) => d.public_key,
      ),
    };
  }
}
