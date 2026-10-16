import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessRequestView } from "../../abstractions/access-lease";
import { ApprovalRow, toApprovalRow } from "../../approvals/approval-row";
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
  STORY_NOW,
  storyNames,
} from "../../testing/story-fixtures";

import { AccessRequestDetailService, AccessRequestViewer } from "./access-request-detail.service";
import {
  AccessRequestDialogComponent,
  AccessRequestDialogParams,
} from "./access-request-dialog.component";

const names = storyNames();

/**
 * A stub of the detail service is the whole fixture. `request` is a factory so open windows use
 * the real clock the countdown runs on. An approver's decision needs `approvalRow`, and Withdraw
 * and Revoke need `managed`.
 */
function detail(
  options: {
    request?: () => AccessRequestView;
    notFound?: boolean;
    error?: unknown;
    viewer?: AccessRequestViewer;
    approvalRow?: (request: AccessRequestView) => ApprovalRow;
    managed?: boolean;
  } = {},
) {
  const request = options.request?.() ?? null;
  const params: AccessRequestDialogParams = {
    detail: {
      request$: of(request),
      names$: of(names),
      loading$: of(false),
      loadError$: of(options.error ?? null),
      notFound$: of(options.notFound ?? false),
      cipherById$: of(names.cipherById),
      viewer$: of(options.viewer ?? "requester"),
      approvalRow$: of(
        request != null && options.approvalRow ? options.approvalRow(request) : null,
      ),
      managed$: of(options.managed ?? false),
      cancel: () => Promise.resolve(),
      activate: () => Promise.resolve(),
      endLease: () => Promise.resolve(),
      decide: () => Promise.resolve(),
      withdrawApproval: () => Promise.resolve(),
      revokeLease: () => Promise.resolve(),
    } as unknown as AccessRequestDetailService,
  };

  return moduleMetadata({
    imports: [AccessRequestDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: { close: () => {} } },
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
  title: "Web/PAM/Access Requests/Request Detail",
  component: AccessRequestDialogComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideStoryLogService(),
        // The request summary renders the item's vault icon, which reads these three.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
  ],
  render: () => ({ template: `<pam-access-request-dialog />` }),
} as Meta<AccessRequestDialogComponent>;

type Story = StoryObj<AccessRequestDialogComponent>;

/** Awaiting a decision, as the requester sees it. */
export const Pending: Story = {
  decorators: [detail({ request: () => accessRequest({}) })],
};

/** Approved and redeemable: Start is offered, and the decision log names who approved it. */
export const ApprovedReadyToStart: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-10 * MINUTE),
          leaseNotBefore: liveFromNow(0),
          leaseNotAfter: liveFromNow(2 * HOUR),
          decisions: [decision({ comment: "Approved for the incident window." })],
        }),
    }),
  ],
};

/** Activated, with the lease still running and its countdown ticking. */
export const ActiveLease: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-40 * MINUTE),
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          leaseNotBefore: liveFromNow(-30 * MINUTE),
          leaseNotAfter: liveFromNow(90 * MINUTE),
          decisions: [decision()],
        }),
    }),
  ],
};

/**
 * The countdown runs to the lease's own end, an hour past the request's window, and the badge
 * names the time added.
 */
export const ExtendedLease: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-40 * MINUTE),
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          leaseNotBefore: liveFromNow(-30 * MINUTE),
          leaseNotAfter: liveFromNow(30 * MINUTE),
          producedLeaseNotAfter: liveFromNow(90 * MINUTE),
          decisions: [decision()],
        }),
    }),
  ],
};

/** Denied, with the approver's reasoning carried in the decision log. */
export const Denied: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "denied",
          resolvedAt: fromNow(-DAY),
          decisions: [decision({ verdict: "deny", comment: "Use the read replica instead." })],
        }),
    }),
  ],
};

/** Auto-approved by the rule: the decision log credits the rule rather than a person. */
export const AutoApproved: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-2 * HOUR),
          producedLeaseId: "lease-2",
          producedLeaseStatus: "expired",
          decisions: [decision({ decider: "automatic" })],
        }),
    }),
  ],
};

/**
 * A request that doesn't exist or isn't the caller's to see; the server 404s both, so ids can't be
 * probed.
 */
export const NotFound: Story = {
  decorators: [detail({ notFound: true })],
};

/** Any other read failure falls through to the generic error state. */
export const LoadError: Story = {
  decorators: [
    detail({ error: { name: "AccessRequestError", variant: "Api", message: "[500] boom" } }),
  ],
};

/** Someone else's request as it sits in the viewer's inbox, built through the real row builder. */
function inboxRow(request: AccessRequestView): ApprovalRow {
  return toApprovalRow(request, names, STORY_NOW, true);
}

/**
 * The approver arriving from the "needs your decision" email: Approve and Deny, and none of the
 * requester's actions.
 */
export const ApproverPending: Story = {
  decorators: [
    detail({ request: () => accessRequest({}), viewer: "approver", approvalRow: inboxRow }),
  ],
};

/** Approved on a collection the viewer manages but not started yet: Withdraw approval. */
export const ApproverApprovedNotStarted: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-10 * MINUTE),
          leaseNotBefore: liveFromNow(0),
          leaseNotAfter: liveFromNow(2 * HOUR),
          decisions: [decision({ comment: "Approved for the incident window." })],
        }),
      viewer: "approver",
      managed: true,
    }),
  ],
};

/** Access in use on a collection the viewer manages: Revoke. */
export const ApproverActiveLease: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-40 * MINUTE),
          producedLeaseId: "lease-1",
          producedLeaseStatus: "active",
          leaseNotBefore: liveFromNow(-30 * MINUTE),
          leaseNotAfter: liveFromNow(90 * MINUTE),
          decisions: [decision()],
        }),
      viewer: "approver",
      managed: true,
    }),
  ],
};
