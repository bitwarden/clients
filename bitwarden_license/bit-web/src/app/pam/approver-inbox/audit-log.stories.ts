import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";

import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ResolvedNames, emptyResolvedNames } from "../access-request-name-resolver.service";

import { AuditLogComponent } from "./audit-log.component";

const now = Date.now();

function item(
  overrides: Partial<{
    id: string;
    status: string;
    producedLeaseId: string | null;
    producedLeaseStatus: string | null;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
    resolvedAt: string | null;
    comment: string | null;
    cipherId: string;
    collectionId: string;
    requesterName: string;
    approverId: string | null;
    approverName: string | null;
  }> = {},
): AccessRequestDetailsResponse {
  const hasApprover = overrides.approverId !== null;
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "h1",
    CipherId: overrides.cipherId ?? "cipher-1",
    CollectionId: overrides.collectionId ?? "col-1",
    RequesterId: "user-2",
    Status: overrides.status ?? "denied",
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? new Date(now - 60 * 60_000).toISOString(),
    Reason: "Quarterly access review",
    SubmittedAt: new Date(now - 5 * 60 * 60_000).toISOString(),
    ResolvedAt: overrides.resolvedAt ?? new Date(now - 4 * 60 * 60_000).toISOString(),
    // The decision log: a human decision carries the approver; an access-rule case (approverId: null)
    // is an automatic decision with no approver identity.
    Decisions: [
      hasApprover
        ? {
            DeciderKind: "human",
            Id: overrides.approverId ?? "approver-1",
            Name: overrides.approverName ?? "Dana Approver",
            Email: "dana@example.com",
            Comment: overrides.comment ?? null,
            Verdict: (overrides.status ?? "denied") === "denied" ? 0 : 1,
            DecidedAt: overrides.resolvedAt ?? new Date(now - 4 * 60 * 60_000).toISOString(),
          }
        : {
            DeciderKind: "automatic",
            Id: null,
            Comment: overrides.comment ?? null,
            Verdict: (overrides.status ?? "denied") === "denied" ? 0 : 1,
            DecidedAt: overrides.resolvedAt ?? new Date(now - 4 * 60 * 60_000).toISOString(),
          },
    ],
    ProducedLeaseId: overrides.producedLeaseId ?? null,
    ProducedLeaseStatus: overrides.producedLeaseStatus ?? null,
    RequesterName: overrides.requesterName ?? "Eli Santos",
    RequesterEmail: "eli@example.com",
  });
}

/** Display names the resolver would supply from local vault state, keyed by cipher/collection id. */
function names(
  entries: { cipherId: string; cipherName: string; collectionId: string; collectionName: string }[],
): ResolvedNames {
  return {
    cipherNameById: new Map(entries.map((e) => [e.cipherId, e.cipherName])),
    collectionNameById: new Map(entries.map((e) => [e.collectionId, e.collectionName])),
    cipherById: new Map(),
  };
}

export default {
  title: "Web/PAM/Audit Log",
  component: AuditLogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    now: new Date(now),
    names: emptyResolvedNames(),
  },
} as Meta<AuditLogComponent>;

type Story = StoryObj<AuditLogComponent>;

export const Empty: Story = {
  args: { items: [], managedIds: new Set<string>() },
};

export const Populated: Story = {
  args: {
    items: [
      // An active managed lease — offers Revoke.
      item({
        id: "active",
        status: "activated",
        producedLeaseId: "lease-1",
        producedLeaseStatus: "active",
        requestedNotBefore: new Date(now - 30 * 60_000).toISOString(),
        requestedNotAfter: new Date(now + 30 * 60_000).toISOString(),
        comment: "Approved for hotfix deploy",
        cipherId: "cipher-active",
        collectionId: "col-prod",
        requesterName: "Dana Kim",
      }),
      item({
        id: "denied",
        status: "denied",
        comment: "Outside approved hours",
        cipherId: "cipher-denied",
        collectionId: "col-mon",
      }),
      item({
        id: "approved",
        status: "approved",
        comment: "Approved for planned maintenance",
        cipherId: "cipher-approved",
        collectionId: "col-infra",
        requesterName: "Ivan Petrov",
      }),
    ],
    names: names([
      {
        cipherId: "cipher-active",
        cipherName: "GitHub deploy key",
        collectionId: "col-prod",
        collectionName: "Production",
      },
      {
        cipherId: "cipher-denied",
        cipherName: "Datadog API key",
        collectionId: "col-mon",
        collectionName: "Monitoring",
      },
      {
        cipherId: "cipher-approved",
        cipherName: "Terraform state",
        collectionId: "col-infra",
        collectionName: "Infrastructure",
      },
    ]),
    // Only the managed (decision-history) rows are actionable.
    managedIds: new Set(["active", "denied", "approved"]),
  },
};
