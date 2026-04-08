import { forkJoin, from, map, mergeMap, Observable, of, toArray } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherHealthView } from "../../../models";
import { CipherHealthService } from "../../abstractions/cipher-health.service";

/**
 * Default implementation of CipherHealthService.
 *
 * Concurrency-limits HIBP calls to prevent rate limiting.
 */
export class DefaultCipherHealthService extends CipherHealthService {
  private readonly MAX_CONCURRENT_HIBP_CALLS = 5;

  constructor(
    private auditService: AuditService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
  ) {
    super();
  }

  checkCipherHealth(ciphers: CipherView[]): Observable<Map<string, CipherHealthView>> {
    const validCiphers = ciphers.filter((c) => this.isValidCipher(c));

    if (validCiphers.length === 0) {
      return of(new Map());
    }

    // Detect password reuse across all ciphers
    const reuseMap$ = this.detectPasswordReuse(validCiphers);

    // Check each cipher's health (weak password + HIBP exposure)
    const healthChecks$ = from(validCiphers).pipe(
      // Limit concurrent HIBP calls to avoid rate limiting
      mergeMap(
        (cipher) => this.checkSingleCipherHealthInternal(cipher),
        this.MAX_CONCURRENT_HIBP_CALLS,
      ),
      toArray(),
    );

    // Combine reuse detection with individual health checks
    return forkJoin({
      reuseMap: reuseMap$,
      healthResults: healthChecks$,
    }).pipe(
      map(({ reuseMap, healthResults }) => {
        const healthMap = new Map<string, CipherHealthView>();

        healthResults.forEach((health) => {
          // Check if this cipher's password is reused
          const password = this.getCipherPassword(
            validCiphers.find((c) => c.id === health.cipherId)!,
          );
          const reusedCipherIds = password ? reuseMap.get(password) : undefined;
          health.hasReusedPassword = reusedCipherIds ? reusedCipherIds.length > 1 : false;

          healthMap.set(health.cipherId, health);
        });

        return healthMap;
      }),
    );
  }

  checkSingleCipherHealth(cipher: CipherView): Observable<CipherHealthView> {
    if (!this.isValidCipher(cipher)) {
      return of(
        new CipherHealthView({
          cipherId: cipher.id,
          hasWeakPassword: false,
          hasReusedPassword: false,
          hasExposedPassword: false,
          exposedCount: 0,
        }),
      );
    }

    return this.checkSingleCipherHealthInternal(cipher);
  }

  detectPasswordReuse(ciphers: CipherView[]): Observable<Map<string, string[]>> {
    const passwordMap = new Map<string, string[]>();

    ciphers.forEach((cipher) => {
      if (!this.isValidCipher(cipher)) {
        return;
      }

      const password = this.getCipherPassword(cipher);
      if (!password) {
        return;
      }

      if (!passwordMap.has(password)) {
        passwordMap.set(password, []);
      }
      passwordMap.get(password)!.push(cipher.id);
    });

    // Only keep passwords that are reused (2+ ciphers)
    const reuseMap = new Map<string, string[]>();
    passwordMap.forEach((cipherIds, password) => {
      if (cipherIds.length > 1) {
        reuseMap.set(password, cipherIds);
      }
    });

    return of(reuseMap);
  }

  private checkSingleCipherHealthInternal(cipher: CipherView): Observable<CipherHealthView> {
    const password = this.getCipherPassword(cipher);
    if (!password) {
      return of(
        new CipherHealthView({
          cipherId: cipher.id,
          hasWeakPassword: false,
          hasReusedPassword: false,
          hasExposedPassword: false,
          exposedCount: 0,
        }),
      );
    }

    // Check weak password
    const weakPasswordScore = this.getPasswordStrength(cipher);
    const hasWeakPassword = weakPasswordScore != null && weakPasswordScore <= 2;

    // Check HIBP exposure
    return from(this.auditService.passwordLeaked(password)).pipe(
      map((exposedCount) => {
        return new CipherHealthView({
          cipherId: cipher.id,
          hasWeakPassword,
          hasReusedPassword: false, // Will be set by caller if checking multiple ciphers
          hasExposedPassword: exposedCount > 0,
          exposedCount,
          weakPasswordScore,
        });
      }),
    );
  }

  private getPasswordStrength(cipher: CipherView): number | undefined {
    if (!this.isValidCipher(cipher)) {
      return undefined;
    }

    const password = this.getCipherPassword(cipher);
    if (!password) {
      return undefined;
    }

    // Extract username parts for better strength analysis
    const userInput = this.isUsernameNotEmpty(cipher)
      ? this.extractUsernameParts(cipher.login.username!)
      : undefined;

    const { score } = this.passwordStrengthService.getPasswordStrength(
      password,
      undefined, // No email available in this context
      userInput,
    );

    return score;
  }

  private extractUsernameParts(cipherUsername: string): string[] {
    const atPosition = cipherUsername.indexOf("@");
    const userNameToProcess =
      atPosition > -1 ? cipherUsername.substring(0, atPosition) : cipherUsername;

    return userNameToProcess
      .trim()
      .toLowerCase()
      .split(/[^A-Za-z0-9]/);
  }

  private isUsernameNotEmpty(cipher: CipherView): boolean {
    return !Utils.isNullOrWhitespace(cipher.login.username);
  }

  private getCipherPassword(cipher: CipherView): string | undefined {
    return cipher.login?.password || undefined;
  }

  private isValidCipher(cipher: CipherView): boolean {
    const { type, login, isDeleted, viewPassword } = cipher;
    if (
      type !== CipherType.Login ||
      login?.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return false;
    }
    return true;
  }
}
