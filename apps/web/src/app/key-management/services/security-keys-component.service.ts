import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, switchMap } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptionType } from "@bitwarden/legacy-crypto";

/**
 * Key management logic for the account security keys page.
 */
@Injectable()
export class SecurityKeysComponentService {
  private readonly accountService = inject(AccountService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly keyConnectorService = inject(KeyConnectorService);
  private readonly deviceTrustService = inject(DeviceTrustServiceAbstraction);
  private readonly keyService = inject(KeyService);
  private readonly configService = inject(ConfigService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /**
   * The KDF settings derive the master key, so only a master password user can change them.
   */
  readonly showChangeKdf$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) => this.userDecryptionOptionsService.hasMasterPasswordById$(userId)),
  );

  /**
   * Whether to show the manual key rotation section.
   *
   * The user must unlock with a method that the key rotation dialog supports: a master password,
   * Key Connector with a managing organization, or trusted device encryption.
   *
   * The rotation must also be able to keep the user's key version. See
   * {@link rotatesWithoutPasswordChange$}.
   */
  readonly showKeyRotation$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
        this.keyConnectorService.getUsesKeyConnector(userId),
        this.keyConnectorService.getManagingOrganization(userId),
        this.deviceTrustService.supportsDeviceTrustByUserId$(userId),
        this.rotatesWithoutPasswordChange$(userId),
      ]),
    ),
    map(
      ([
        hasMasterPassword,
        usesKeyConnector,
        managingOrganization,
        hasTdeKeys,
        rotatesWithoutPasswordChange,
      ]) => {
        const hasManagingKeyConnectorOrganization =
          usesKeyConnector && managingOrganization != null;
        const canRotate = hasMasterPassword || hasManagingKeyConnectorOrganization || hasTdeKeys;
        return canRotate && rotatesWithoutPasswordChange;
      },
    ),
  );

  /**
   * Whether the user key can rotate without a password change.
   *
   * That rotation always produces a V2 user key. A V1 user may only take it while
   * `force-upgrade-v2-encryption` is on. Otherwise older devices that cannot read V2 data lose
   * access to the vault. A V1 user can still rotate through a password change, which keeps V1.
   */
  private rotatesWithoutPasswordChange$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.keyService.userKey$(userId),
      this.configService.getFeatureFlag$(FeatureFlag.ForceUpgradeV2Encryption),
    ]).pipe(
      map(([userKey, forceUpgradeV2]) => {
        if (userKey == null) {
          return false;
        }

        const isV1 = userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64;
        return !isV1 || forceUpgradeV2;
      }),
    );
  }
}
