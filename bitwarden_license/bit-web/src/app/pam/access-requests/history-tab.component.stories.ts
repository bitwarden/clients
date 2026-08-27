import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  DAY,
  HOUR,
  MINUTE,
  accessRequest,
  decision,
  fromNow,
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { HistoryTabComponent } from "./history-tab.component";
import { toRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

const names = storyNames();

const request = (overrides: Record<string, unknown>) =>
  toRequestRow(accessRequest(overrides), names);

/** The caller's own terminal requests: one of each outcome the status column can show. */
const MY_ROWS = [
  request({
    id: "req-approved",
    status: "approved",
    producedLeaseId: "lease-1",
    producedLeaseStatus: "expired",
    resolvedAt: fromNow(-2 * DAY),
    decisions: [decision({ comment: "Approved for the incident window." })],
  }),
  request({
    id: "req-denied",
    cipherId: "cipher-2",
    collectionId: "col-2",
    status: "denied",
    resolvedAt: fromNow(-3 * DAY),
    decisions: [decision({ verdict: "deny", comment: "Use the read replica instead." })],
  }),
  request({
    id: "req-canceled",
    cipherId: "cipher-3",
    status: "canceled",
    resolvedAt: fromNow(-4 * DAY),
  }),
  // Auto-approved by the rule: the resolver column credits the rule, not a person.
  request({
    id: "req-auto",
    status: "approved",
    producedLeaseId: "lease-9",
    producedLeaseStatus: "expired",
    resolvedAt: fromNow(-5 * DAY),
    decisions: [decision({ decider: "automatic" })],
  }),
];

/**
 * Rows the caller decided as an approver: a running grant (the only revocable shape), an approval
 * the requester has not started (the only withdrawable one), and a denial, which offers neither.
 */
function managedRows() {
  return [
    toRequestRow(
      accessRequest({
        id: "req-managed-active",
        requesterName: "Alan Turing",
        requesterEmail: "alan@example.com",
        status: "approved",
        producedLeaseId: "lease-managed",
        producedLeaseStatus: "active",
        resolvedAt: liveFromNow(-30 * MINUTE),
        leaseNotAfter: liveFromNow(HOUR),
        decisions: [decision()],
      }),
      names,
    ),
    toRequestRow(
      accessRequest({
        id: "req-managed-approved",
        cipherId: "cipher-3",
        requesterName: "Grace Hopper",
        status: "approved",
        resolvedAt: fromNow(-2 * HOUR),
        leaseNotBefore: fromNow(HOUR),
        leaseNotAfter: fromNow(3 * HOUR),
        decisions: [decision()],
      }),
      names,
    ),
    toRequestRow(
      accessRequest({
        id: "req-managed-denied",
        cipherId: "cipher-2",
        requesterName: "Katherine Johnson",
        status: "denied",
        resolvedAt: fromNow(-DAY),
        decisions: [decision({ verdict: "deny" })],
      }),
      names,
    ),
  ];
}

function history(
  options: {
    mine?: typeof MY_ROWS;
    managed?: () => typeof MY_ROWS;
    canApprove?: boolean;
  } = {},
) {
  const { mine = MY_ROWS, managed, canApprove = managed != null } = options;
  return moduleMetadata({
    imports: [HistoryTabComponent],
    providers: [
      {
        provide: MyAccessService,
        useValue: {
          historyRows$: of(mine),
          cipherById$: of(names.cipherById),
          loading$: of(false),
          loadError$: of(null),
        },
      },
      {
        provide: ApproverInboxService,
        useFactory: () => {
          const rows = managed?.() ?? [];
          return {
            historyRows$: of(rows),
            managedIds$: of(new Set(rows.map((row) => String(row.id)))),
            cipherById$: of(names.cipherById),
            loading$: of(false),
            loadError$: of(null),
            revokeLease: () => Promise.resolve(),
            cancelApproval: () => Promise.resolve(),
          };
        },
      },
      { provide: ApprovalPrivilegeService, useValue: { canApprove$: of(canApprove) } },
      { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/History Tab",
  component: HistoryTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<pam-history-tab />` }),
} as Meta<HistoryTabComponent>;

type Story = StoryObj<HistoryTabComponent>;

/**
 * The caller's own history, for a member who cannot approve. With no managed rows and no approval
 * privilege the Mine/Managed toggle is not rendered at all — a scope switch with one option is noise.
 */
export const Default: Story = {
  decorators: [history()],
};

/** Nothing resolved yet. */
export const Empty: Story = {
  decorators: [history({ mine: [] })],
};

/**
 * An approver's view: the table opens on the managed scope because there is history behind it, with
 * the revoke and withdraw actions that only exist there. Switch the toggle for the rows the
 * approver raised themselves.
 */
export const WithManagedHistory: Story = {
  decorators: [history({ managed: managedRows })],
};

/** An approver with nothing decided yet: the scope toggle is offered before it has content. */
export const ApproverWithoutManagedHistory: Story = {
  decorators: [history({ canApprove: true })],
};

/**
 * An approver whose own history is empty but who has decided other people's requests. Opens on the
 * managed scope: the Actions column exists nowhere else, so this is the only story that renders the
 * revoke and withdraw buttons.
 */
export const ManagedOnly: Story = {
  decorators: [history({ mine: [], managed: managedRows })],
  play: async ({ canvasElement }) => {
    const managed = await within(canvasElement).findByTestId("history-scope-managed");
    await userEvent.click(within(managed).getByRole("radio"));
  },
};
