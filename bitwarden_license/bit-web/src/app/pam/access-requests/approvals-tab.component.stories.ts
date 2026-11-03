import { importProvidersFrom } from "@angular/core";
import { provideRouter, withHashLocation } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
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
  fromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  startClockAtStoryNow,
  storyNames,
} from "../testing/story-fixtures";

import { ApprovalsTabComponent } from "./approvals-tab.component";

const names = storyNames();

/** `canDecide` is false only for the viewer's own request. */
function row(overrides: Record<string, unknown>, canDecide = true): ApprovalRow {
  return toApprovalRow(accessRequest(overrides), names, STORY_NOW, canDecide, "en-US");
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
  // The viewer's own request, whose decide buttons are disabled with a tooltip.
  row({ id: "req-4", cipherId: "cipher-2", requesterName: "You", reason: "Own request." }, false),
];

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
      leaseNotBefore: fromNow(-20 * MINUTE),
      leaseNotAfter: fromNow(40 * MINUTE),
    }),
    lease({
      id: "req-live-2",
      cipherId: "cipher-2",
      collectionId: "col-2",
      producedLeaseId: "lease-2",
      requesterName: "Alan Turing",
      requesterEmail: "alan@example.com",
      leaseNotBefore: fromNow(-2 * HOUR),
      leaseNotAfter: fromNow(3 * HOUR),
    }),
    lease(
      {
        id: "req-live-3",
        cipherId: "cipher-3",
        producedLeaseId: "lease-3",
        requesterName: "Katherine Johnson",
        requesterEmail: "katherine@example.com",
        leaseNotBefore: fromNow(-90 * MINUTE),
        leaseNotAfter: fromNow(30 * MINUTE),
      },
      { addedSeconds: 2 * 60 * 60, latestEndMs: STORY_NOW.getTime() + 2.5 * HOUR },
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
        // A factory, so real-clock lease windows stamp when the story renders, not at module load.
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
  render: () => ({ template: `<pam-approvals-tab />` }),
} as Meta<ApprovalsTabComponent>;

type Story = StoryObj<ApprovalsTabComponent>;

/** Both sections populated: decisions to make, and access already running. */
export const Default: Story = {
  decorators: [inbox({ leases: activeLeases })],
};

/** A chip applied, which renders the toolbar's applied-filter row. */
export const Filtered: Story = {
  decorators: [inbox({ leases: activeLeases })],
  play: async ({ canvasElement }) => {
    const trigger = await within(canvasElement).findByRole("button", { name: /^Collection/ });
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByRole("radio", { name: /^Production/ }));
    await userEvent.keyboard("{Escape}");
  },
};

/** Nothing left to decide, but the access the operator granted is still live and can be ended. */
export const ActiveAccessOnly: Story = {
  decorators: [inbox({ rows: [], leases: activeLeases })],
};

/** Nothing awaiting a decision, as opposed to a filter that matched nothing. */
export const Empty: Story = {
  decorators: [inbox({ rows: [] })],
};

/**
 * The first load. The skeleton is held back for a second, so the Chromatic capture is delayed past
 * that to catch it.
 */
export const Loading: Story = {
  decorators: [inbox({ rows: [], loading: true })],
  parameters: { chromatic: { delay: 1500 } },
};

/** A single request, the smallest table before the empty state takes over. */
export const SingleRequest: Story = {
  decorators: [inbox({ rows: [ROWS[0]] })],
};
