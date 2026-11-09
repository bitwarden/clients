import {
  AccessRequestId,
  ENDING_SOON_THRESHOLD_MS,
  requestedWindowSeconds,
} from "@bitwarden/bit-pam";
import { IconTileOptions } from "@bitwarden/components";

import { isRedeemableGrant, MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";
import { REQUEST_STATUS_LOOK } from "./request-status-look";

export const MyRequestStatus = Object.freeze({
  Pending: "pending",
  Ready: "ready",
  Active: "active",
  EndingSoon: "endingSoon",
  Expired: "expired",
} as const);
export type MyRequestStatus = (typeof MyRequestStatus)[keyof typeof MyRequestStatus];

export const MY_REQUEST_STATUSES: readonly MyRequestStatus[] = Object.values(MyRequestStatus);

/**
 * Each of this tab's statuses, as the table it shares with Approvals words and draws it. The
 * `satisfies` is what keeps a newly added status from silently missing an entry.
 */
export const MY_REQUEST_LOOK = Object.freeze({
  [MyRequestStatus.Pending]: REQUEST_STATUS_LOOK.pending,
  [MyRequestStatus.Ready]: REQUEST_STATUS_LOOK.ready,
  [MyRequestStatus.Active]: REQUEST_STATUS_LOOK.inUse,
  [MyRequestStatus.EndingSoon]: REQUEST_STATUS_LOOK.endingSoon,
  [MyRequestStatus.Expired]: REQUEST_STATUS_LOOK.expired,
} satisfies Record<MyRequestStatus, { labelKey: string; tile: IconTileOptions }>);

const STATUS_RANK: Readonly<Record<MyRequestStatus, number>> = Object.freeze({
  [MyRequestStatus.EndingSoon]: 4,
  [MyRequestStatus.Active]: 3,
  [MyRequestStatus.Ready]: 2,
  [MyRequestStatus.Pending]: 1,
  // Spent: nothing is left to do with it, so it sorts below everything still live.
  [MyRequestStatus.Expired]: 0,
});

export type MyRequestRow = {
  readonly testId: string;
  readonly requestId: AccessRequestId;
  readonly cipherId: string;
  readonly cipherName: string | null;
  readonly collectionId: string;
  readonly collectionName: string | null;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly windowSeconds: number;
  readonly lease: MyAccessLeaseRow | null;
  readonly request: MyAccessRequestRow | null;
};

const byWindowEnd = (a: MyRequestRow, b: MyRequestRow): number =>
  Date.parse(a.notAfter) - Date.parse(b.notAfter);

function leaseRowOf(lease: MyAccessLeaseRow): MyRequestRow {
  return {
    testId: `my-access-lease-${lease.id}`,
    requestId: lease.requestId,
    cipherId: lease.cipherId,
    cipherName: lease.cipherName,
    collectionId: lease.collectionId,
    collectionName: lease.collectionName,
    notBefore: lease.notBefore,
    notAfter: lease.notAfter,
    windowSeconds: windowSeconds(lease.notBefore, lease.notAfter),
    lease,
    request: null,
  };
}

function requestRowOf(request: MyAccessRequestRow, testIdPrefix: string): MyRequestRow {
  return {
    testId: `${testIdPrefix}-${request.id}`,
    requestId: request.id,
    cipherId: request.cipherId,
    cipherName: request.cipherName,
    collectionId: request.collectionId,
    collectionName: request.collectionName,
    notBefore: request.leaseNotBefore,
    notAfter: request.leaseNotAfter,
    windowSeconds: windowSeconds(request.leaseNotBefore, request.leaseNotAfter),
    lease: null,
    request,
  };
}

export function buildMyRequestRows(
  leases: MyAccessLeaseRow[],
  requests: MyAccessRequestRow[],
  extensions: MyAccessRequestRow[],
): MyRequestRow[] {
  return [
    ...leases.map(leaseRowOf).sort(byWindowEnd),
    ...requests.map((r) => requestRowOf(r, "my-access-request")).sort(byWindowEnd),
    ...extensions.map((r) => requestRowOf(r, "my-access-extension")).sort(byWindowEnd),
  ];
}

export function myRequestStatus(row: MyRequestRow, nowMs: number): MyRequestStatus {
  if (row.lease != null) {
    return Date.parse(row.lease.notAfter) - nowMs <= ENDING_SOON_THRESHOLD_MS
      ? MyRequestStatus.EndingSoon
      : MyRequestStatus.Active;
  }
  const request = row.request;
  if (request != null && isRedeemableGrant(request, nowMs)) {
    return MyRequestStatus.Ready;
  }
  // An approval nobody started before its window closed is spent, not still waiting.
  if (request != null && request.status === "approved") {
    return MyRequestStatus.Expired;
  }
  return MyRequestStatus.Pending;
}

export function myRequestStatusRank(status: MyRequestStatus): number {
  return STATUS_RANK[status];
}

function windowSeconds(notBefore: string, notAfter: string): number {
  return Math.max(
    0,
    requestedWindowSeconds({ leaseNotBefore: notBefore, leaseNotAfter: notAfter }),
  );
}
