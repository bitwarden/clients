import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, distinctUntilChanged, firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import {
  DECRYPT_ERROR,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  PamApiService,
} from "@bitwarden/pam";

import { isActionableInboxRequest } from "./inbox-request-filter";

/**
 * Loads pending lease requests for the approver inbox, applies the
 * inbox sort (oldest first, then collection name), and manages optimistic
 * removal + rollback on decision submission.
 *
 * Cipher names arrive encrypted on the wire (see {@link AccessRequestDetailsResponse})
 * and are decrypted in-place with the owning org's key before rows reach
 * subscribers. No other Vault Data passes through this service.
 */
@Injectable()
export class ApproverInboxService {
  private readonly pamApiService = inject(PamApiService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);
  private readonly logService = inject(LogService);

  private readonly _requests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _history$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly requests$: Observable<AccessRequestDetailsResponse[]> = this._requests$.asObservable();
  readonly history$: Observable<AccessRequestDetailsResponse[]> = this._history$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  readonly badgeCount$: Observable<number> = this._requests$.pipe(
    map((rows) => rows.length),
    distinctUntilChanged(),
  );

  /** Fetch the inbox and history, decrypt cipher names, replace local state. */
  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [rows, history] = await Promise.all([
        this.pamApiService.listInboxRequests(),
        this.pamApiService.listInboxHistory(),
      ]);
      // Drop requests that have timed out (server-marked lapsed, or their
      // requested window has fully elapsed). They belong in history, not the
      // "needs approval" list — keeping them here would strand a stale duplicate
      // for the same cipher that can never be acted on.
      const now = new Date();
      const actionable = rows.filter((row) => isActionableInboxRequest(row, now));
      const orgKeys = await this.snapshotOrgKeys();
      await Promise.all([
        this.decryptDisplayNames(actionable, orgKeys),
        this.decryptDisplayNames(history, orgKeys),
      ]);
      this._requests$.next(sortInbox(actionable));
      this._history$.next(history);
    } catch (e) {
      this._loadError$.next(e);
      throw e;
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Submit a decision; remove the row optimistically. On failure, restore
   * the row in its original position and rethrow so the caller can toast.
   */
  async decideAccessRequest(requestId: string, request: AccessDecisionRequest): Promise<void> {
    const current = this._requests$.value;
    const index = current.findIndex((r) => r.id === requestId);
    if (index === -1) {
      // Already removed (double-click guard); call API anyway to stay
      // consistent with "exactly one network call per click".
      await this.pamApiService.decideAccessRequest(requestId, request);
      return;
    }
    const row = current[index];
    const next = current.slice();
    next.splice(index, 1);
    this._requests$.next(next);
    try {
      const resolved = await this.pamApiService.decideAccessRequest(requestId, request);
      // Decision response only populates status/resolvedAt/approverComment;
      // keep the already-decrypted display fields from the existing row.
      row.status = resolved.status;
      row.resolvedAt = resolved.resolvedAt;
      row.approverComment = resolved.approverComment;
      this._history$.next([row, ...this._history$.value]);
    } catch (e) {
      const restored = this._requests$.value.slice();
      restored.splice(index, 0, row);
      this._requests$.next(sortInbox(restored));
      throw e;
    }
  }

  /**
   * Revoke an active lease and drop it out of the Active group optimistically
   * by flipping the produced lease's status to "revoked", so the Revoke button
   * disappears immediately. The next load (or a RefreshApproverInbox push)
   * reconciles with the server.
   */
  async revokeAccessLease(leaseId: string): Promise<void> {
    await this.pamApiService.revokeAccessLease(leaseId, new AccessLeaseRevokeRequest({}));
    const updated = this._history$.value.map((item) => {
      if (item.producedLeaseId === leaseId) {
        item.producedLeaseStatus = AccessLeaseStatus.Revoked;
      }
      return item;
    });
    this._history$.next(updated);
  }

  private async snapshotOrgKeys(): Promise<Record<OrganizationId, OrgKey>> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account?.id) {
      return {} as Record<OrganizationId, OrgKey>;
    }
    const keys = await firstValueFrom(this.keyService.orgKeys$(account.id as UserId));
    return keys ?? ({} as Record<OrganizationId, OrgKey>);
  }

  private async decryptDisplayNames(
    rows: AccessRequestDetailsResponse[],
    orgKeys: Record<OrganizationId, OrgKey>,
  ): Promise<void> {
    await Promise.all(
      rows.map(async (row) => {
        const orgKey = row.organizationId ? orgKeys[row.organizationId as OrganizationId] : null;
        if (!orgKey) {
          return;
        }
        await Promise.all([
          this.decryptField(row, "cipherName", orgKey),
          this.decryptField(row, "collectionName", orgKey),
        ]);
      }),
    );
  }

  private async decryptField(
    row: AccessRequestDetailsResponse,
    field: "cipherName" | "collectionName",
    orgKey: OrgKey,
  ): Promise<void> {
    const value = row[field];
    if (!value) {
      return;
    }
    try {
      row[field] = await this.encryptService.decryptString(new EncString(value), orgKey);
    } catch (e) {
      this.logService.error(`Failed to decrypt approver-inbox ${field}`, e);
      row[field] = DECRYPT_ERROR;
    }
  }
}

/**
 * Sort the inbox: oldest pending first (FIFO by submittedAt), secondary
 * by collection name (locale-aware).
 *
 * Exported for testing.
 */
export function sortInbox<
  T extends Pick<AccessRequestDetailsResponse, "submittedAt" | "collectionName">,
>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => {
    const submittedDelta = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
    if (submittedDelta !== 0) {
      return submittedDelta;
    }
    return (a.collectionName ?? "").localeCompare(b.collectionName ?? "", undefined, {
      sensitivity: "base",
    });
  });
}
