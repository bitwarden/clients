import { filter, from, map, mergeMap, Observable, toArray } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  ExposedPasswordDetail,
  WeakPasswordDetail,
  WeakPasswordScore,
} from "../models/password-health";

export class PasswordHealthService {
  constructor(
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private auditService: AuditService,
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
