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
import { toApprovalRow } from "../approvals/approval-row";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  ApproverRow,
  fromApprovalRow,
  fromManagedLease,
  fromUnstartedApproval,
} from "../approvals/approver-row";
import { toManagedLeaseRow } from "../approvals/managed-lease-row";
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
function row(overrides: Record<string, unknown>, canDecide = true): ApproverRow {
  return fromApprovalRow(
    toApprovalRow(accessRequest(overrides), names, STORY_NOW, canDecide, "en-US"),
    STORY_NOW,
  );
}

const PENDING: ApproverRow[] = [
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

/**
 * Approved and running rows are built against `new Date()`, which `startClockAtStoryNow` has moved to
 * {@link STORY_NOW}, since the tab drops a row whose window has ended and the badge runs its own
 * countdown.
 */
function approved(overrides: Record<string, unknown>): ApproverRow {
  return fromUnstartedApproval(
    accessRequest({ status: "approved", ...overrides }),
    names,
    new Date(),
    "en-US",
  );
}

function lease(
  overrides: Record<string, unknown>,
  extension?: { addedSeconds: number; latestEndMs: number },
): ApproverRow {
  return fromManagedLease(
    toManagedLeaseRow(
      accessRequest({
        status: "approved",
        producedLeaseStatus: "active",
        ...overrides,
      }) as AccessRequestView & { producedLeaseId: AccessLeaseId },
      names,
      extension,
    ),
    new Date(),
    "en-US",
  );
}

function grantedRows(): ApproverRow[] {
  return [
    approved({
      id: "req-ready-1",
      cipherId: "cipher-3",
      requesterName: "Katherine Johnson",
      requesterEmail: "katherine@example.com",
      leaseNotBefore: fromNow(21 * HOUR),
      leaseNotAfter: fromNow(25 * HOUR),
    }),
    lease({
      id: "req-live-1",
      producedLeaseId: "lease-1",
      leaseNotBefore: fromNow(-20 * MINUTE),
      leaseNotAfter: fromNow(40 * MINUTE),
    }),
    lease(
      {
        id: "req-live-2",
        cipherId: "cipher-2",
        collectionId: "col-2",
        producedLeaseId: "lease-2",
        requesterName: "Alan Turing",
        requesterEmail: "alan@example.com",
        leaseNotBefore: fromNow(-2 * HOUR),
        leaseNotAfter: fromNow(HOUR),
      },
      { addedSeconds: 2 * 60 * 60, latestEndMs: STORY_NOW.getTime() + 2 * 24 * HOUR },
    ),
    lease({
      id: "req-live-3",
      cipherId: "cipher-3",
      producedLeaseId: "lease-3",
      requesterName: "Katherine Johnson",
      requesterEmail: "katherine@example.com",
      leaseNotBefore: fromNow(-55 * MINUTE),
      leaseNotAfter: fromNow(4 * MINUTE),
    }),
  ];
}

function inbox(options: { rows?: () => ApproverRow[]; loading?: boolean } = {}) {
  const { rows = () => [...PENDING, ...grantedRows()], loading = false } = options;
  return moduleMetadata({
    imports: [ApprovalsTabComponent],
    providers: [
      {
        provide: ApproverInboxService,
        // A factory, so real-clock windows stamp when the story renders, not at module load.
        useFactory: () => ({
          loading$: of(loading),
          loadError$: of(null),
          approverRows$: of(rows()),
          cipherById$: of(names.cipherById),
          decide: () => Promise.resolve(),
          revokeLease: () => Promise.resolve(),
          cancelApproval: () => Promise.resolve(),
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

/** Every stage in one table: awaiting a decision, ready to use, in use and ending soon. */
export const Default: Story = {
  decorators: [inbox()],
};

/** A Status chip applied, which renders the toolbar's applied-filter row. */
export const Filtered: Story = {
  decorators: [inbox()],
  play: async ({ canvasElement }) => {
    const trigger = await within(canvasElement).findByRole("button", { name: /^Status/ });
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByText("Pending approval"));
    await userEvent.keyboard("{Escape}");
  },
};

/** The row actions revealed on hover, here on a pending request. */
export const RowActions: Story = {
  decorators: [inbox()],
  play: async ({ canvasElement }) => {
    const [requester] = await within(canvasElement).findAllByText("Grace Hopper");
    await userEvent.hover(requester);
  },
};

/** Nothing awaiting a decision, but access the approver granted is still live and revocable. */
export const GrantedOnly: Story = {
  decorators: [inbox({ rows: grantedRows })],
};

/** Nothing to act on, as opposed to a filter that matched nothing. */
export const Empty: Story = {
  decorators: [inbox({ rows: () => [] })],
};

/**
 * The first load. The skeleton is held back for a second, so the Chromatic capture is delayed past
 * that to catch it.
 */
export const Loading: Story = {
  decorators: [inbox({ rows: () => [], loading: true })],
  parameters: { chromatic: { delay: 1500 } },
};

/** A single request, the smallest table before the empty state takes over. */
export const SingleRequest: Story = {
  decorators: [inbox({ rows: () => [PENDING[0]] })],
};
