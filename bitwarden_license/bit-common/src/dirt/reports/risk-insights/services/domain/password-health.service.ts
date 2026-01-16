import { Injectable } from "@angular/core";
import {
  bufferCount,
  filter,
  from,
  map,
  mergeMap,
  Observable,
  scan,
  startWith,
  toArray,
} from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ExposedPasswordDetail,
  WeakPasswordDetail,
  WeakPasswordScore,
} from "../../models/password-health";

/**
 * State of HIBP (Have I Been Pwned) password checking (per ADR-0025 - no enums)
 */
export const HibpCheckState = Object.freeze({
  NotStarted: "not-started",
  Checking: "checking",
  Complete: "complete",
  Error: "error",
} as const);
export type HibpCheckState = (typeof HibpCheckState)[keyof typeof HibpCheckState];

/**
 * Progress result for progressive HIBP password checking
 */
export interface HibpProgressResult {
  /** Current state of the HIBP check */
  state: HibpCheckState;
  /** Number of passwords checked so far */
  checkedCount: number;
  /** Total number of passwords to check */
  totalCount: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Exposed passwords found so far */
  exposedPasswords: ExposedPasswordDetail[];
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Error message if state is Error */
  error?: string;
}

@Injectable()
export class PasswordHealthService {
  constructor(
    private auditService: AuditService,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
  ) {}

  /**
   * Finds exposed passwords in a list of ciphers.
   *
   * @param ciphers The list of ciphers to check.
   * @returns An observable that emits an array of ExposedPasswordDetail.
   */
  auditPasswordLeaks$(ciphers: CipherView[]): Observable<ExposedPasswordDetail[]> {
    return from(ciphers).pipe(
      filter((cipher) => this.isValidCipher(cipher)),
      mergeMap((cipher) =>
        this.auditService
          .passwordLeaked(cipher.login.password!)
          .then((exposedCount) => ({ cipher, exposedCount })),
      ),
      // [FIXME] ExposedDetails is can still return a null
      filter(({ exposedCount }) => exposedCount > 0),
      map(({ cipher, exposedCount }) => ({
        exposedXTimes: exposedCount,
        cipherId: cipher.id,
      })),
      toArray(),
    );
  }

  /**
   * Progressive version of auditPasswordLeaks$ that emits progress updates
   * as passwords are checked against HIBP.
   *
   * @param ciphers The list of ciphers to check.
   * @param batchEmitSize How often to emit progress updates (default: 500 passwords).
   * @returns An observable that emits HibpProgressResult with progress updates.
   */
  auditPasswordLeaksProgressive$(
    ciphers: CipherView[],
    batchEmitSize: number = 500,
  ): Observable<HibpProgressResult> {
    const validCiphers = ciphers.filter((c) => this.isValidCipher(c));
    const totalCount = validCiphers.length;
    const startTime = performance.now();

    if (totalCount === 0) {
      // No valid ciphers to check - emit immediate completion
      return from([
        {
          state: HibpCheckState.Complete,
          checkedCount: 0,
          totalCount: 0,
          progressPercent: 100,
          exposedPasswords: [],
          elapsedMs: 0,
        } as HibpProgressResult,
      ]);
    }

    // Accumulator for scan operator
    interface ProgressAccumulator {
      checkedCount: number;
      exposedPasswords: ExposedPasswordDetail[];
    }

    return from(validCiphers).pipe(
      // Use mergeMap with concurrency matching audit service (100 concurrent)
      mergeMap(
        (cipher) =>
          from(this.auditService.passwordLeaked(cipher.login.password!)).pipe(
            map((exposedCount) => ({ cipherId: cipher.id, exposedCount })),
          ),
        100,
      ),
      // Buffer results and emit every batchEmitSize checks
      bufferCount(batchEmitSize),
      // Use scan to accumulate results across batches
      scan(
        (acc: ProgressAccumulator, batch) => {
          const newExposed = batch
            .filter((result) => result.exposedCount > 0)
            .map((result) => ({
              cipherId: result.cipherId,
              exposedXTimes: result.exposedCount,
            }));

          return {
            checkedCount: acc.checkedCount + batch.length,
            exposedPasswords: [...acc.exposedPasswords, ...newExposed],
          };
        },
        { checkedCount: 0, exposedPasswords: [] } as ProgressAccumulator,
      ),
      // Map accumulated state to progress result
      map(
        (acc): HibpProgressResult => ({
          state: acc.checkedCount >= totalCount ? HibpCheckState.Complete : HibpCheckState.Checking,
          checkedCount: acc.checkedCount,
          totalCount,
          progressPercent: Math.round((acc.checkedCount / totalCount) * 100),
          exposedPasswords: acc.exposedPasswords,
          elapsedMs: performance.now() - startTime,
        }),
      ),
      // Start with initial progress state
      startWith({
        state: HibpCheckState.Checking,
        checkedCount: 0,
        totalCount,
        progressPercent: 0,
        exposedPasswords: [],
        elapsedMs: 0,
      } as HibpProgressResult),
    );
  }

  /**
   * Extracts username parts from the cipher's username.
   * This is used to help determine password strength.
   *
   * @param cipherUsername The username from the cipher.
   * @returns An array of username parts.
   */
  extractUsernameParts(cipherUsername: string) {
    const atPosition = cipherUsername.indexOf("@");
    const userNameToProcess =
      atPosition > -1 ? cipherUsername.substring(0, atPosition) : cipherUsername;

    return userNameToProcess
      .trim()
      .toLowerCase()
      .split(/[^A-Za-z0-9]/);
  }

  /**
   * Checks if the cipher has a weak password based on the password strength score.
   *
   * @param cipher
   * @returns
   */
  findWeakPasswordDetails(cipher: CipherView): WeakPasswordDetail | null {
    // Validate the cipher
    if (!this.isValidCipher(cipher)) {
      return null;
    }

    // Check the username
    const userInput = this.isUserNameNotEmpty(cipher)
      ? this.extractUsernameParts(cipher.login.username!)
      : undefined;

    const { score } = this.passwordStrengthService.getPasswordStrength(
      cipher.login.password!,
      undefined, // No email available in this context
      userInput,
    );

    // If a score is not found or a score is less than 3, it's weak
    if (score != null && score <= 2) {
      return { score: score, detailValue: this.getPasswordScoreInfo(score) };
    }
    return null;
  }

  /**
   * Gets the password score information based on the score.
   *
   * @param score
   * @returns An object containing the label and badge variant for the password score.
   */
  getPasswordScoreInfo(score: number): WeakPasswordScore {
    switch (score) {
      case 4:
        return { label: "strong", badgeVariant: "success" };
      case 3:
        return { label: "good", badgeVariant: "primary" };
      case 2:
        return { label: "weak", badgeVariant: "warning" };
      default:
        return { label: "veryWeak", badgeVariant: "danger" };
    }
  }

  /**
   * Checks if the username on the cipher is not empty.
   */
  isUserNameNotEmpty(c: CipherView): boolean {
    return !Utils.isNullOrWhitespace(c.login.username);
  }

  /**
   * Validates that the cipher is a login item, has a password
   * is not deleted, and the user can view the password
   * @param c the input cipher
   */
  isValidCipher(c: CipherView): boolean {
    const { type, login, isDeleted, viewPassword } = c;
    if (
      type !== CipherType.Login ||
      login.password == null ||
      login.password === "" ||
      isDeleted ||
      !viewPassword
    ) {
      return false;
    }
    return true;
  }
}
