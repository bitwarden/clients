import { firstValueFrom, from, mergeMap, Observable, switchMap, toArray } from "rxjs";

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
  CipherRiskService as CipherRiskServiceAbstraction,
  PersonalVaultRiskSummary,
} from "../abstractions/cipher-risk.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";

const MAX_CONCURRENT_HIBP_CALLS = 5;

export class DefaultCipherRiskService implements CipherRiskServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private cipherService: CipherService,
    private auditService?: AuditService,
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
  ): Observable<PersonalVaultRiskSummary> {
    return new Observable<PersonalVaultRiskSummary>((subscriber) => {
      (async () => {
        const allCiphers = await firstValueFrom(
          this.cipherService.cipherViews$(userId).pipe(filterOutNullish()),
        );

        const personalLogins = allCiphers.filter(
          (c) =>
            c.type === CipherType.Login && !c.organizationId && !c.isDeleted && c.login?.password,
        );

        if (personalLogins.length === 0) {
          subscriber.next({ exposed: [], weak: [], reused: [], scannedAt: new Date() });
          subscriber.complete();
          return;
        }

        const passwordMap = await this.buildPasswordReuseMap(personalLogins, userId);
        const riskResults = await this.computeRiskForCiphers(personalLogins, userId, {
          ...options,
          checkExposed: false,
          passwordMap,
        });

        const cipherById = new Map<string, CipherView>(personalLogins.map((c) => [c.id, c]));

        const weak: CipherView[] = [];
        const reused: CipherView[] = [];
        for (const result of riskResults) {
          const cipher = cipherById.get(result.id as unknown as string);
          if (!cipher) {
            continue;
          }
          if (result.password_strength < 3) {
            weak.push(cipher);
          }
          if ((result.reuse_count ?? 1) > 1) {
            reused.push(cipher);
          }
        }

        let exposed: CipherView[] = [];
        if (this.auditService) {
          const hibpResults = await firstValueFrom(
            from(personalLogins).pipe(
              mergeMap(
                async (cipher) => ({
                  cipher,
                  count: await this.auditService!.passwordLeaked(cipher.login!.password!),
                }),
                MAX_CONCURRENT_HIBP_CALLS,
              ),
              toArray(),
            ),
          );
          exposed = hibpResults.filter(({ count }) => count > 0).map(({ cipher }) => cipher);
        }

        subscriber.next({ exposed, weak, reused, scannedAt: new Date() });
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
