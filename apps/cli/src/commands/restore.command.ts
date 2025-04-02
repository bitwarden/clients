import { combineLatest, firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";

import { Response } from "../models/response";

export class RestoreCommand {
  constructor(
    private cipherService: CipherService,
    private accountService: AccountService,
    private configService: ConfigService,
    private cipherAuthorizationService: CipherAuthorizationService,
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

    if (cipher == null) {
      return Response.notFound();
    }
    if (cipher.deletedDate == null) {
      return Response.badRequest("Cipher is not in trash.");
    }

    const canRestore = await firstValueFrom(
      combineLatest([
        this.configService.getFeatureFlag$(FeatureFlag.LimitItemDeletion),
        this.cipherAuthorizationService.canRestoreCipher$(cipher),
      ]).pipe(
        map(([enabled, canRestore]) => {
          if (enabled && !canRestore) {
            return false;
          }
          return true;
        }),
      ),
    );

    if (!canRestore) {
      return Response.error("You do not have permission to restore this item");
    }

    try {
      await this.cipherService.restoreWithServer(id, activeUserId);
      return Response.success();
    } catch (e) {
      return Response.error(e);
    }
  }
}
