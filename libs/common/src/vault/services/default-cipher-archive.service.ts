import { combineLatest, filter, firstValueFrom, map, Observable, shareReplay } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherBulkArchiveRequest,
  CipherBulkUnarchiveRequest,
} from "@bitwarden/common/vault/models/request/cipher-bulk-archive.request";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { CipherArchiveService } from "../abstractions/cipher-archive.service";
import { CipherData } from "../models/data/cipher.data";

export class DefaultCipherArchiveService implements CipherArchiveService {
  constructor(
    private cipherService: CipherService,
    private apiService: ApiService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  /**
   * Observable that contains the list of ciphers that have been archived.
   */
  archivedCiphers$(userId: UserId): Observable<CipherViewLike[]> {
    return this.cipherService.cipherListViews$(userId).pipe(
      filter((cipher) => cipher != null),
      map((ciphers) =>
        ciphers.filter(
          (cipher) =>
            CipherViewLikeUtils.isArchived(cipher) && !CipherViewLikeUtils.isDeleted(cipher),
        ),
      ),
    );
  }

  /**
   * User can archive items if:
   * User has premium from any source (personal or organization)
   */
  userCanArchive$(userId: UserId): Observable<boolean> {
    return this.billingAccountProfileStateService
      .hasPremiumFromAnySource$(userId)
      .pipe(shareReplay({ refCount: true, bufferSize: 1 }));
  }

  /** Returns true when the user has premium from any means. */
  userHasPremium$(userId: UserId): Observable<boolean> {
    return this.billingAccountProfileStateService
      .hasPremiumFromAnySource$(userId)
      .pipe(shareReplay({ refCount: true, bufferSize: 1 }));
  }

  /** Returns true when the user has previously archived ciphers but lost their premium membership. */
  showSubscriptionEndedMessaging$(userId: UserId): Observable<boolean> {
    return combineLatest([this.archivedCiphers$(userId), this.userHasPremium$(userId)]).pipe(
      map(([archivedCiphers, hasPremium]) => archivedCiphers.length > 0 && !hasPremium),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<CipherData> {
    const request = new CipherBulkArchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/archive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    const currentCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));
    const responseDataArray = response.data.map(
      (cipher) => new CipherData(cipher, currentCiphers[cipher.id as CipherId]?.collectionIds),
    );

    await this.cipherService.upsert(responseDataArray, userId);
    return response.data[0];
  }

  async unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<CipherData> {
    const request = new CipherBulkUnarchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/unarchive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    const currentCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));
    const responseDataArray = response.data.map(
      (cipher) => new CipherData(cipher, currentCiphers[cipher.id as CipherId]?.collectionIds),
    );

    await this.cipherService.upsert(responseDataArray, userId);
    return response.data[0];
  }
}
