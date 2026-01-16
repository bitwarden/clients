import { Injectable, inject } from "@angular/core";
import { from, Observable } from "rxjs";
import { concatMap, map, toArray } from "rxjs/operators";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { WeakPasswordDetail } from "../../models/password-health";

import { PasswordHealthService } from "./password-health.service";
import {
  createRiskInsightsItem,
  RiskInsightsItem,
  RiskInsightsItemStatus,
  calculateRiskStatus,
} from "./risk-insights-prototype.types";

/**
 * Result of weak password check for a single cipher
 */
export interface WeakPasswordCheckResult {
  cipherId: string;
  weakPasswordDetail: WeakPasswordDetail;
}

/**
 * Service for transforming and processing cipher data for the Risk Insights Prototype.
 *
 * Handles:
 * - Transforming CipherView to RiskInsightsItem
 * - Running weak password checks in batches
 * - Building password use maps for reuse detection
 * - Calculating risk status
 */
@Injectable()
export class RiskInsightsPrototypeService {
  private readonly passwordHealthService = inject(PasswordHealthService);

  /**
   * Transform ciphers to RiskInsightsItems with placeholder values.
   * The items will be progressively enriched with health and member data.
   *
   * @param ciphers The ciphers to transform
   * @returns Array of RiskInsightsItems with placeholder values
   */
  transformCiphersToItems(ciphers: CipherView[]): RiskInsightsItem[] {
    return ciphers
      .filter((cipher) => this.isValidCipher(cipher))
      .map((cipher) => createRiskInsightsItem(cipher));
  }

  /**
   * Check weak passwords for a batch of ciphers using requestAnimationFrame
   * to avoid blocking the UI.
   *
   * @param ciphers The ciphers to check
   * @param batchSize Number of ciphers to process per frame (default: 100)
   * @returns Observable that emits weak password results for each batch
   */
  checkWeakPasswordsBatched$(
    ciphers: CipherView[],
    batchSize: number = 100,
  ): Observable<WeakPasswordCheckResult[]> {
    const validCiphers = ciphers.filter((c) => this.isValidCipher(c));
    const batches = this.createBatches(validCiphers, batchSize);

    return from(batches).pipe(
      concatMap((batch, batchIndex) =>
        this.processWeakPasswordBatch(batch, batchIndex, batches.length),
      ),
      toArray(),
      map((batchResults) => batchResults.flat()),
    );
  }

  /**
   * Process a single batch of ciphers for weak passwords using requestAnimationFrame.
   */
  private processWeakPasswordBatch(
    batch: CipherView[],
    _batchIndex: number,
    _totalBatches: number,
  ): Observable<WeakPasswordCheckResult[]> {
    return new Observable<WeakPasswordCheckResult[]>((subscriber) => {
      requestAnimationFrame(() => {
        const results: WeakPasswordCheckResult[] = batch.map((cipher) => ({
          cipherId: cipher.id,
          weakPasswordDetail: this.passwordHealthService.findWeakPasswordDetails(cipher),
        }));
        subscriber.next(results);
        subscriber.complete();
      });
    });
  }

  /**
   * Build a map of password hashes to cipher IDs for detecting reused passwords.
   * Only includes ciphers with valid passwords.
   *
   * @param ciphers The ciphers to analyze
   * @returns Map where key is password hash, value is array of cipher IDs using that password
   */
  buildPasswordUseMap(ciphers: CipherView[]): Map<string, string[]> {
    const passwordUseMap = new Map<string, string[]>();

    for (const cipher of ciphers) {
      if (!this.isValidCipher(cipher)) {
        continue;
      }

      const password = cipher.login?.password;
      if (!password) {
        continue;
      }

      // Use a simple hash of the password as the key
      // This avoids storing actual passwords in memory
      const passwordKey = this.hashPassword(password);

      const existing = passwordUseMap.get(passwordKey);
      if (existing) {
        existing.push(cipher.id);
      } else {
        passwordUseMap.set(passwordKey, [cipher.id]);
      }
    }

    return passwordUseMap;
  }

