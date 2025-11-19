import { filter, map, Observable, shareReplay, combineLatest, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

export class DefaultCipherArchiveService implements CipherArchiveService {
  constructor(
    private cipherService: CipherService,
    private apiService: ApiService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private configService: ConfigService,
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
   * Feature Flag is enabled
   * User has premium from any source (personal or organization)
   */
  userCanArchive$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
      this.configService.getFeatureFlag$(FeatureFlag.PM19148_InnovationArchive),
    ]).pipe(
      map(([hasPremium, archiveFlagEnabled]) => hasPremium && archiveFlagEnabled),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  /** Returns true when the archive features should be shown. */
  hasArchiveFlagEnabled$: Observable<boolean> = this.configService
    .getFeatureFlag$(FeatureFlag.PM19148_InnovationArchive)
    .pipe(shareReplay({ refCount: true, bufferSize: 1 }));

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

  async archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void> {
    const request = new CipherBulkArchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/archive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    const currentCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));

    for (const cipher of response.data) {
      const localCipher = currentCiphers[cipher.id as CipherId];

      if (localCipher == null) {
        continue;
      }

      localCipher.archivedDate = cipher.archivedDate;
      localCipher.revisionDate = cipher.revisionDate;
    }

    await this.cipherService.replace(currentCiphers, userId);
  }

  async unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void> {
    const request = new CipherBulkUnarchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/unarchive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    const currentCiphers = await firstValueFrom(this.cipherService.ciphers$(userId));

    for (const cipher of response.data) {
      const localCipher = currentCiphers[cipher.id as CipherId];

      if (localCipher == null) {
        continue;
      }

      localCipher.archivedDate = cipher.archivedDate;
      localCipher.revisionDate = cipher.revisionDate;
    }

    await this.cipherService.replace(currentCiphers, userId);
  }
}
