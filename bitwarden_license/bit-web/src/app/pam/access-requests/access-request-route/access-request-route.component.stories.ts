import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { EMPTY } from "rxjs";

import { DIALOG_DATA, DialogService, DrawerRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessEventService } from "../../abstractions/access-event.service";
import type { AccessRequestView } from "../../abstractions/access-lease";
import { AccessLeaseSdkService } from "../../abstractions/access-lease-sdk.service";
import { AccessRequestSdkService } from "../../abstractions/access-request-sdk.service";
import { LeasingErrorService } from "../../abstractions/leasing-error.service";
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
import { AccessNameResolverService } from "../access-name-resolver.service";

import { AccessRequestRouteComponent } from "./access-request-route.component";

const names = storyNames();

/** The 404 shape the drawer reads as "not found" rather than an error banner. */
const NOT_FOUND = {
  name: "AccessRequestError",
  variant: "Api",
  message: "Received error message from server: [404] Resource not found.",
};

/**
 * The component declares `providers: [AccessRequestDetailService]`, so a module-level stub of that
 * service is shadowed and the real one is always constructed. These stories therefore stub the
 * service's own dependencies and let the real drawer-scoped service run — which is more faithful
 * anyway, since the loading/not-found/error states are its logic, not the component's.
 *
 * The drawer clocks its own countdown for a running lease, so windows that must still be open are
 * built against the real clock inside the factory.
 */
function detail(options: { request?: () => AccessRequestView; error?: unknown } = {}) {
  const { request, error } = options;
  return moduleMetadata({
    imports: [AccessRequestRouteComponent],
    providers: [
      {
        provide: AccessRequestSdkService,
        useFactory: () => ({
          getAccessRequest: () =>
            error != null ? Promise.reject(error) : Promise.resolve(request?.()),
          cancelAccessRequest: () => Promise.resolve(),
          activateAccessRequest: () => Promise.resolve({}),
        }),
      },
      { provide: AccessLeaseSdkService, useValue: { endLease: () => Promise.resolve() } },
      {
        provide: AccessNameResolverService,
        useValue: { resolveNames: () => Promise.resolve(names) },
      },
      {
        provide: LeasingErrorService,
        useValue: {
          isLeasingError: (e: unknown) =>
            typeof e === "object" && e != null && "variant" in (e as object),
        },
      },
      { provide: AccessEventService, useValue: { accessChanged$: () => EMPTY } },
      { provide: DIALOG_DATA, useValue: { requestId: "req-1" } },
      { provide: DrawerRef, useValue: { isDrawer: true, close: () => {} } },
      { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Requests/Request Detail",
  component: AccessRequestRouteComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideStoryChangeDetection(),
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([])),
        provideStoryLogService(),
      ],
    }),
  ],
  render: () => ({ template: `<app-pam-access-request-route />` }),
} as Meta<AccessRequestRouteComponent>;

type Story = StoryObj<AccessRequestRouteComponent>;

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

/**
 * The widest content the detail layout has to absorb: a long free-text reason, and a decision log
 * carrying more than one entry — here an approval that was later pulled back by an operator.
 */
export const LongReasonAndMultipleDecisions: Story = {
  decorators: [
    detail({
      request: () =>
        accessRequest({
          status: "approved",
          resolvedAt: fromNow(-35 * MINUTE),
          producedLeaseId: "lease-3",
          producedLeaseStatus: "revoked",
          reason:
            "Paging on the checkout latency spike. I need the primary to compare its slow-query log against the read replica, and the replica lag is already well outside the window we can reason about.",
          decisions: [
            decision({ comment: "Approved for the incident window." }),
            decision({
              decider: { human: { id: "operator-9", name: "Ops on-call" } },
              verdict: "deny",
              comment: "Incident closed, pulling access back.",
              decidedAt: fromNow(-5 * MINUTE),
            }),
          ],
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
 * returns 404 for both so ids cannot be probed, and the drawer reads that as not-found rather than
 * an error banner. Its only way out is Close, since the list it opened over is still behind it.
 */
export const NotFound: Story = {
  decorators: [detail({ error: NOT_FOUND })],
};

/** Any other read failure falls through to the generic error state. */
export const LoadError: Story = {
  decorators: [
    detail({ error: { name: "AccessRequestError", variant: "Api", message: "[500] boom" } }),
  ],
};
