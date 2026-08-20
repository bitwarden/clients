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

/**
 * Built through `toApprovalRow` rather than hand-written, so the summary renders the same
 * precomputed labels the inbox row behind the dialog does — the point of repeating the request
 * here is that the two cannot disagree.
 */
function approvalRow(
  overrides: Record<string, unknown> = {},
  collectionName: string | null = "Production",
): ApprovalRow {
  const request = {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
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
    },
    NOW,
    true,
  );
}

/**
 * `DIALOG_DATA` is what every story varies, so it is provided per story rather than on the meta —
 * the dialog reads it once at construction and has no inputs to drive from args.
 */
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

/** Approving: the confirm button is primary and the copy is the approve variant. */
export const Approve: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow() })],
};

/** Denying: same summary and comment field, but the confirm button escalates to danger. */
export const Deny: Story = {
  decorators: [withParams({ verdict: "deny", row: approvalRow() })],
};

/** A request submitted with no justification falls back to muted placeholder copy. */
export const NoReason: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow({ reason: null }) })],
};

/** When the collection name did not resolve, its row is dropped rather than left blank. */
export const NoCollection: Story = {
  decorators: [withParams({ verdict: "approve", row: approvalRow({}, null) })],
};

/**
 * A long justification, to check the summary's `auto 1fr` grid wraps the value column instead of
 * stretching the dialog.
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
