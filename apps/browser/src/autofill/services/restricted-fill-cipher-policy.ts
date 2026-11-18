import { firstValueFrom, map, merge, Observable } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { CipherUse, FillCipherPolicy, SaveCandidate } from "./abstractions/fill-cipher-policy";

/**
 * Keeps ciphers of a type restricted by organization policy out of every Autofill lookup,
 * whichever {@link FillCipherPolicy} it wraps.
 */
export class RestrictedFillCipherPolicy implements FillCipherPolicy {
  constructor(
    private readonly inner: FillCipherPolicy,
    private readonly restrictedItemTypesService: RestrictedItemTypesService,
  ) {}

  changed$(userId: UserId): Observable<void> {
    return merge(
      this.inner.changed$(userId),
      this.restrictedItemTypesService.restrictedSet$.pipe(map((): void => undefined)),
    );
  }

  async ciphers(userId: UserId, use: CipherUse): Promise<CipherView[]> {
    return this.unrestricted(await this.inner.ciphers(userId, use));
  }

  async ciphersForIds(userId: UserId, ids: string[], use: CipherUse): Promise<CipherView[]> {
    return this.unrestricted(await this.inner.ciphersForIds(userId, ids, use));
  }

  async ciphersForUrl(
    url: string,
    userId: UserId,
    use: CipherUse,
    options?: { includeOtherTypes?: CipherType[]; defaultMatch?: UriMatchStrategySetting },
  ): Promise<CipherView[]> {
    return this.unrestricted(await this.inner.ciphersForUrl(url, userId, use, options));
  }

  async lastLaunchedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined> {
    return this.unrestrictedOne(
      await this.inner.lastLaunchedForUrl(url, userId, autofillOnPageLoad),
    );
  }

  async lastUsedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined> {
    return this.unrestrictedOne(await this.inner.lastUsedForUrl(url, userId, autofillOnPageLoad));
  }

  async nextCipherForUrl(url: string, userId: UserId): Promise<CipherView | undefined> {
    return this.unrestrictedOne(await this.inner.nextCipherForUrl(url, userId));
  }

  async nextCardCipher(userId: UserId): Promise<CipherView | undefined> {
    if (await this.isRestricted(CipherType.Card)) {
      return undefined;
    }
    return this.inner.nextCardCipher(userId);
  }

  async nextIdentityCipher(userId: UserId): Promise<CipherView | undefined> {
    if (await this.isRestricted(CipherType.Identity)) {
      return undefined;
    }
    return this.inner.nextIdentityCipher(userId);
  }

  advanceRotation(url: string): void {
    this.inner.advanceRotation(url);
  }

  canOfferSave(form: SaveCandidate, userId: UserId): Promise<boolean> {
    return this.inner.canOfferSave(form, userId);
  }

  private async isRestricted(type: CipherType): Promise<boolean> {
    return (await firstValueFrom(this.restrictedItemTypesService.restrictedSet$)).has(type);
  }

  private async unrestricted(ciphers: CipherView[]): Promise<CipherView[]> {
    const restricted = await firstValueFrom(this.restrictedItemTypesService.restrictedSet$);
    return restricted.size === 0 ? ciphers : ciphers.filter((c) => !restricted.has(c.type));
  }

  private async unrestrictedOne(cipher: CipherView | undefined): Promise<CipherView | undefined> {
    if (cipher == null) {
      return undefined;
    }
    return (await this.isRestricted(cipher.type)) ? undefined : cipher;
  }
}
