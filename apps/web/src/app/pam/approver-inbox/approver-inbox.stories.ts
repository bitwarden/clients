import { importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { LockService, LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { DialogModule, ToastService } from "@bitwarden/components";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { PreloadedEnglishI18nModule } from "../../core/tests";
import { ProductSwitcherService } from "../../layouts/product-switcher/shared/product-switcher.service";
import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

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

function historyRow(
  overrides: Partial<{ id: string; status: string; resolvedAt: string; comment: string }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "hist-1",
    CipherId: "cipher-2",
    CollectionId: "col-1",
    RequesterUserId: "user-9",
    Status: overrides.status ?? "denied",
    RequestedNotBefore: null,
    RequestedNotAfter: new Date(Date.now() - 60 * 60_000).toISOString(),
    RequestedTtlSeconds: 3600,
    Reason: "Quarterly access review",
    SubmittedAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    ResolvedAt: overrides.resolvedAt ?? new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    ResolverComment: overrides.comment ?? "Outside approved hours",
    CipherName: "Datadog API key",
    CollectionName: "Monitoring",
    RequesterName: "Eli Santos",
    RequesterEmail: "eli@example.com",
  });
}

type ApiFixtures = {
  inbox?: AccessRequestDetailsResponse[];
  history?: AccessRequestDetailsResponse[];
  mine?: AccessRequestDetailsResponse[];
  leases?: AccessLeaseResponse[];
};

function fakeApi(fixtures: ApiFixtures): PamApiService {
  return {
    mutations$: of(),
    cancelAccessRequest: () => Promise.resolve(),
    requestLeaseExtension: () => Promise.reject(new Error("not used")),
    decideAccessRequest: (id: string, _request: AccessDecisionRequest) =>
      Promise.resolve(new AccessRequestDetailsResponse({ Id: id, Status: "approved" })),
    revokeAccessLease: () => Promise.resolve(),
    activateLease: () => Promise.reject(new Error("not used")),
    listInboxRequests: () => Promise.resolve(fixtures.inbox ?? []),
    listInboxHistory: () => Promise.resolve(fixtures.history ?? []),
    listMyAccessRequests: () => Promise.resolve(fixtures.mine ?? []),
    listActiveLeases: () => Promise.resolve(fixtures.leases ?? []),
  } as unknown as PamApiService;
}

function decorators(fixtures: ApiFixtures) {
  return [
    moduleMetadata({
      imports: [I18nPipe, DialogModule],
      providers: [
        { provide: PamApiService, useValue: fakeApi(fixtures) },
        // Names render from local vault state, filled in here as the real resolver would.
        {
          provide: AccessRequestNameResolver,
          useValue: {
            resolveDisplayNames: async (resolveRows: AccessRequestDetailsResponse[]) => {
              resolveRows.forEach((r) => {
                r.cipherName = r.cipherName ?? "Prod DB admin";
                r.collectionName = r.collectionName ?? "Production";
              });
            },
            namesFor: async () => ({
              cipherNameById: new Map(),
              collectionNameById: new Map(),
            }),
          },
        },
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
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: LogService, useValue: { error: () => {} } },
        { provide: ServerNotificationsService, useValue: { notifications$: of() } },
        {
          provide: ApproverInboxBadgeService,
          useValue: { count$: of(0), refresh: () => Promise.resolve() },
        },
        // The page renders the shared <app-header> (product switcher + account menu). These stubs
        // satisfy that dependency graph so the inbox displays under a realistic top bar in isolation.
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
  decorators: decorators({}),
};

export const EmptyNoManagerCollections: Story = {
  decorators: decorators({}),
  args: {
    hasManagerCollections: false,
  },
};

export const PopulatedMixed: Story = {
  decorators: decorators({
    inbox: [
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
    ],
    history: [
      historyRow({ id: "hist-1", status: "denied" }),
      historyRow({
        id: "hist-2",
        status: "approved",
        comment: "Approved for planned maintenance",
      }),
    ],
  }),
};

export const PopulatedWithSelfRequest: Story = {
  decorators: decorators({
    inbox: [
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
    ],
  }),
};
