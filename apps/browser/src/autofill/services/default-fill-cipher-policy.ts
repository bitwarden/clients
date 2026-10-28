import { map, Observable } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherUse, FillCipherPolicy, SaveCandidate } from "./abstractions/fill-cipher-policy";

/** Gives every use the stored ciphers from {@link CipherService}. */
export class DefaultFillCipherPolicy implements FillCipherPolicy {
  constructor(protected readonly cipherService: CipherService) {}

  changed$(userId: UserId): Observable<void> {
    return this.cipherService.ciphers$(userId).pipe(map((): void => undefined));
  }

  ciphers(userId: UserId, use: CipherUse): Promise<CipherView[]> {
    return this.cipherService.getAllDecrypted(userId);
  }

  ciphersForUrl(
    url: string,
    userId: UserId,
    use: CipherUse,
    options?: { includeOtherTypes?: CipherType[]; defaultMatch?: UriMatchStrategySetting },
  ): Promise<CipherView[]> {
    return this.cipherService.getAllDecryptedForUrl(
      url,
      userId,
      options?.includeOtherTypes,
      options?.defaultMatch,
    );
  }

  async lastLaunchedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined> {
    return (
      (await this.cipherService.getLastLaunchedForUrl(url, userId, autofillOnPageLoad)) ?? undefined
    );
  }

  async lastUsedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined> {
    return (
      (await this.cipherService.getLastUsedForUrl(url, userId, autofillOnPageLoad)) ?? undefined
    );
  }

  async nextCipherForUrl(url: string, userId: UserId): Promise<CipherView | undefined> {
    return (await this.cipherService.getNextCipherForUrl(url, userId)) ?? undefined;
  }

  advanceRotation(url: string): void {
    this.cipherService.updateLastUsedIndexForUrl(url);
  }

  async canOfferSave(form: SaveCandidate, userId: UserId): Promise<boolean> {
    return true;
  }
}
