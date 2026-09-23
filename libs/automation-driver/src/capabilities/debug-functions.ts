import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  InternalMasterPasswordServiceAbstraction,
  syncLegacyMasterKeyState,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { withPasswordManagerSdk } from "@bitwarden/common/key-management/utils";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Kdf, KeyRotationMethod, UpgradeTokenAction } from "@bitwarden/sdk-internal";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { AutomationCapability } from "../automation-capability";

/**
 * Invokes key management operations directly, bypassing the UI, for the active user.
 * Validation normally done by the UI (e.g. KDF minimums) is skipped.
 */
export class DebugFunctionsCapability extends AutomationCapability {
  readonly automationName = "debugFunctions";

  constructor(
    private accountService: AccountService,
    private sdkService: SdkService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private userKeyRotationService: UserKeyRotationServiceAbstraction,
  ) {
    super();
  }

  /**
   * Change the active user's KDF settings.
   *
   * @example
   * await debugFunctions.changeKdf("pw", { pBKDF2: { iterations: 600000 } });
   */
  async changeKdf(masterPassword: string, kdf: Kdf): Promise<void> {
    const userId = await this.activeUserId();

    await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      await sdk.user_crypto_management().change_kdf(masterPassword, kdf);
    });
    await syncLegacyMasterKeyState(userId, masterPassword, this.masterPasswordService);
  }

  /**
   * Rotate the active user's user key. Resolves `false` when trust was denied.
   *
   * @example
   * await debugFunctions.rotateUserKey({ Password: { password: "pw" } }, "CreateIfNeeded");
   */
  async rotateUserKey(
    keyRotationMethod: KeyRotationMethod,
    upgradeTokenAction: UpgradeTokenAction,
  ): Promise<boolean> {
    const userId = await this.activeUserId();

    return await this.userKeyRotationService.rotateUserKey(
      keyRotationMethod,
      upgradeTokenAction,
      userId,
    );
  }

  private async activeUserId() {
    return await firstValueFrom(getUserId(this.accountService.activeAccount$));
  }
}
