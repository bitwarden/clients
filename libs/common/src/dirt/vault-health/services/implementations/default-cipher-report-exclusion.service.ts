import { distinctUntilChanged, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { ApiService } from "../../../../abstractions/api.service";
import { FeatureFlag } from "../../../../enums/feature-flag.enum";
import { ConfigService } from "../../../../platform/abstractions/config/config.service";
import { CipherId, UserId } from "../../../../types/guid";
import { CipherService } from "../../../../vault/abstractions/cipher.service";
import { CipherData } from "../../../../vault/models/data/cipher.data";
import { CipherReportExclusionService } from "../abstractions/cipher-report-exclusion.service";

export class DefaultCipherReportExclusionService implements CipherReportExclusionService {
  constructor(
    private apiService: ApiService,
    private cipherService: CipherService,
    private configService: ConfigService,
  ) {}

  excludedCipherIds$(userId: UserId): Observable<ReadonlySet<string>> {
    return this.configService.getFeatureFlag$(FeatureFlag.HealthReportExclusions).pipe(
      switchMap((enabled) => (enabled ? this.storedExclusions$(userId) : of(new Set<string>()))),
      distinctUntilChanged((a, b) => a.size === b.size && [...a].every((id) => b.has(id))),
    );
  }

  private storedExclusions$(userId: UserId): Observable<ReadonlySet<string>> {
    return this.cipherService.ciphers$(userId).pipe(
      map(
        (ciphers) =>
          new Set(
            Object.values(ciphers)
              .filter((cipher) => cipher.excludedFromReports === true)
              .map((cipher) => cipher.id),
          ),
      ),
    );
  }

  async excludeWithServer(cipherId: CipherId, userId: UserId): Promise<void> {
    await this.apiService.send(
      "PUT",
      `/ciphers/${cipherId}/exclude-from-reports`,
      null,
      true,
      false,
    );

    const cipher = (await firstValueFrom(this.cipherService.ciphers$(userId)))[cipherId];
    if (cipher == null) {
      return;
    }
    await this.cipherService.upsert(
      Object.assign(new CipherData(), cipher, { excludedFromReports: true }),
      userId,
    );
  }
}
