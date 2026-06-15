import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { MyAccessRequestsListComponent } from "./my-access-requests-list.component";
import { MyAccessRequestsService } from "./my-access-requests.service";

/** Readable names for the gated ciphers, keyed by the `cipher-<id>` the fixtures request. */
const CIPHER_NAMES: Record<string, string> = {
  "cipher-p1": "Production database",
  "cipher-p2": "Staging API key",
  "cipher-r1": "AWS root account",
  "cipher-r2": "Billing portal",
  "cipher-r3": "Legacy VPN",
};

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

function pamApi(
  responses: AccessRequestDetailsResponse[],
  leases: AccessLeaseResponse[] = [],
): PamApiService {
  return {
    cancelAccessRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not implemented")),
    decideAccessRequest: () => Promise.reject(new Error("not implemented")),
    revokeAccessLease: () => Promise.resolve(),
    activateLease: () => Promise.reject(new Error("not implemented")),
    listMyAccessRequests: () => Promise.resolve(responses),
    listActiveLeases: () => Promise.resolve(leases),
  } as unknown as PamApiService;
}

/** Fills each row's cipher/collection name from the fixtures, as the real resolver would from vault state. */
function nameResolver(): AccessRequestNameResolver {
  return {
    resolveDisplayNames: async (rows: AccessRequestDetailsResponse[]) => {
      rows.forEach((row) => {
        row.cipherName = CIPHER_NAMES[row.cipherId] ?? row.cipherId;
        row.collectionName = "Production";
      });
    },
    namesFor: async (refs: ReadonlyArray<{ cipherId: string; collectionId: string }>) => ({
      cipherNameById: new Map(
        refs.map((r) => [r.cipherId, CIPHER_NAMES[r.cipherId] ?? r.cipherId]),
      ),
      collectionNameById: new Map(refs.map((r) => [r.collectionId, "Production"])),
    }),
  } as unknown as AccessRequestNameResolver;
}

const i18nMock = () =>
  new I18nMockService({
    loading: "Loading…",
    cancel: "Cancel",
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
    pamInboxInCollection: "in __$1__",
    pamApproversTbd: "Awaiting approval",
    pamResolverAccessRule: "Access rule",
    pamWindowUntil: "Until __$1__",
    pamWindowTtlSeconds: "__$1__s",
    window: "Window",
    pamMyLeasesActiveSection: "Active leases",
    pamMyLeasesActiveEmpty: "No active leases",
    pamMyRequestsHistorySection: "History",
    pamMyRequestsHistoryEmpty: "No request history",
    pamColumnRemaining: "Remaining",
    pamStartLeaseButton: "Start access",
    pamActivateWithin: "Activate within __$1__",
    actions: "Actions",
  });

const withFixtures = (
  responses: AccessRequestDetailsResponse[],
  leases: AccessLeaseResponse[] = [],
) => ({
  decorators: [
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
    moduleMetadata({
      providers: [
        MyAccessRequestsService,
        { provide: I18nService, useFactory: i18nMock },
        { provide: PamApiService, useValue: pamApi(responses, leases) },
        { provide: AccessRequestNameResolver, useValue: nameResolver() },
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
  component: MyAccessRequestsListComponent,
} as Meta<MyAccessRequestsListComponent>;

type Story = StoryObj<MyAccessRequestsListComponent>;

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

function makeLease(id: string, cipherId: string): AccessLeaseResponse {
  return new AccessLeaseResponse({
    Id: id,
    RequestId: `req-${id}`,
    CipherId: cipherId,
    CollectionId: "col-1",
    GranteeUserId: "me",
    NotBefore: new Date(now - oneHour).toISOString(),
    NotAfter: new Date(now + 2 * oneHour).toISOString(),
    Status: "active",
  });
}

export const WithActiveLeases: Story = {
  ...withFixtures(
    [
      makeResponse({
        id: "p1",
        status: "pending",
        submittedAt: new Date(now - oneHour).toISOString(),
        requestedNotAfter: new Date(now + 4 * oneHour).toISOString(),
      }),
    ],
    [makeLease("lease-1", "cipher-r1"), makeLease("lease-2", "cipher-p2")],
  ),
};
