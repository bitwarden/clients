import { catchError, from, map, mergeMap, Observable, of, tap, toArray } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import { CipherHealthView } from "../../../models";
import { CipherHealthService } from "../../abstractions/cipher-health.service";

/**
 * One password group's analysis: the exposure result shared by the whole group, plus a strength
 * score per cipher in it. Carries the password so the group can be found again when assembling.
 */
type PasswordGroupHealth = {
  password: string;
  exposedCount: number;
  failed: boolean;
  strengthByCipherId: Map<string, number | undefined>;
};

/**
 * Default implementation of CipherHealthService.
 *
 * Exposure lookups are not concurrency-limited here. {@link AuditService} owns the only limiter, so
 * a second one at this layer would just hide it: whichever is tighter wins, and neither is
 * discoverable from the other.
 */
export class DefaultCipherHealthService extends CipherHealthService {
  constructor(
    private auditService: AuditService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private logService: LogService,
  ) {
    super();
  }

  checkCipherHealth(ciphers: CipherView[]): Observable<Map<string, CipherHealthView>> {
    const validCiphers = ciphers.filter((c) => this.isValidCipher(c));

    if (validCiphers.length === 0) {
      return of(new Map());
    }

    // One grouping drives everything below: the exposure lookups, the reuse counts, and the
    // password each cipher maps back to. Reuse is the premise of the report, so grouping first
    // means the number of lookups tracks distinct passwords rather than cipher count.
    const ciphersByPassword = this.groupByPassword(validCiphers);
    const passwords = Array.from(ciphersByPassword.keys());

    const startedAt = performance.now();
    this.logService.debug(
      `[Cipher Health Perf] exposure lookups start: ciphers=${validCiphers.length} distinctPasswords=${passwords.length} (saved ${validCiphers.length - passwords.length} lookups)`,
    );

    return from(ciphersByPassword.entries()).pipe(
      mergeMap(([password, cipherGroup]) => this.analyzeGroup(password, cipherGroup)),
      toArray(),
      tap(() =>
        this.logService.debug(
          `[Cipher Health Perf] exposure lookups done: ${Math.round(performance.now() - startedAt)}ms`,
        ),
      ),
      map((groupHealths) => this.buildHealthMap(ciphersByPassword, groupHealths)),
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
          reuseCount: 0,
        }),
      );
    }

    return this.checkSingleCipherHealthInternal(cipher);
  }

  detectPasswordReuse(ciphers: CipherView[]): Observable<Map<string, string[]>> {
    const reuseMap = new Map<string, string[]>();

    this.groupByPassword(ciphers.filter((c) => this.isValidCipher(c))).forEach(
      (cipherGroup, password) => {
        // Only keep passwords that are reused (2+ ciphers)
        if (cipherGroup.length > 1) {
          reuseMap.set(
            password,
            cipherGroup.map((c) => c.id),
          );
        }
      },
    );

    return of(reuseMap);
  }

  /** Groups ciphers by their password. Ciphers without one are dropped. */
  private groupByPassword(ciphers: CipherView[]): Map<string, CipherView[]> {
    const grouped = new Map<string, CipherView[]>();

    for (const cipher of ciphers) {
      const password = this.getCipherPassword(cipher);
      if (!password) {
        continue;
      }

      const cipherGroup = grouped.get(password);
      if (cipherGroup) {
        cipherGroup.push(cipher);
      } else {
        grouped.set(password, [cipher]);
      }
    }

    return grouped;
  }

  /**
   * Analyzes one password group: looks up its exposure count and scores each cipher's strength.
   *
   * Never errors: a failed lookup reports zero, so one unreachable request cannot cancel the batch
   * and discard every lookup that already succeeded.
   */
  private analyzeGroup(
    password: string,
    cipherGroup: CipherView[],
  ): Observable<PasswordGroupHealth> {
    return from(this.auditService.passwordLeaked(password)).pipe(
      map((exposedCount) => ({ exposedCount, failed: false })),
      catchError(() => of({ exposedCount: 0, failed: true })),
      map(({ exposedCount, failed }) => ({
        password,
        exposedCount,
        failed,
        // Scored inside the fan-out on purpose. zxcvbn is synchronous and costs roughly a
        // millisecond per cipher, so scoring the whole vault after the last lookup returns lands as
        // one visible ~1s freeze. Here each group's scoring fills a gap between network responses.
        strengthByCipherId: this.scoreGroup(cipherGroup),
      })),
    );
  }

  private scoreGroup(cipherGroup: CipherView[]): Map<string, number | undefined> {
    const strengthByCipherId = new Map<string, number | undefined>();

    for (const cipher of cipherGroup) {
      strengthByCipherId.set(cipher.id, this.getPasswordStrength(cipher));
    }

    return strengthByCipherId;
  }

  /**
   * Fans each group's exposure result back out across every cipher sharing the password, and folds
   * in the strength scores computed during the fan-out.
   */
  private buildHealthMap(
    ciphersByPassword: Map<string, CipherView[]>,
    groupHealths: PasswordGroupHealth[],
  ): Map<string, CipherHealthView> {
    const failed = groupHealths.filter((g) => g.failed);

    if (failed.length > 0) {
      const affectedCiphers = failed.reduce(
        (total, g) => total + (ciphersByPassword.get(g.password)?.length ?? 0),
        0,
      );
      this.logService.warning(
        `[DefaultCipherHealthService] ${failed.length} of ${groupHealths.length} exposure lookups failed, affecting ${affectedCiphers} ciphers; those passwords are reported as not exposed.`,
      );
    }

    const healthMap = new Map<string, CipherHealthView>();

    for (const { password, exposedCount, strengthByCipherId } of groupHealths) {
      const cipherGroup = ciphersByPassword.get(password) ?? [];
      // A password held by a single cipher is not reuse, and reports a count of zero rather than one.
      const reuseCount = cipherGroup.length > 1 ? cipherGroup.length : 0;

      for (const cipher of cipherGroup) {
        const weakPasswordScore = strengthByCipherId.get(cipher.id);

        healthMap.set(
          cipher.id,
          new CipherHealthView({
            cipherId: cipher.id,
            hasWeakPassword: weakPasswordScore != null && weakPasswordScore <= 2,
            hasReusedPassword: reuseCount > 1,
            reuseCount,
            hasExposedPassword: exposedCount > 0,
            exposedCount,
            weakPasswordScore,
          }),
        );
      }
    }

    return healthMap;
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
          reuseCount: 0,
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
          reuseCount: 0, // Will be set by caller if checking multiple ciphers
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
