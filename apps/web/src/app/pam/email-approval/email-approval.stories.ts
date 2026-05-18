import { importProvidersFrom } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components";
import {
  InboxLeaseRequestResponse,
  LeaseDecisionRequest,
  LeaseRequestResponse,
  PamApiService,
} from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../core/tests";

import { EmailApprovalComponent } from "./email-approval.component";

const CURRENT_USER_ID = "user-approver";

function makeRequest(
  overrides: Partial<{
    requesterUserId: string;
    reason: string | null;
    requestedNotBefore: string | null;
    requestedNotAfter: string | null;
    requestedTtlSeconds: number;
  }> = {},
): InboxLeaseRequestResponse {
  return new InboxLeaseRequestResponse({
    Id: "req-1",
    CipherId: "cipher-1",
    CollectionId: "col-1",
    RequesterUserId: overrides.requesterUserId ?? "user-requester",
    Status: "pending",
    RequestedTtlSeconds: overrides.requestedTtlSeconds ?? 3600,
    SubmittedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    RequestedNotBefore: overrides.requestedNotBefore ?? null,
    RequestedNotAfter: overrides.requestedNotAfter ?? null,
    Reason: overrides.reason ?? "Need to investigate a production incident",
    CipherName: "Prod DB admin",
    CollectionName: "Production",
    RequesterName: "Bob Engineer",
    RequesterEmail: "bob@example.com",
  });
}

function fakeApi(opts: { shouldFail?: boolean } = {}): PamApiService {
  return {
    fetchGatedCipher: () => Promise.reject(new Error("not used")),
    patchLeaseRequest: () => Promise.reject(new Error("not used")),
    cancelLeaseRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not used")),
    decideLeaseRequest: (id: string) =>
      opts.shouldFail
        ? Promise.reject(new Error("server error"))
        : Promise.resolve(new LeaseRequestResponse({ Id: id, Status: "approved" })),
    revokeLease: () => Promise.resolve(),
    setCollectionLeasingConfig: () => Promise.reject(new Error("not used")),
    listInboxRequests: () => Promise.resolve([]),
    submitDecision: (id: string, req: LeaseDecisionRequest) =>
      opts.shouldFail
        ? Promise.reject(new Error("server error"))
        : Promise.resolve(
            new LeaseRequestResponse({
              Id: id,
              Status: req.decision === "approve" ? "approved" : "denied",
            }),
          ),
    getInboxBadgeCount: () => Promise.reject(new Error("not used")),
    getLeaseRequest: () => Promise.reject(new Error("not used")),
  } as unknown as PamApiService;
}

const i18nKeys = {
  cancel: "Cancel",
  loading: "Loading...",
  pamInboxInCollection: "in $COLLECTION$",
  pamInboxRequester: "Requester",
  pamInboxWindow: "Requested window",
  pamInboxWindowAsap: "As soon as possible",
  pamInboxDurationHours: "$HOURS$ hours",
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
  pamInboxDecisionFailed: "Couldn't submit your decision. Try again.",
  pamInboxCannotApproveOwn: "You can't approve your own requests.",
  lockedVaultApprovalBanner: "Vault locked — approval mode",
  lockedVaultApprovalTitle: "Access request",
  lockedVaultApprovalSubtitle:
    "Your vault is locked. You can still approve or deny this request.",
  lockedVaultApprovalApproved: "Request approved.",
  lockedVaultApprovalDenied: "Request denied.",
  lockedVaultApprovalUnlockVault: "Unlock vault",
  lockedVaultApprovalReturnToInbox: "Return to inbox",
  emailApprovalCipherLabel: "Item",
};

function decorators(request: InboxLeaseRequestResponse, opts: { shouldFail?: boolean } = {}) {
  return [
    moduleMetadata({
      imports: [JslibModule, RouterTestingModule],
      providers: [
        { provide: PamApiService, useValue: fakeApi(opts) },
        {
          provide: ToastService,
          useValue: { showToast: () => {} },
        },
        {
          provide: LogService,
          useValue: { error: () => {} },
        },
        {
          provide: I18nService,
          useFactory: () => new I18nMockService(i18nKeys),
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ];
}

export default {
  title: "Web/PAM/Email Approval (Locked Vault)",
  component: EmailApprovalComponent,
} as Meta;

type Story = StoryObj<EmailApprovalComponent>;

export const Default: Story = {
  decorators: decorators(makeRequest()),
  args: {
    request: makeRequest(),
    currentUserId: CURRENT_USER_ID,
  },
};

export const WithReason: Story = {
  decorators: decorators(makeRequest({ reason: "Investigating a P0 incident in the EU cluster" })),
  args: {
    request: makeRequest({ reason: "Investigating a P0 incident in the EU cluster" }),
    currentUserId: CURRENT_USER_ID,
  },
};

export const NoReason: Story = {
  decorators: decorators(makeRequest({ reason: null })),
  args: {
    request: makeRequest({ reason: null }),
    currentUserId: CURRENT_USER_ID,
  },
};

export const SelfRequest: Story = {
  decorators: decorators(makeRequest({ requesterUserId: CURRENT_USER_ID })),
  args: {
    request: makeRequest({ requesterUserId: CURRENT_USER_ID }),
    currentUserId: CURRENT_USER_ID,
  },
};

export const WithScheduledWindow: Story = {
  decorators: decorators(
    makeRequest({
      requestedNotBefore: new Date(Date.now() + 60 * 60_000).toISOString(),
      requestedNotAfter: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
      requestedTtlSeconds: 10800,
    }),
  ),
  args: {
    request: makeRequest({
      requestedNotBefore: new Date(Date.now() + 60 * 60_000).toISOString(),
      requestedNotAfter: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
      requestedTtlSeconds: 10800,
    }),
    currentUserId: CURRENT_USER_ID,
  },
};
