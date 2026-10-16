import { IconTileOptions } from "@bitwarden/components";

import { AccessRequestId } from "..";
import {
  ACCESS_BADGE_LOOK,
  ENDING_SOON_THRESHOLD_MS,
} from "../access-state-badge/access-badge-state";

import { isRedeemableGrant, MyAccessLeaseRow, MyAccessRequestRow } from "./my-access-row";

export const MyRequestStatus = Object.freeze({
  Pending: "pending",
  Ready: "ready",
  Active: "active",
  EndingSoon: "endingSoon",
} as const);
export type MyRequestStatus = (typeof MyRequestStatus)[keyof typeof MyRequestStatus];

export const MY_REQUEST_STATUSES: readonly MyRequestStatus[] = Object.values(MyRequestStatus);

export const MY_REQUEST_STATUS_LABEL_KEY: Readonly<Record<MyRequestStatus, string>> = Object.freeze(
  {
    [MyRequestStatus.Pending]: "pamAccessBadgePending",
    [MyRequestStatus.Ready]: "pamAccessBadgeReady",
    [MyRequestStatus.Active]: "pamMyRequestsStatusInUse",
    [MyRequestStatus.EndingSoon]: "pamMyRequestsStatusEndingSoon",
  },
);

export const MY_REQUEST_STATUS_ICON: Readonly<Record<MyRequestStatus, IconTileOptions>> =
  Object.freeze({
    [MyRequestStatus.Pending]: { icon: ACCESS_BADGE_LOOK.pending.icon, variant: "warning" },
    [MyRequestStatus.Ready]: { icon: ACCESS_BADGE_LOOK.ready.icon, variant: "success" },
    [MyRequestStatus.Active]: { icon: ACCESS_BADGE_LOOK.active.icon, variant: "primary" },
    [MyRequestStatus.EndingSoon]: { icon: ACCESS_BADGE_LOOK.endingSoon.icon, variant: "danger" },
  });

const STATUS_RANK: Readonly<Record<MyRequestStatus, number>> = Object.freeze({
  [MyRequestStatus.EndingSoon]: 4,
  [MyRequestStatus.Active]: 3,
  [MyRequestStatus.Ready]: 2,
  [MyRequestStatus.Pending]: 1,
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
  return MyRequestStatus.Pending;
}

export function myRequestStatusRank(status: MyRequestStatus): number {
  return STATUS_RANK[status];
}

function windowSeconds(notBefore: string, notAfter: string): number {
  return Math.max(0, (Date.parse(notAfter) - Date.parse(notBefore)) / 1000);
}
