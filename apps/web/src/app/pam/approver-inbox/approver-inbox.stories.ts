import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { LockService, LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import { AccessRequestDetailsResponse, AccessDecisionRequest, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { ProductSwitcherService } from "../../layouts/product-switcher/shared/product-switcher.service";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxComponent } from "./approver-inbox.component";

const CURRENT_USER_ID = "user-current";

function row(
  overrides: Partial<{
    id: string;
    requesterId: string;
    requesterName: string | null;
    requesterEmail: string;
    cipherName: string;
    collectionName: string;
    reason: string | null;
    submittedAt: string;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
    requestedTtlSeconds: number;
  }> = {},
): AccessRequestDetailsResponse {
  const submittedAt = overrides.submittedAt ?? new Date(Date.now() - 30 * 60_000).toISOString();
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterId ?? "user-2",
    Status: "pending",
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    RequestedTtlSeconds: overrides.requestedTtlSeconds ?? 3600,
    Reason: overrides.reason ?? "Need to debug a production incident",
    SubmittedAt: submittedAt,
    CipherName: overrides.cipherName ?? "Prod DB admin",
    CollectionName: overrides.collectionName ?? "Production",
    RequesterName: overrides.requesterName ?? "Bob Engineer",
    RequesterEmail: overrides.requesterEmail ?? "bob@example.com",
  });
}

function fakeApi(rows: AccessRequestDetailsResponse[]): PamApiService {
  return {
    cancelAccessRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not used")),
    decideAccessRequest: (id: string, _request: AccessDecisionRequest) =>
      Promise.resolve(new AccessRequestDetailsResponse({ Id: id, Status: "approved" })),
    revokeAccessLease: () => Promise.resolve(),
    listInboxRequests: () => Promise.resolve(rows),
    listInboxHistory: () => Promise.resolve([]),
    // The embedded "My requests" list loads its own data; the inbox stories focus on the
    // approver queue, so keep it empty.
    listMyAccessRequests: () => Promise.resolve([]),
  } as unknown as PamApiService;
}

function decorators(rows: AccessRequestDetailsResponse[]) {
  return [
    moduleMetadata({
      imports: [I18nPipe],
      providers: [
        { provide: PamApiService, useValue: fakeApi(rows) },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: CURRENT_USER_ID,
              email: "me@example.com",
              emailVerified: true,
              name: "Me",
            }),
          },
        },
        {
          provide: ToastService,
          useValue: { showToast: () => {} },
        },
        {
          provide: LogService,
          useValue: { error: () => {} },
        },
        {
          provide: ApproverInboxBadgeService,
          useValue: { count$: of(0), refresh: () => Promise.resolve() },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              cancel: "Cancel",
              loading: "Loading...",
              pamInboxTitle: "Access requests",
              pamInboxSubtitle: "Approve or deny lease requests for the collections you manage.",
              pamInboxInCollection: "in __$1__",
              pamInboxRequester: "Requester",
              pamInboxWindow: "Requested window",
              pamInboxWindowAsap: "As soon as possible",
              pamInboxDurationHours: "__$1__ hours",
              pamInboxReason: "Reason",
              pamInboxReasonMissing: "(no reason given)",
              pamInboxApprove: "Approve",
              pamInboxDeny: "Deny",
              pamInboxConfirmApprove: "Approve this request?",
              pamInboxConfirmDeny: "Deny this request?",
              pamInboxConfirmApproveButton: "Confirm approve",
              pamInboxConfirmDenyButton: "Confirm deny",
              pamInboxCommentLabel: "Comment (optional)",
              pamInboxCommentPlaceholder: "Optional message for the requester",
              pamInboxApprovedToast: "Request approved",
              pamInboxDeniedToast: "Request denied",
              pamInboxDecisionFailed: "Couldn't submit your decision. Try again.",
              pamInboxLoadFailed: "Couldn't load the inbox.",
              pamInboxEmptyTitle: "No requests waiting.",
              pamInboxEmptyDescription:
                "When someone requests access to a vault item in a collection you manage, it'll show up here.",
              pamInboxNotApproverTitle:
                "You're not designated to approve requests for any collections.",
              pamInboxNotApproverDescription:
                "Ask an organization admin to grant you Manage on collections that use leasing.",
              pamInboxCannotApproveOwn: "You can't approve your own requests.",
              pamInboxElapsedJustNow: "just now",
              pamInboxElapsedMinutes: "__$1__ min ago",
              pamInboxElapsedHours: "__$1__ h ago",
              pamInboxElapsedDays: "__$1__ d ago",
            }),
        },
        // The page renders the shared <app-header> (product switcher + account
        // menu) for the standard top bar. These stubs satisfy that dependency
        // graph so the inbox displays under a realistic top bar in isolation.
        { provide: ProductSwitcherService, useValue: { products$: of(undefined) } },
        { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
        {
          provide: VaultTimeoutSettingsService,
          useValue: { availableVaultTimeoutActions$: () => of([]) },
        },
        { provide: LogoutService, useValue: { logout: async () => {} } },
        { provide: LockService, useValue: { lock: async () => {} } },
        { provide: AvatarService, useValue: { avatarColor$: of(null) } },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule), provideRouter([])],
    }),
  ];
}

export default {
  title: "Web/PAM/Approver Inbox",
  component: ApproverInboxComponent,
} as Meta;

type Story = StoryObj<ApproverInboxComponent>;

export const EmptyManagerCollections: Story = {
  decorators: decorators([]),
};

export const EmptyNoManagerCollections: Story = {
  decorators: decorators([]),
  args: {
    hasManagerCollections: false,
  },
};

export const PopulatedMixed: Story = {
  decorators: decorators([
    row({
      id: "req-1",
      submittedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      cipherName: "Prod DB admin",
      collectionName: "Production",
      reason: "Investigating a customer-reported outage",
      requestedTtlSeconds: 3600,
    }),
    row({
      id: "req-2",
      submittedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      cipherName: "Staging API key",
      collectionName: "Staging",
      reason: null,
      requestedTtlSeconds: 7200,
      requestedNotBefore: new Date(Date.now() + 60 * 60_000).toISOString(),
      requestedNotAfter: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    }),
    row({
      id: "req-3",
      submittedAt: new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
      cipherName: "Read-only analytics",
      collectionName: "Analytics",
      reason: "Quarterly access review",
      requestedTtlSeconds: 14_400,
    }),
  ]),
};

export const PopulatedWithSelfRequest: Story = {
  decorators: decorators([
    row({
      id: "req-self",
      submittedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      requesterId: CURRENT_USER_ID,
      requesterName: "Me",
      requesterEmail: "me@example.com",
      cipherName: "My own request",
      collectionName: "Production",
      reason: "Self-requested for testing",
    }),
    row({
      id: "req-other",
      submittedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      cipherName: "Their cipher",
      collectionName: "Production",
    }),
  ]),
};
