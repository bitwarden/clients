import { Observable, catchError, debounceTime, from, map, of, shareReplay, switchMap } from "rxjs";

import { CipherDecryptionFailure } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { CipherId, UserId } from "../../types/guid";
import { CipherDecryptionFailureService } from "../abstractions/cipher-decryption-failure.service";
import { CipherSdkService } from "../abstractions/cipher-sdk.service";
import { CipherService } from "../abstractions/cipher.service";
import { CipherDecryptionFailureMap } from "../models/cipher-decryption-failure";
import { Cipher } from "../models/domain/cipher";

const DIAGNOSTICS_DEBOUNCE_MS = 250;
const EMPTY_MAP: CipherDecryptionFailureMap = new Map();

export class DefaultCipherDecryptionFailureService implements CipherDecryptionFailureService {
  private readonly cache = new Map<UserId, Observable<CipherDecryptionFailureMap>>();

  constructor(
    private cipherService: CipherService,
    private cipherSdkService: CipherSdkService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  decryptionFailuresByCipher$(userId: UserId): Observable<CipherDecryptionFailureMap> {
    let cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    cached = this.configService.getFeatureFlag$(FeatureFlag.PMXXXXX_GracefulCipherDecryption).pipe(
      switchMap((enabled) => {
        // eslint-disable-next-line no-console
        console.log("[graceful] flag enabled =", enabled, "userId =", userId);
        if (!enabled) {
          return of(EMPTY_MAP);
        }
        return this.cipherService.ciphers$(userId).pipe(
          debounceTime(DIAGNOSTICS_DEBOUNCE_MS),
          map((ciphersData) => Object.values(ciphersData ?? {}).map((data) => new Cipher(data))),
          switchMap((ciphers) => {
            // eslint-disable-next-line no-console
            console.log("[graceful] calling decryptListGraceful on", ciphers.length, "ciphers");
            return from(this.cipherSdkService.decryptListGraceful(userId, ciphers));
          }),
          map((result): CipherDecryptionFailureMap => {
            const failures = new Map<CipherId, CipherDecryptionFailure[]>();
            for (const view of result.successes ?? []) {
              if (!view.id) {
                continue;
              }
              const list = view.decryptionFailures;
              if (list && list.length > 0) {
                failures.set(uuidAsString(view.id) as CipherId, list);
              }
            }
            // eslint-disable-next-line no-console
            console.log("[graceful] SDK result:", {
              successes: result.successes?.length ?? 0,
              wholeCipherFailures: result.failures?.length ?? 0,
              ciphersWithFieldFailures: failures.size,
              map: Array.from(failures.entries()).map(([id, list]) => ({
                id,
                paths: list.map((f) => f.path),
                variants: list.map((f) => f.errorVariant),
              })),
            });
            return failures;
          }),
          catchError((error: unknown) => {
            // eslint-disable-next-line no-console
            console.error("[graceful] decryptListGraceful threw:", error);
            this.logService.error(`Failed to compute cipher decryption diagnostics: ${error}`);
            return of(EMPTY_MAP);
          }),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.cache.set(userId, cached);
    return cached;
  }
}
