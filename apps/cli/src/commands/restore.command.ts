import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { UserId } from "@bitwarden/user-core";
import { CipherArchiveService } from "@bitwarden/vault/services";

import { Response } from "../models/response";

export class RestoreCommand {
  constructor(
    private cipherService: CipherService,
    private accountService: AccountService,
    private cipherAuthorizationService: CipherAuthorizationService,
    private cipherArchiveService: CipherArchiveService,
    private configService: ConfigService,
  ) {}

  async run(object: string, id: string): Promise<Response> {
    if (id != null) {
      id = id.toLowerCase();
    }

    switch (object.toLowerCase()) {
      case "item":
        return await this.restoreCipher(id);
      default:
        return Response.badRequest("Unknown object.");
    }
  }

  private async restoreCipher(id: string) {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(id, activeUserId);
    const isArchivedVaultEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PM19148_InnovationArchive),
    );

    if (cipher == null) {
      return Response.notFound();
    }

    if (cipher.archivedDate && isArchivedVaultEnabled) {
      return this.restoreArchivedCipher(cipher, activeUserId);
    } else {
      return this.restoreDeletedCipher(cipher, activeUserId);
    }
  }

  /** Restores a cipher from the trash. */
  private async restoreDeletedCipher(cipher: Cipher, userId: UserId) {
    if (cipher.deletedDate == null) {
      return Response.badRequest("Cipher is not in trash.");
    }

    const canRestore = await firstValueFrom(
      this.cipherAuthorizationService.canRestoreCipher$(cipher),
    );

    if (!canRestore) {
      return Response.error("You do not have permission to restore this item");
    }

    try {
      await this.cipherService.restoreWithServer(cipher.id, userId);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }

  /** Restore a cipher from the archive vault */
  private async restoreArchivedCipher(cipher: Cipher, userId: UserId) {
    try {
      await this.cipherArchiveService.unarchiveWithServer(cipher.id as CipherId, userId);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }
}
