import { importProvidersFrom } from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SyncService } from "@bitwarden/common/platform/sync";
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
  startClockAtStoryNow,
  storyNames,
} from "../testing/story-fixtures";

import { HistoryTabComponent } from "./history-tab.component";
import { toRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

const names = storyNames();

/** The chip's menu renders in a CDK overlay on `document.body`, outside the story's canvas. */
async function selectHistoryScope(canvasElement: HTMLElement, option: string): Promise<void> {
  await userEvent.click(
    await within(canvasElement).findByRole("button", { name: /^History scope/ }),
  );
  // Scoped to the popover, since the chip also stamps each option into a hidden slot that an
  // unscoped query would match.
  const menu = await within(document.body).findByRole("dialog", { name: "History scope" });
  await userEvent.click(await within(menu).findByText(option));
  // Option rows are not `bitMenuItem`, so selecting one leaves the menu open over the table.
  await userEvent.keyboard("{Escape}");
}

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
      { provide: SyncService, useValue: { activeUserLastSync$: () => of(new Date()) } },
      { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/History Tab",
  component: HistoryTabComponent,
  beforeEach: startClockAtStoryNow,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
        // The item links need a router; the wildcard and hash keep a click inside the story.
        provideRouter([{ path: "**", children: [] }], withHashLocation()),
        // `app-vault-icon` on each row reads these.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
  ],
  render: () => ({ template: `<pam-history-tab />` }),
} as Meta<HistoryTabComponent>;

type Story = StoryObj<HistoryTabComponent>;

/** The history of a member who cannot approve, so no scope chip renders. */
export const Default: Story = {
  decorators: [history()],
};

/** Nothing resolved yet. */
export const Empty: Story = {
  decorators: [history({ mine: [] })],
};

export const EmptyForAnApprover: Story = {
  decorators: [history({ mine: [], canApprove: true })],
};

/** An approver's view, opening on All with revoke and withdraw offered only on managed rows. */
export const WithManagedHistory: Story = {
  decorators: [history({ managed: managedRows })],
};

/** A scope picked, which shows the applied-filter styling and the clear-all button. */
export const Filtered: Story = {
  decorators: [history({ managed: managedRows })],
  play: async ({ canvasElement }) => {
    await selectHistoryScope(canvasElement, "For my collections");
  },
};

/** An approver with nothing decided yet still gets the scope chip. */
export const ApproverWithoutManagedHistory: Story = {
  decorators: [history({ canApprove: true })],
};

/**
 * An approver whose own history is empty but who has decided other people's requests, filtered down
 * to the managed rows.
 */
export const ManagedOnly: Story = {
  decorators: [history({ mine: [], managed: managedRows })],
  play: async ({ canvasElement }) => {
    await selectHistoryScope(canvasElement, "For my collections");
  },
};

/** The "Raised by me" filter applied over a history that has both sources. */
export const MineFilter: Story = {
  decorators: [history({ managed: managedRows })],
  play: async ({ canvasElement }) => {
    await selectHistoryScope(canvasElement, "Raised by me");
  },
};
