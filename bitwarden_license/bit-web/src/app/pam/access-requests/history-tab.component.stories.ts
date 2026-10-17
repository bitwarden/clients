import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

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
  liveFromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { HistoryTabComponent } from "./history-tab.component";
import { MyAccessRequestRow, toRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

const names = storyNames();

/** The chip's menu renders in a CDK overlay on `document.body`, outside the story's canvas. */
async function selectFilterOptions(
  canvasElement: HTMLElement,
  filter: string,
  options: string[],
): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    `bit-filter-menu button[title^="${filter}"]`,
  )!;
  await userEvent.click(trigger);
  // Scoped to the popover, since the chip also stamps each option into a hidden slot that an
  // unscoped query would match.
  const menu = await within(document.body).findByRole("dialog", { name: filter });
  for (const option of options) {
    await userEvent.click(await within(menu).findByText(option));
  }
  // The berry updates only once the menu closes.
  await userEvent.keyboard("{Escape}");
}

const derek = { human: { id: "approver-1", name: "derek.finnegan", email: "derek@example.com" } };

const request = (overrides: Record<string, unknown>) =>
  toRequestRow(accessRequest({ requesterName: "marcus.chen", ...overrides }), names);

/**
 * One row per end state, as the design frame lists them. Built in a factory, since the tab reads
 * the real clock and the times must stay relative to it.
 */
function frameRows(): MyAccessRequestRow[] {
  return [
    request({
      id: "req-denied",
      cipherId: "cipher-2",
      collectionId: "col-2",
      status: "denied",
      resolvedAt: liveFromNow(0),
      decisions: [decision({ decider: derek, verdict: "deny", decidedAt: liveFromNow(0) })],
    }),
    request({
      id: "req-revoked",
      status: "approved",
      producedLeaseId: "lease-revoked",
      producedLeaseStatus: "revoked",
      resolvedAt: liveFromNow(-2 * HOUR),
      decisions: [
        decision({ decider: derek, decidedAt: liveFromNow(-2 * HOUR) }),
        decision({ decider: derek, verdict: "deny", decidedAt: liveFromNow(-HOUR) }),
      ],
    }),
    request({
      id: "req-canceled",
      cipherId: "cipher-3",
      status: "canceled",
      resolvedAt: liveFromNow(-3 * HOUR),
    }),
    request({
      id: "req-expired",
      cipherId: "cipher-2",
      collectionId: "col-2",
      requesterName: "sam.okafor",
      status: "expired",
      leaseNotBefore: liveFromNow(-DAY - HOUR),
      leaseNotAfter: liveFromNow(-DAY),
    }),
    request({
      id: "req-lapsed",
      requesterName: "sam.okafor",
      status: "approved",
      producedLeaseId: "lease-lapsed",
      producedLeaseStatus: "expired",
      producedLeaseNotAfter: liveFromNow(-2 * DAY),
      resolvedAt: liveFromNow(-2 * DAY - HOUR),
      decisions: [decision({ decider: "automatic" })],
    }),
    request({
      id: "req-ended",
      cipherId: "cipher-3",
      requesterName: "sam.okafor",
      status: "approved",
      producedLeaseId: "lease-ended",
      producedLeaseStatus: "canceled",
      resolvedAt: liveFromNow(-7 * DAY - HOUR),
      decisions: [
        decision({ decider: derek, decidedAt: liveFromNow(-7 * DAY - HOUR) }),
        decision({
          decider: { human: { id: "user-2", name: "sam.okafor", email: undefined } },
          verdict: "deny",
          decidedAt: liveFromNow(-7 * DAY),
        }),
      ],
    }),
    // Still running, so it stays on Approvals and My requests rather than listing here.
    request({
      id: "req-running",
      status: "approved",
      producedLeaseId: "lease-running",
      producedLeaseStatus: "active",
      producedLeaseNotAfter: liveFromNow(30 * MINUTE),
      decisions: [decision({ decider: derek })],
    }),
  ];
}

function history(options: { mine?: () => MyAccessRequestRow[]; canApprove?: boolean } = {}) {
  const { mine = () => [], canApprove = true } = options;
  return moduleMetadata({
    imports: [HistoryTabComponent],
    providers: [
      {
        provide: MyAccessService,
        useFactory: () => ({
          historyRows$: of(mine()),
          cipherById$: of(names.cipherById),
          loading$: of(false),
          loadError$: of(null),
        }),
      },
      {
        provide: ApproverInboxService,
        useFactory: () => ({
          historyRows$: of(canApprove ? frameRows() : []),
          cipherById$: of(names.cipherById),
          loading$: of(false),
          loadError$: of(null),
        }),
      },
      { provide: ApprovalPrivilegeService, useValue: { canApprove$: of(canApprove) } },
      { provide: SyncService, useValue: { activeUserLastSync$: () => of(new Date()) } },
      { provide: DialogService, useValue: { open: () => {} } },
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

/** An approver's history: every end state, newest first, with who or what resolved each. */
export const Default: Story = {
  decorators: [history()],
};

/** A member who cannot approve sees only their own requests. */
export const Requester: Story = {
  decorators: [
    history({
      canApprove: false,
      mine: () => frameRows().filter((row) => row.requester === "marcus.chen"),
    }),
  ],
};

/** Nothing has ended yet. */
export const Empty: Story = {
  decorators: [history({ canApprove: false })],
};

/** Two Status options picked, matching either. */
export const FilteredByStatus: Story = {
  decorators: [history()],
  play: async ({ canvasElement }) => {
    await selectFilterOptions(canvasElement, "Status", ["Denied", "Session ended"]);
  },
};

/** Filters across chips narrow together. */
export const FilteredAcrossFilters: Story = {
  decorators: [history()],
  play: async ({ canvasElement }) => {
    await selectFilterOptions(canvasElement, "Status", ["Session ended"]);
    await selectFilterOptions(canvasElement, "Requester", ["sam.okafor"]);
  },
};
