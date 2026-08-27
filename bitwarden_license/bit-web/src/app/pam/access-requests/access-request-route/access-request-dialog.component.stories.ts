import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessRequestView } from "../../abstractions/access-lease";
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
} from "../../testing/story-fixtures";

import { AccessRequestDetailService } from "./access-request-detail.service";
import {
  AccessRequestDialogComponent,
  AccessRequestDialogParams,
} from "./access-request-dialog.component";

const names = storyNames();

/**
 * The dialog reads everything off the route-scoped detail service the host hands it, so a stub of
 * that service is the whole fixture — the load/not-found/error states are its states, surfaced
 * here as the three streams the dialog branches on.
 *
 * The dialog clocks its own countdown for a running lease, so windows that must still be open are
 * built against the real clock inside the factory.
 */
function detail(
  options: { request?: () => AccessRequestView; notFound?: boolean; error?: unknown } = {},
) {
  const params: AccessRequestDialogParams = {
    detail: {
      request$: of(options.request?.() ?? null),
      names$: of(names),
      loading$: of(false),
      loadError$: of(options.error ?? null),
      notFound$: of(options.notFound ?? false),
      cipherById$: of(names.cipherById),
      cancel: () => Promise.resolve(),
      activate: () => Promise.resolve(),
      endLease: () => Promise.resolve(),
    } as unknown as AccessRequestDetailService,
  };

  return moduleMetadata({
    imports: [AccessRequestDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: { close: () => {} } },
      { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
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
      ],
    }),
  ],
  render: () => ({ template: `<pam-access-request-dialog />` }),
} as Meta<AccessRequestDialogComponent>;

type Story = StoryObj<AccessRequestDialogComponent>;

/** Awaiting a decision — the shareable link an approver is most likely to be sent. */
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

/** Activated, with the lease still running — the remaining-time countdown ticks here. */
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
 * A link to a request that no longer exists — or that is not this caller's to see. The server
 * returns 404 for both so ids cannot be probed, and the detail service reads that as not-found
 * rather than an error banner.
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
