import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import { AccessRequestDetailsResponse, AccessRequestStatus, PamApiService } from "@bitwarden/pam";

import { MyAccessRequestsComponent } from "./my-access-requests.component";

type Fixture = {
  id: string;
  status: AccessRequestStatus;
  submittedAt: string;
  resolvedAt?: string | null;
  approverId?: string | null;
  approverComment?: string | null;
  requestedNotBefore?: string | null;
  requestedNotAfter?: string | null;
};

const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;
const now = Date.now();

function makeResponse(f: Fixture): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: f.id,
    CipherId: `cipher-${f.id}`,
    CollectionId: "col-1",
    RequesterUserId: "me",
    Status: f.status,
    RequestedNotBefore: f.requestedNotBefore ?? null,
    RequestedNotAfter: f.requestedNotAfter ?? null,
    RequestedTtlSeconds: 3600,
    Reason: null,
    SubmittedAt: f.submittedAt,
    ResolvedAt: f.resolvedAt ?? null,
    ResolverUserId: f.approverId ?? null,
    ResolverComment: f.approverComment ?? null,
    LeaseId: null,
  });
}

function pamApi(responses: AccessRequestDetailsResponse[]): PamApiService {
  return {
    cancelAccessRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not implemented")),
    decideAccessRequest: () => Promise.reject(new Error("not implemented")),
    revokeAccessLease: () => Promise.resolve(),
    listMyAccessRequests: () => Promise.resolve(responses),
  } as unknown as PamApiService;
}

const i18nMock = () =>
  new I18nMockService({
    loading: "Loading…",
    cancel: "Cancel",
    pamMyRequestsPageTitle: "My requests",
    pamMyRequestsEmptyTitle: "No access requests yet",
    pamMyRequestsEmptyDescription:
      "When you request access to a leased credential, it will show up here.",
    pamMyRequestsPendingSection: "Pending",
    pamMyRequestsRecentSection: "Recent (last 7 days)",
    pamMyRequestsPendingEmpty: "No pending requests.",
    pamMyRequestsRecentEmpty: "No requests resolved in the last 7 days.",
    pamMyRequestsLoadError: "Load error",
    pamMyRequestsCancelSuccess: "Cancelled",
    pamMyRequestsCancelError: "Cancel error",
    pamStatusPending: "Pending",
    pamStatusApproved: "Approved",
    pamStatusDenied: "Denied",
    pamStatusCancelled: "Cancelled",
    pamStatusExpired: "Expired",
    pamColumnItem: "Item",
    pamColumnRequestedWindow: "Requested window",
    pamColumnSubmitted: "Submitted",
    pamColumnApprovers: "Approvers",
    pamColumnStatus: "Status",
    pamColumnResolver: "Resolver",
    pamColumnComment: "Comment",
    pamColumnResolved: "Resolved",
    pamApproversTbd: "Awaiting approval",
    pamResolverAccessRule: "Access rule",
    pamWindowUntil: "Until __$1__",
    pamWindowTtlSeconds: "__$1__s",
    actions: "Actions",
  });

const withFixtures = (responses: AccessRequestDetailsResponse[]) => ({
  decorators: [
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
    moduleMetadata({
      providers: [
        { provide: I18nService, useFactory: i18nMock },
        { provide: PamApiService, useValue: pamApi(responses) },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) =>
              flag === FeatureFlag.Pam
                ? new BehaviorSubject<boolean>(true).asObservable()
                : new BehaviorSubject<boolean>(false).asObservable(),
          },
        },
        {
          provide: ToastService,
          useValue: { showToast: (): void => undefined },
        },
        { provide: LogService, useValue: { error: (): void => undefined } },
      ],
    }),
  ],
});

export default {
  title: "Web/PAM/My Requests",
  component: MyAccessRequestsComponent,
} as Meta<MyAccessRequestsComponent>;

type Story = StoryObj<MyAccessRequestsComponent>;

export const Empty: Story = {
  ...withFixtures([]),
};

export const OnlyPending: Story = {
  ...withFixtures([
    makeResponse({
      id: "p1",
      status: "pending",
      submittedAt: new Date(now - 2 * oneHour).toISOString(),
      requestedNotAfter: new Date(now + 4 * oneHour).toISOString(),
    }),
    makeResponse({
      id: "p2",
      status: "pending",
      submittedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      requestedNotBefore: new Date(now + 60 * 60 * 1000).toISOString(),
      requestedNotAfter: new Date(now + 3 * oneHour).toISOString(),
    }),
  ]),
};

export const OnlyRecent: Story = {
  ...withFixtures([
    makeResponse({
      id: "r1",
      status: "approved",
      submittedAt: new Date(now - 2 * oneDay).toISOString(),
      resolvedAt: new Date(now - 1 * oneDay).toISOString(),
      approverId: "alice-id",
      approverComment: "LGTM",
    }),
    makeResponse({
      id: "r2",
      status: "denied",
      submittedAt: new Date(now - 3 * oneDay).toISOString(),
      resolvedAt: new Date(now - 2 * oneDay).toISOString(),
      approverId: "bob-id",
      approverComment: "Wrong scope.",
    }),
    makeResponse({
      id: "r3",
      status: "expired",
      submittedAt: new Date(now - 4 * oneDay).toISOString(),
      resolvedAt: new Date(now - 3 * oneDay).toISOString(),
      approverId: null,
    }),
  ]),
};

export const Mixed: Story = {
  ...withFixtures([
    makeResponse({
      id: "p1",
      status: "pending",
      submittedAt: new Date(now - 2 * oneHour).toISOString(),
      requestedNotAfter: new Date(now + 4 * oneHour).toISOString(),
    }),
    makeResponse({
      id: "r1",
      status: "approved",
      submittedAt: new Date(now - 2 * oneDay).toISOString(),
      resolvedAt: new Date(now - 1 * oneDay).toISOString(),
      approverId: "alice-id",
      approverComment: "Approved for incident response.",
    }),
    makeResponse({
      id: "r2",
      status: "cancelled",
      submittedAt: new Date(now - 4 * oneDay).toISOString(),
      resolvedAt: new Date(now - 4 * oneDay).toISOString(),
      approverId: null,
    }),
  ]),
};
