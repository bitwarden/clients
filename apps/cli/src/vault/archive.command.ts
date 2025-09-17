import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { UserId } from "@bitwarden/user-core";
import { CipherArchiveService } from "@bitwarden/vault";

import { Response } from "../models/response";

export class ArchiveCommand {
  constructor(
    private cipherService: CipherService,
    private accountService: AccountService,
    private configService: ConfigService,
    private cipherArchiveService: CipherArchiveService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async run(object: string, id: string): Promise<Response> {
    const featureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19148_InnovationArchive,
    );

    if (!featureFlagEnabled) {
      return Response.notFound();
    }

    if (id != null) {
      id = id.toLowerCase();
    }

    const normalizedObject = object.toLowerCase();

    if (normalizedObject === "item") {
      return this.archiveCipher(id);
    }

    return Response.badRequest("Unknown object.");
  }

  private async archiveCipher(cipherId: string) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(cipherId, activeUserId);

    if (cipher == null) {
      return Response.notFound();
    }

    const cipherView = await this.cipherService.decrypt(cipher, activeUserId);

    const { canArchive, errorMessage } = await this.userCanArchiveCipher(cipherView, activeUserId);

    if (!canArchive) {
      return Response.error(errorMessage);
    }

    try {
      await this.cipherArchiveService.archiveWithServer(cipherView.id as CipherId, activeUserId);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  /**
   * Determines if the user can archive the given cipher.
   * When the user cannot archive the cipher, an appropriate error message is provided.
   */
  private async userCanArchiveCipher(
    cipher: CipherView,
    userId: UserId,
  ): Promise<
    { canArchive: true; errorMessage?: never } | { canArchive: false; errorMessage: string }
  > {
    const hasPremiumFromAnySource = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
    );

    switch (true) {
      case !hasPremiumFromAnySource: {
        return {
          canArchive: false,
          errorMessage: "Premium status is required to use this feature.",
        };
      }
      case CipherViewLikeUtils.isArchived(cipher): {
        return { canArchive: false, errorMessage: "Item is already archived." };
      }
      case cipher.organizationId != null: {
        return { canArchive: false, errorMessage: "Cannot archive items in an organization." };
      }
      default:
        return { canArchive: true };
    }
  }
}
