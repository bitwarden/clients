import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";

import { AccessRequestDetailsResponse } from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../core/tests";

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
    cipherName: string;
    collectionName: string;
    requesterName: string;
    approverId: string | null;
    approverName: string | null;
  }> = {},
): AccessRequestDetailsResponse {
  const hasApprover = overrides.approverId !== null;
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "h1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterId: "user-2",
    Status: overrides.status ?? "denied",
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? new Date(now - 60 * 60_000).toISOString(),
    RequestedTtlSeconds: 3600,
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
    CipherName: overrides.cipherName ?? "Datadog API key",
    CollectionName: overrides.collectionName ?? "Monitoring",
    RequesterName: overrides.requesterName ?? "Eli Santos",
    RequesterEmail: "eli@example.com",
  });
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
        cipherName: "GitHub deploy key",
        collectionName: "Production",
        requesterName: "Dana Kim",
      }),
      item({ id: "denied", status: "denied", comment: "Outside approved hours" }),
      item({
        id: "approved",
        status: "approved",
        comment: "Approved for planned maintenance",
        cipherName: "Terraform state",
        collectionName: "Infrastructure",
        requesterName: "Ivan Petrov",
      }),
    ],
    // Only the managed (decision-history) rows are actionable.
    managedIds: new Set(["active", "denied", "approved"]),
  },
};