  /**
   * Check which ciphers have reused passwords based on a password use map.
   *
   * @param cipherIds The cipher IDs to check
   * @param passwordUseMap Map of password hashes to cipher IDs
   * @param ciphers The original ciphers (for password lookup)
   * @returns Set of cipher IDs that have reused passwords
   */
  findReusedPasswordCipherIds(
    cipherIds: string[],
    passwordUseMap: Map<string, string[]>,
    ciphers: CipherView[],
  ): Set<string> {
    const reusedCipherIds = new Set<string>();
    const cipherMap = new Map(ciphers.map((c) => [c.id, c]));

    for (const cipherId of cipherIds) {
      const cipher = cipherMap.get(cipherId);
      if (!cipher || !this.isValidCipher(cipher)) {
        continue;
      }

      const password = cipher.login?.password;
      if (!password) {
        continue;
      }

      const passwordKey = this.hashPassword(password);
      const usedBy = passwordUseMap.get(passwordKey);

      // Password is reused if more than one cipher uses it
      if (usedBy && usedBy.length > 1) {
        reusedCipherIds.add(cipherId);
      }
    }

    return reusedCipherIds;
  }

  /**
   * Update an item with weak password status.
   */
  updateItemWithWeakPassword(
    item: RiskInsightsItem,
    weakPasswordDetail: WeakPasswordDetail,
    enableWeakCheck: boolean,
    enableReusedCheck: boolean,
    enableHibpCheck: boolean,
  ): RiskInsightsItem {
    const weakPassword = weakPasswordDetail !== null;
    const newStatus = calculateRiskStatus(
      weakPassword,
      item.reusedPassword,
      item.exposedPassword,
      enableWeakCheck,
      enableReusedCheck,
      enableHibpCheck,
    );

    return {
      ...item,
      weakPassword,
      status: newStatus,
    };
  }

  /**
   * Update an item with reused password status.
   */
  updateItemWithReusedPassword(
    item: RiskInsightsItem,
    isReused: boolean,
    enableWeakCheck: boolean,
    enableReusedCheck: boolean,
    enableHibpCheck: boolean,
  ): RiskInsightsItem {
    const newStatus = calculateRiskStatus(
      item.weakPassword,
      isReused,
      item.exposedPassword,
      enableWeakCheck,
      enableReusedCheck,
      enableHibpCheck,
    );

    return {
      ...item,
      reusedPassword: isReused,
      status: newStatus,
    };
  }

  /**
   * Update an item with exposed password status.
   */
  updateItemWithExposedPassword(
    item: RiskInsightsItem,
    exposedCount: number,
    enableWeakCheck: boolean,
    enableReusedCheck: boolean,
    enableHibpCheck: boolean,
  ): RiskInsightsItem {
    const exposedPassword = exposedCount > 0;
    const newStatus = calculateRiskStatus(
      item.weakPassword,
      item.reusedPassword,
      exposedPassword,
      enableWeakCheck,
      enableReusedCheck,
      enableHibpCheck,
    );

    return {
      ...item,
      exposedPassword,
      exposedCount,
      status: newStatus,
    };
  }

  /**
   * Update an item with member count.
   */
  updateItemWithMemberCount(item: RiskInsightsItem, memberCount: number): RiskInsightsItem {
    return {
      ...item,
      memberCount,
      memberAccessPending: false,
    };
  }

  /**
   * Update an item's status when all checks are complete.
   * This is called when no health checks are enabled but we still need a status.
   */
  finalizeItemStatus(
    item: RiskInsightsItem,
    enableWeakCheck: boolean,
    enableReusedCheck: boolean,
    enableHibpCheck: boolean,
  ): RiskInsightsItem {
    // If no checks enabled, mark as healthy
    if (!enableWeakCheck && !enableReusedCheck && !enableHibpCheck) {
      return {
        ...item,
        status: RiskInsightsItemStatus.Healthy,
      };
    }
    return item;
  }

  /**
   * Create batches from an array.
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simple hash function for password deduplication.
   * Uses a basic string hash for performance.
   */
  private hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Validates that the cipher is a login item with a valid password.
   */
  private isValidCipher(cipher: CipherView): boolean {
    if (!cipher) {
      return false;
    }

    const { type, login, isDeleted, viewPassword } = cipher;

    if (
      type !== CipherType.Login ||
      !login?.password ||
      Utils.isNullOrWhitespace(login.password) ||
      isDeleted ||
      !viewPassword
    ) {
      return false;
    }

    return true;
  }
}
