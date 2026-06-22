import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/bit-pam";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { I18nMockService, ToastService } from "@bitwarden/components";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { MyAccessRequestsListComponent } from "./my-access-requests-list.component";
import { MyAccessRequestsService } from "./my-access-requests.service";

/** Readable names + a website URI for each gated cipher, keyed by the `cipher-<id>` fixtures use. */
const CIPHERS: Record<string, { name: string; uri: string }> = {
  "cipher-p1": { name: "Production database", uri: "https://postgresql.org" },
  "cipher-p2": { name: "Staging API key", uri: "https://stripe.com" },
  "cipher-r1": { name: "AWS root account", uri: "https://aws.amazon.com" },
  "cipher-r2": { name: "Billing portal", uri: "https://github.com" },
  "cipher-r3": { name: "Legacy VPN", uri: "https://cloudflare.com" },
};

/** A decrypted Login cipher with a website URI, as the real resolver would read from vault state. */
function makeCipher(id: string): CipherView {
  const login = Object.assign(new LoginView(), {
    uris: [Object.assign(new LoginUriView(), { uri: CIPHERS[id]?.uri ?? "https://example.com" })],
  });
  return Object.assign(new CipherView(), {
    id,
    name: CIPHERS[id]?.name ?? id,
    type: CipherType.Login,
    login,
  });
}

/** Build the `cipherById` lookup the resolver returns, covering every referenced cipher id. */
function cipherViews(cipherIds: string[]): Map<string, CipherView> {
  return new Map(cipherIds.map((id) => [id, makeCipher(id)]));
}

type Fixture = {
  id: string;
  status: AccessRequestStatus;
  submittedAt: string;
  resolvedAt?: string | null;
  approverId?: string | null;
  approverName?: string | null;
  approverEmail?: string | null;
  approverComment?: string | null;
  requestedNotBefore?: string | null;
  requestedNotAfter?: string | null;
  requestedTtlSeconds?: number;
  producedLeaseId?: string | null;
  extensionOfLeaseId?: string | null;
};

const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;
const now = Date.now();

function makeResponse(f: Fixture): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: f.id,
    CipherId: `cipher-${f.id}`,
    CollectionId: "col-1",
    RequesterId: "me",
    Status: f.status,
    RequestedNotBefore: f.requestedNotBefore ?? null,
    RequestedNotAfter: f.requestedNotAfter ?? null,
    RequestedTtlSeconds: f.requestedTtlSeconds ?? 3600,
    Reason: null,
    SubmittedAt: f.submittedAt,
    ResolvedAt: f.resolvedAt ?? null,
    // Decision log: pending has none; a resolved request with an approverId is a human decision,
    // otherwise an automatic (access-rule) decision with no approver identity.
    Decisions:
      f.status === "pending"
        ? []
        : [
            f.approverId != null
              ? {
                  DeciderKind: "human",
                  Id: f.approverId,
                  Name: f.approverName ?? null,
                  Email: f.approverEmail ?? null,
                  Comment: f.approverComment ?? null,
                  Verdict: f.status === "denied" ? 0 : 1,
                  DecidedAt: f.resolvedAt ?? f.submittedAt,
                }
              : {
                  DeciderKind: "automatic",
                  Id: null,
                  Comment: f.approverComment ?? null,
                  Verdict: f.status === "denied" ? 0 : 1,
                  DecidedAt: f.resolvedAt ?? f.submittedAt,
                },
          ],
    ProducedLeaseId: f.producedLeaseId ?? null,
    ExtensionOfLeaseId: f.extensionOfLeaseId ?? null,
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

/** Fills each row's cipher/collection name + favicon from the fixtures, as the real resolver would from vault state. */
function nameResolver(): AccessRequestNameResolver {
  return {
    resolveDisplayNames: async (rows: AccessRequestDetailsResponse[]) => {
      rows.forEach((row) => {
        row.cipherName = CIPHERS[row.cipherId]?.name ?? row.cipherId;
        row.collectionName = "Production";
      });
      return {
        cipherNameById: new Map(
          rows.map((r) => [r.cipherId, CIPHERS[r.cipherId]?.name ?? r.cipherId]),
        ),
        collectionNameById: new Map(rows.map((r) => [r.collectionId, "Production"])),
        cipherById: cipherViews(rows.map((r) => r.cipherId)),
      };
    },
    namesFor: async (refs: ReadonlyArray<{ cipherId: string; collectionId: string }>) => ({
      cipherNameById: new Map(
        refs.map((r) => [r.cipherId, CIPHERS[r.cipherId]?.name ?? r.cipherId]),
      ),
      collectionNameById: new Map(refs.map((r) => [r.collectionId, "Production"])),
      cipherById: cipherViews(refs.map((r) => r.cipherId)),
    }),
    collectionNames$: () => of(new Map<string, string>()),
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
    pamStatusActivated: "Activated",
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
    pamExtendedBadge: "Extended +__$1__ · until __$2__",
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
        // `app-vault-icon` dependencies, so the item favicons resolve against the icons server.
        {
          provide: EnvironmentService,
          useValue: { environment$: of({ getIconsUrl: () => "https://icons.bitwarden.net" }) },
        },
        { provide: DomainSettingsService, useValue: { showFavicons$: of(true) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
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
      approverName: "Alice Approver",
      approverEmail: "alice@example.com",
      approverComment: "LGTM",
    }),
    makeResponse({
      id: "r2",
      status: "denied",
      submittedAt: new Date(now - 3 * oneDay).toISOString(),
      resolvedAt: new Date(now - 2 * oneDay).toISOString(),
      approverId: "bob-id",
      approverName: "Bob Approver",
      approverEmail: "bob@example.com",
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
      approverName: "Alice Approver",
      approverEmail: "alice@example.com",
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

// An extended grant whose lease is still active: it shows only under Active leases, badged
// "Extended +2h · until …" (its extension is folded in, never a separate row), and is not
// duplicated in History. A denied request keeps History populated.
export const WithExtension: Story = {
  ...withFixtures(
    [
      makeResponse({
        id: "r1",
        status: "activated",
        submittedAt: new Date(now - 2 * oneDay).toISOString(),
        resolvedAt: new Date(now - 1 * oneDay).toISOString(),
        approverId: "alice-id",
        approverName: "Alice Approver",
        approverEmail: "alice@example.com",
        producedLeaseId: "lease-r1",
      }),
      // Real server contract: an applied extension is `approved` and mints no lease of its own.
      makeResponse({
        id: "r1-ext-1",
        status: "approved",
        submittedAt: new Date(now - 12 * oneHour).toISOString(),
        resolvedAt: new Date(now - 12 * oneHour).toISOString(),
        extensionOfLeaseId: "lease-r1",
        requestedTtlSeconds: 7200,
        requestedNotAfter: new Date(now + 2 * oneHour).toISOString(),
      }),
      makeResponse({
        id: "r2",
        status: "denied",
        submittedAt: new Date(now - 3 * oneDay).toISOString(),
        resolvedAt: new Date(now - 3 * oneDay).toISOString(),
        approverId: "bob-id",
        approverName: "Bob Approver",
        approverComment: "Wrong scope.",
      }),
    ],
    [makeLease("lease-r1", "cipher-r1")],
  ),
};
