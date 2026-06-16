import { BadgeVariant } from "@bitwarden/components";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
} from "@bitwarden/pam";

/** Max items rendered per section (no pagination). */
export const MY_REQUESTS_PAGE_LIMIT = 50;

export type MyRequestRow = {
  id: string;
  cipherId: string;
  /**
   * Cipher and collection names resolved from local vault state (the gated cipher's
   * already-decrypted name and its CollectionView). `cipherName` is null when the
   * cipher isn't in the vault, so the template falls back to `cipherId`; `collectionName`
   * is null when unknown.
   */
  cipherName: string | null;
  collectionName: string | null;
  status: AccessRequestStatus;
  /** Precomputed badge variant for `status`, so the template avoids a per-row method call. */
  statusVariant: BadgeVariant;
  /** Precomputed i18n key for `status`, so the template avoids a per-row method call. */
  statusLabelKey: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  /** i18n key for a system / access-rule resolver; null when a human resolved. */
  resolverLabelKey: string | null;
  /** The human resolver's display name (name, falling back to email, then id); null otherwise. */
  resolverName: string | null;
  approverComment: string | null;
  /** Deadline to activate an approved on-demand request; null for other states. */
  activationDeadline: Date | null;
};

/** An active lease the viewer holds, with names resolved from local vault state. */
export type LeaseRow = {
  id: string;
  cipherId: string;
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
  notBefore: Date;
  notAfter: Date;
};

/** Map a status to a badge variant. Exported for tests + storybook fidelity. */
export function statusBadgeVariant(status: AccessRequestStatus): BadgeVariant {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "success";
    case AccessRequestStatus.Activated:
      return "success";
    case AccessRequestStatus.Denied:
      return "danger";
    case AccessRequestStatus.Cancelled:
      return "subtle";
    case AccessRequestStatus.Expired:
      return "warning";
    case AccessRequestStatus.Pending:
      return "primary";
  }
}

/** i18n key for a status label. Exported for tests. */
export function statusLabelKey(status: AccessRequestStatus): string {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "pamStatusApproved";
    case AccessRequestStatus.Activated:
      return "pamStatusActivated";
    case AccessRequestStatus.Denied:
      return "pamStatusDenied";
    case AccessRequestStatus.Cancelled:
      return "pamStatusCancelled";
    case AccessRequestStatus.Expired:
      return "pamStatusExpired";
    case AccessRequestStatus.Pending:
      return "pamStatusPending";
  }
}

/**
 * Resolve who actioned a request.
 *
 * The API surfaces `approverId = null` for system / access-rule decisions and a
 * user id for human decisions, with the approver's name/email denormalized
 * alongside it. For a human decision we show the name, falling back to the email,
 * then the raw id if the server could not resolve the user (e.g. a deleted
 * account) — so the column is never blank.
 *
 * Returns an i18n key for system decisions (translated in the template) and a
 * display name for human decisions, keeping localization out of the row model.
 * Exported for tests.
 */
export function resolveResolver(
  response: Pick<
    AccessRequestDetailsResponse,
    "status" | "approverId" | "approverName" | "approverEmail"
  >,
): Pick<MyRequestRow, "resolverLabelKey" | "resolverName"> {
  if (response.status === AccessRequestStatus.Pending) {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (response.approverId == null) {
    return { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  return {
    resolverLabelKey: null,
    resolverName: response.approverName || response.approverEmail || response.approverId,
  };
}

export function toRow(response: AccessRequestDetailsResponse): MyRequestRow {
  return {
    id: response.id,
    cipherId: response.cipherId,
    cipherName: response.cipherName,
    collectionName: response.collectionName,
    status: response.status,
    statusVariant: statusBadgeVariant(response.status),
    statusLabelKey: statusLabelKey(response.status),
    submittedAt: new Date(response.submittedAt),
    resolvedAt: response.resolvedAt == null ? null : new Date(response.resolvedAt),
    requestedNotBefore:
      response.requestedNotBefore == null ? null : new Date(response.requestedNotBefore),
    requestedNotAfter:
      response.requestedNotAfter == null ? null : new Date(response.requestedNotAfter),
    requestedTtlSeconds: response.requestedTtlSeconds,
    ...resolveResolver(response),
    approverComment: response.approverComment,
    activationDeadline:
      response.activationDeadline == null ? null : new Date(response.activationDeadline),
  };
}

export function toLeaseRow(
  lease: AccessLeaseResponse,
  names: { cipherNameById: Map<string, string>; collectionNameById: Map<string, string> },
): LeaseRow {
  return {
    id: lease.id,
    cipherId: lease.cipherId,
    collectionId: lease.collectionId,
    cipherName: names.cipherNameById.get(lease.cipherId) ?? null,
    collectionName: names.collectionNameById.get(lease.collectionId) ?? null,
    notBefore: new Date(lease.notBefore),
    notAfter: new Date(lease.notAfter),
  };
}
