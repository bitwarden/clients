import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { emptyResolvedNames } from "../../access-requests/access-name-resolver.service";
import { ApprovalRow, toApprovalRow } from "../approval-row";

import { DecideDialogComponent, DecideDialogParams } from "./decide-dialog.component";

/** Fixed so the window and "submitted N ago" labels don't drift with the clock. */
const NOW = new Date("2026-08-17T12:00:00.000Z");

/** Built through `toApprovalRow` so the summary matches the inbox row's precomputed labels. */
function approvalRow(
  overrides: Record<string, unknown> = {},
  collectionName: string | null = "Production",
  organizationName: string | null = "Meridian Group",
): ApprovalRow {
  const request = {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    organizationId: "org-1",
    requesterId: "user-1",
    status: "pending",
    leaseNotBefore: "2026-08-17T12:00:00.000Z",
    leaseNotAfter: "2026-08-17T13:00:00.000Z",
    reason: "Investigating the checkout latency spike.",
    submittedAt: "2026-08-17T11:30:00.000Z",
    decisions: [],
    requesterName: "Grace Hopper",
    requesterEmail: "grace@example.com",
    ...overrides,
  } as unknown as AccessRequestView;

  return toApprovalRow(
    request,
    {
      ...emptyResolvedNames(),
      cipherNameById: new Map([["cipher-1", "Prod database"]]),
      collectionNameById: collectionName ? new Map([["col-1", collectionName]]) : new Map(),
      organizationNameById: organizationName ? new Map([["org-1", organizationName]]) : new Map(),
    },
    NOW,
    true,
  );
}

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(params: DecideDialogParams) {
  return moduleMetadata({
    imports: [DecideDialogComponent],
    providers: [
      { provide: DialogRef, useValue: { close: () => {} } },
      { provide: DIALOG_DATA, useValue: params },
    ],
  });
}

export default {
  title: "Web/PAM/Decide Dialog",
  component: DecideDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-decide-dialog />` }),
} as Meta<DecideDialogComponent>;

type Story = StoryObj<DecideDialogComponent>;

export const Approve: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow() })],
};

/** Opens with confirm disabled, since denying requires a reason. */
export const Deny: Story = {
  decorators: [withParams({ verdict: "deny", row: approvalRow() })],
};

/** A request submitted with no justification falls back to muted placeholder copy. */
export const NoReason: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow({ reason: null }) })],
};

/** When the collection name did not resolve, it is dropped from the item card rather than blank. */
export const NoCollection: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow({}, null) })],
};

/**
 * An approver outside the owning organization resolves no name for it, so nothing renders rather
 * than the raw uuid.
 */
export const NoOrganization: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow({}, "Production", null) })],
};

/**
 * A long justification, to check the read-only reason field contains it rather than stretching the
 * dialog.
 */
export const LongReason: Story = {
  decorators: [
    withParams({
      verdict: "approve",
      row: approvalRow({
        reason:
          "Paging on elevated 5xx from the checkout service since 11:15. Need to read the " +
          "connection-pool settings on the primary to confirm whether the pool is exhausted " +
          "before we fail over, and the runbook for that is gated behind this credential.",
      }),
    }),
  ],
};
