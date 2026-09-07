import { inject, Injectable } from "@angular/core";
import { combineLatest, map, Observable, switchMap } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";

import { UserKeyRotationService } from "../key-rotation/user-key-rotation.service";

/**
 * Key management logic for the account security keys page.
 */
@Injectable()
export class SecurityKeysComponentService {
  private readonly accountService = inject(AccountService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly keyConnectorService = inject(KeyConnectorService);
  private readonly deviceTrustService = inject(DeviceTrustServiceAbstraction);
  private readonly userKeyRotationService = inject(UserKeyRotationService);

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
   * The key rotation must also go through the SDK. See
   * {@link UserKeyRotationService.shouldUseSdkKeyRotation$}.
   */
  readonly showKeyRotation$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
        this.keyConnectorService.getUsesKeyConnector(userId),
        this.keyConnectorService.getManagingOrganization(userId),
        this.deviceTrustService.supportsDeviceTrustByUserId$(userId),
        this.userKeyRotationService.shouldUseSdkKeyRotation$(userId),
      ]),
    ),
    map(
      ([
        hasMasterPassword,
        usesKeyConnector,
        managingOrganization,
        hasTdeKeys,
        useSdkKeyRotation,
      ]) => {
        const hasManagingKeyConnectorOrganization =
          usesKeyConnector && managingOrganization != null;
        const canRotate = hasMasterPassword || hasManagingKeyConnectorOrganization || hasTdeKeys;
        return canRotate && useSdkKeyRotation;
      },
    ),
  );
}
