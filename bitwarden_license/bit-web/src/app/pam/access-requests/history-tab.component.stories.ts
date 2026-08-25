import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

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

/** A grant the caller decided as an approver, still running — the only revocable shape. */
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

function history(options: { mine?: typeof MY_ROWS; managed?: () => typeof MY_ROWS } = {}) {
  const { mine = MY_ROWS, managed } = options;
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
        // The row links are routerLinks, and their replaceUrl reads the route's query params.
        provideRouter([]),
      ],
    }),
  ],
  render: () => ({ template: `<pam-history-tab />` }),
} as Meta<HistoryTabComponent>;

type Story = StoryObj<HistoryTabComponent>;

/**
 * The caller's own history. With no managed rows the Mine/Managed toggle is not rendered at all —
 * a scope switch with one option is noise.
 */
export const Default: Story = {
  decorators: [history()],
};

/** Nothing resolved yet. */
export const Empty: Story = {
  decorators: [history({ mine: [] })],
};

/**
 * An approver's view: the Mine/Managed toggle appears because there is managed history behind it.
 * The table still opens on Mine — switch the toggle to see the revoke and cancel-approval actions,
 * which only exist on the managed scope.
 */
export const WithManagedHistory: Story = {
  decorators: [history({ managed: managedRows })],
};

/** An approver whose own history is empty but who has decided other people's requests. */
export const ManagedOnly: Story = {
  decorators: [history({ mine: [], managed: managedRows })],
};
