import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessLeaseId, AccessRequestView } from "../abstractions/access-lease";
import { ApprovalRow, toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ManagedLeaseRow, toManagedLeaseRow } from "../approvals/managed-lease-row";
import {
  HOUR,
  MINUTE,
  STORY_NOW,
  accessRequest,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { ApprovalsTabComponent } from "./approvals-tab.component";

const names = storyNames();

/** `canDecide` is false only for the viewer's own request — no self-approval. */
function row(overrides: Record<string, unknown>, canDecide = true): ApprovalRow {
  return toApprovalRow(accessRequest(overrides), names, STORY_NOW, canDecide);
}

const ROWS: ApprovalRow[] = [
  row({ id: "req-1", submittedAt: new Date(STORY_NOW.getTime() - 2 * HOUR).toISOString() }),
  row({
    id: "req-2",
    cipherId: "cipher-2",
    collectionId: "col-2",
    requesterName: "Alan Turing",
    requesterEmail: "alan@example.com",
    reason: null,
    leaseNotAfter: new Date(STORY_NOW.getTime() + 4 * HOUR).toISOString(),
  }),
  row({
    id: "req-3",
    cipherId: "cipher-3",
    requesterName: "",
    requesterEmail: "katherine@example.com",
    reason: "Quarterly key rotation.",
    submittedAt: new Date(STORY_NOW.getTime() - 15 * MINUTE).toISOString(),
  }),
  // The viewer's own request: rendered, but the decide buttons are disabled rather than hidden so
  // the reason can be explained in a tooltip instead of the row looking broken.
  row({ id: "req-4", cipherId: "cipher-2", requesterName: "You", reason: "Own request." }, false),
];

/**
 * Lease ends are stamped off the real clock, not {@link STORY_NOW}: the remaining-time badge runs
 * its own countdown, so a STORY_NOW-relative window renders as already expired.
 */
function lease(
  overrides: Record<string, unknown>,
  extension?: { addedSeconds: number; latestEndMs: number },
): ManagedLeaseRow {
  return toManagedLeaseRow(
    accessRequest({
      status: "approved",
      producedLeaseStatus: "active",
      ...overrides,
    }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
    names,
    extension,
  );
}

function activeLeases(): ManagedLeaseRow[] {
  return [
    lease({
      id: "req-live-1",
      producedLeaseId: "lease-1",
      leaseNotBefore: liveFromNow(-20 * MINUTE),
      leaseNotAfter: liveFromNow(40 * MINUTE),
    }),
    lease({
      id: "req-live-2",
      cipherId: "cipher-2",
      collectionId: "col-2",
      producedLeaseId: "lease-2",
      requesterName: "Alan Turing",
      requesterEmail: "alan@example.com",
      leaseNotBefore: liveFromNow(-2 * HOUR),
      leaseNotAfter: liveFromNow(3 * HOUR),
    }),
    lease(
      {
        id: "req-live-3",
        cipherId: "cipher-3",
        producedLeaseId: "lease-3",
        requesterName: "Katherine Johnson",
        requesterEmail: "katherine@example.com",
        leaseNotBefore: liveFromNow(-90 * MINUTE),
        leaseNotAfter: liveFromNow(30 * MINUTE),
      },
      { addedSeconds: 2 * 60 * 60, latestEndMs: Date.now() + 2.5 * HOUR },
    ),
  ];
}

function inbox(
  options: { rows?: ApprovalRow[]; leases?: () => ManagedLeaseRow[]; loading?: boolean } = {},
) {
  const { rows = ROWS, leases = () => [], loading = false } = options;
  return moduleMetadata({
    imports: [ApprovalsTabComponent],
    providers: [
      {
        provide: ApproverInboxService,
        // A factory rather than a value, so the real-clock lease windows are stamped when the
        // story renders rather than when this module was first evaluated.
        useFactory: () => ({
          loading$: of(loading),
          loadError$: of(null),
          inboxRows$: of(rows),
          activeLeaseRows$: of(leases()),
          cipherById$: of(names.cipherById),
          decide: () => Promise.resolve(),
          revokeLease: () => Promise.resolve(),
        }),
      },
      {
        provide: DialogService,
        useValue: {
          open: () => ({ closed: of(undefined) }),
          openSimpleDialog: () => Promise.resolve(false),
        },
      },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/Approvals Tab",
  component: ApprovalsTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<pam-approvals-tab />` }),
} as Meta<ApprovalsTabComponent>;

type Story = StoryObj<ApprovalsTabComponent>;

/** Both sections populated: decisions to make, and access already running. */
export const Default: Story = {
  decorators: [inbox({ leases: activeLeases })],
};

/** Nothing left to decide, but the access the operator granted is still live and can be ended. */
export const ActiveAccessOnly: Story = {
  decorators: [inbox({ rows: [], leases: activeLeases })],
};

/** Nothing awaiting a decision — distinct from a filter that matched nothing. */
export const Empty: Story = {
  decorators: [inbox({ rows: [] })],
};

/** The first load, before any row has arrived. */
export const Loading: Story = {
  decorators: [inbox({ rows: [], loading: true })],
};

/** A single request — the narrowest the table gets before the empty state takes over. */
export const SingleRequest: Story = {
  decorators: [inbox({ rows: [ROWS[0]] })],
};
