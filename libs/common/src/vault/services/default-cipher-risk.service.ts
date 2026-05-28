import { firstValueFrom, from, mergeMap, Observable, switchMap, tap, toArray } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  CipherLoginDetails,
  CipherRiskOptions,
  PasswordReuseMap,
  CipherRiskResult,
  CipherId as SdkCipherId,
} from "@bitwarden/sdk-internal";

import { SdkService, asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId, CipherId } from "../../types/guid";
import {
  CipherRiskCounts,
  CipherRiskService as CipherRiskServiceAbstraction,
  PersonalVaultRiskUpdate,
  WEAK_PASSWORD_STRENGTH_THRESHOLD,
} from "../abstractions/cipher-risk.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";

const MAX_CONCURRENT_HIBP_CALLS = 5;

// Progress reporting splits the scan into two visible phases for the UI: the
// in-process risk computation (strength/reuse) takes the first slice of the
// bar, and HIBP breach checks fill the rest. These constants must sum to 100.
const ANALYZING_BASE_PERCENT = 30;
const HIBP_PERCENT_RANGE = 70;

export class DefaultCipherRiskService implements CipherRiskServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private cipherService: CipherService,
    private auditService: AuditService,
  ) {}

  async computeRiskForCiphers(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRiskResult[]> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return [];
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          const cipherRiskClient = ref.value.vault().cipher_risk();
          return await cipherRiskClient.compute_risk(
            loginDetails,
            options ?? { checkExposed: false },
          );
        }),
      ),
    );
  }

  async computeCipherRiskForUser(
    cipherId: CipherId,
    userId: UserId,
    checkExposed: boolean = true,
  ): Promise<CipherRiskResult> {
    // Get all ciphers for the user
    const allCiphers = await firstValueFrom(
      this.cipherService.cipherViews$(userId).pipe(filterOutNullish()),
    );

    // Find the specific cipher
    const targetCipher = allCiphers?.find((c) => asUuid<CipherId>(c.id) === cipherId);
    if (!targetCipher) {
      throw new Error(`Cipher with id ${cipherId} not found`);
    }

    // Build fresh password reuse map from all ciphers
    const passwordMap = await this.buildPasswordReuseMap(allCiphers, userId);

    // Call existing computeRiskForCiphers with single cipher and map
    const results = await this.computeRiskForCiphers([targetCipher], userId, {
      passwordMap,
      checkExposed,
    });
    return results[0];
  }

  async buildPasswordReuseMap(ciphers: CipherView[], userId: UserId): Promise<PasswordReuseMap> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return {};
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          const cipherRiskClient = ref.value.vault().cipher_risk();
          return cipherRiskClient.password_reuse_map(loginDetails);
        }),
      ),
    );
  }

  computeRiskForPersonalVault(
    userId: UserId,
    options?: Omit<CipherRiskOptions, "checkExposed">,
  ): Observable<PersonalVaultRiskUpdate> {
    return new Observable<PersonalVaultRiskUpdate>((subscriber) => {
      (async () => {
        const allCiphers = await firstValueFrom(
          this.cipherService.cipherViews$(userId).pipe(filterOutNullish()),
        );
        if (subscriber.closed) {
          return;
        }

        const personalLogins = allCiphers.filter(
          (c) =>
            c.type === CipherType.Login && !c.organizationId && !c.isDeleted && c.login?.password,
        );

        const total = personalLogins.length;
        subscriber.next({
          type: "progress",
          phase: "preparing",
          processed: 0,
          total,
          percent: 0,
        });

        if (total === 0) {
          subscriber.next({
            type: "result",
            summary: {
              exposed: [],
              weak: [],
              reused: [],
              riskCounts: new Map(),
              scannedAt: new Date(),
            },
          });
          subscriber.complete();
          return;
        }

        const passwordMap = await this.buildPasswordReuseMap(personalLogins, userId);
        if (subscriber.closed) {
          return;
        }
        const riskResults = await this.computeRiskForCiphers(personalLogins, userId, {
          ...options,
          checkExposed: false,
          passwordMap,
        });
        if (subscriber.closed) {
          return;
        }

        subscriber.next({
          type: "progress",
          phase: "analyzing",
          processed: total,
          total,
          percent: ANALYZING_BASE_PERCENT,
        });

        const cipherById = new Map<string, CipherView>(personalLogins.map((c) => [c.id, c]));
        const countsByCipherId = new Map<CipherId, CipherRiskCounts>();
        const getOrInitCounts = (cipherId: CipherId): CipherRiskCounts => {
          let counts = countsByCipherId.get(cipherId);
          if (!counts) {
            counts = { exposedBreaches: 0, reuseCount: 1, weak: false };
            countsByCipherId.set(cipherId, counts);
          }
          return counts;
        };

        const weak: CipherView[] = [];
        const reused: CipherView[] = [];
        for (const result of riskResults) {
          const cipher = cipherById.get(result.id as unknown as string);
          if (!cipher) {
            continue;
          }
          const cipherId = cipher.id as CipherId;
          const isWeak = result.password_strength < WEAK_PASSWORD_STRENGTH_THRESHOLD;
          const reuseCount = result.reuse_count ?? 1;
          const isReused = reuseCount > 1;
          if (isWeak) {
            weak.push(cipher);
          }
          if (isReused) {
            reused.push(cipher);
          }
          if (isWeak || isReused) {
            const counts = getOrInitCounts(cipherId);
            counts.weak = isWeak;
            counts.reuseCount = reuseCount;
          }
        }

        const exposed: CipherView[] = [];
        let processed = 0;
        const hibpResults = await firstValueFrom(
          from(personalLogins).pipe(
            mergeMap(async (cipher) => {
              try {
                return {
                  cipher,
                  count: await this.auditService.passwordLeaked(cipher.login!.password!),
                };
              } catch {
                // A transient HIBP failure for one cipher must not kill the whole scan —
                // fall back to 0 so the rest of the results still surface.
                return { cipher, count: 0 };
              }
            }, MAX_CONCURRENT_HIBP_CALLS),
            tap(() => {
              processed++;
              subscriber.next({
                type: "progress",
                phase: "checkingBreaches",
                processed,
                total,
                percent:
                  ANALYZING_BASE_PERCENT + Math.round((processed / total) * HIBP_PERCENT_RANGE),
              });
            }),
            toArray(),
          ),
        );
        if (subscriber.closed) {
          return;
        }
        for (const { cipher, count } of hibpResults) {
          if (count > 0) {
            exposed.push(cipher);
            getOrInitCounts(cipher.id as CipherId).exposedBreaches = count;
          }
        }

        // A cipher belongs to only its worst category so counts stay honest and a
        // single dismissal doesn't read as inconsistent across lists. Priority:
        // exposed > weak > reused. `riskCounts` still reflects every risk for the
        // confirm dialog.
        const exposedIds = new Set(exposed.map((c) => c.id));
        const dedupedWeak = weak.filter((c) => !exposedIds.has(c.id));
        const dedupedWeakIds = new Set(dedupedWeak.map((c) => c.id));
        const dedupedReused = reused.filter(
          (c) => !exposedIds.has(c.id) && !dedupedWeakIds.has(c.id),
        );

        subscriber.next({
          type: "result",
          summary: {
            exposed,
            weak: dedupedWeak,
            reused: dedupedReused,
            riskCounts: countsByCipherId,
            scannedAt: new Date(),
          },
        });
        subscriber.complete();
      })().catch((err) => subscriber.error(err));
    });
  }

  /**
   * Maps CipherView array to CipherLoginDetails array for SDK consumption.
   * Only includes Login ciphers with non-empty passwords.
   */
  private mapToLoginDetails(ciphers: CipherView[]): CipherLoginDetails[] {
    return ciphers
      .filter((cipher) => {
        return (
          cipher.type === CipherType.Login &&
          cipher.login?.password != null &&
          cipher.login.password !== "" &&
          !cipher.isDeleted
        );
      })
      .map(
        (cipher) =>
          ({
            id: asUuid<SdkCipherId>(cipher.id),
            password: cipher.login.password!,
            username: cipher.login.username,
          }) satisfies CipherLoginDetails,
      );
  }
}
