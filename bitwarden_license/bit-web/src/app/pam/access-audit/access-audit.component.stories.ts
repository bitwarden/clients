import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";
import { fireEvent } from "storybook/test";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessNameResolverService } from "../access-requests/access-name-resolver.service";
import {
  DAY,
  HOUR,
  MINUTE,
  fromNow,
  provideStoryChangeDetection,
  provideStoryLogService,
  storyNames,
} from "../testing/story-fixtures";

import { AccessAuditComponent } from "./access-audit.component";
import { AuditApiService } from "./audit-api.service";
import {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";

const names = storyNames();

/**
 * The server writes each audit event self-contained, with display names snapshotted at write time,
 * so a fixture is a flat object rather than something assembled from other fixtures.
 */
function event(overrides: Record<string, unknown>): AccessAuditEventResponse {
  return {
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-HOUR),
    organizationId: "org-1",
    actorId: "user-1",
    actorName: "Grace Hopper",
    actorEmail: "grace@example.com",
    requesterId: "user-1",
    requesterName: "Grace Hopper",
    requesterEmail: "grace@example.com",
    collectionId: "col-1",
    cipherId: "cipher-1",
    requestId: "req-1",
    leaseId: null,
    ruleId: null,
    detail: null,
    leaseNotBefore: null,
    leaseNotAfter: null,
    cipherName: null,
    collectionName: null,
    ruleName: null,
    automated: false,
    incomplete: false,
    ...overrides,
  } as unknown as AccessAuditEventResponse;
}

/** The approver, distinct from the two requesters so the Actor and Requester chips each have something to sort. */
const APPROVER = {
  actorId: "user-2",
  actorName: "Ada Lovelace",
  actorEmail: "ada@example.com",
};

/** The second requester, so the Requester chip is not a one-option menu. */
const OTHER_REQUESTER = {
  requesterId: "user-3",
  requesterName: "Katherine Johnson",
  requesterEmail: "katherine@example.com",
};

/**
 * One of each kind the trail actually emits today, newest first as the server returns them, spread
 * over a week so the date range has something to narrow.
 */
const EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-5 * MINUTE),
    leaseId: "lease-1",
    // No actor: the lease ran out on its own, which the row renders as an automated action.
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.LeaseRevoked,
    occurredAt: fromNow(-20 * MINUTE),
    leaseId: "lease-2",
    ...APPROVER,
    detail: "Incident closed early.",
  }),
  event({
    kind: AccessAuditEventKind.LeaseExtended,
    occurredAt: fromNow(-45 * MINUTE),
    leaseId: "lease-1",
    leaseNotAfter: fromNow(-5 * MINUTE),
  }),
  event({
    kind: AccessAuditEventKind.LeaseActivated,
    occurredAt: fromNow(-2 * HOUR),
    leaseId: "lease-1",
    leaseNotBefore: fromNow(-2 * HOUR),
    leaseNotAfter: fromNow(-30 * MINUTE),
  }),
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-3 * HOUR),
    ...APPROVER,
    detail: "Approved for the incident window.",
  }),
  // No actor: the rule auto-approved it, which the row renders as an automated action.
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-2 * DAY),
    cipherId: "cipher-2",
    collectionId: "col-2",
    requestId: "req-2",
    ...OTHER_REQUESTER,
    actorId: null,
    actorName: null,
    actorEmail: null,
    automated: true,
  }),
  event({
    kind: AccessAuditEventKind.RequestSubmitted,
    occurredAt: fromNow(-2 * DAY - HOUR),
    cipherId: "cipher-2",
    collectionId: "col-2",
    requestId: "req-2",
    ...OTHER_REQUESTER,
    actorId: OTHER_REQUESTER.requesterId,
    actorName: OTHER_REQUESTER.requesterName,
    actorEmail: OTHER_REQUESTER.requesterEmail,
  }),
  event({
    kind: AccessAuditEventKind.RequestDenied,
    occurredAt: fromNow(-4 * DAY),
    cipherId: "cipher-3",
    ...APPROVER,
    detail: "Use the read replica instead.",
  }),
  event({ kind: AccessAuditEventKind.RequestCancelled, occurredAt: fromNow(-5 * DAY) }),
  // A rule change: no cipher, so the subject column falls back to the rule name.
  event({
    kind: AccessAuditEventKind.RuleUpdated,
    occurredAt: fromNow(-7 * DAY),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-1",
    ruleName: "Production access",
    ...APPROVER,
  }),
];

/**
 * Item and Detail both render unbounded free text, so the column widths only hold up under values
 * long enough to fight for room. These three are the shapes that broke the layout: a rule name well
 * past sixty characters, a full-sentence detail, and a single token longer than the column cap —
 * which has to break mid-word rather than push the table wider than the page.
 */
const LONG_TEXT_EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.RuleDeleted,
    occurredAt: fromNow(-10 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-2",
    ruleName:
      "Emergency database credential rotation access for the platform reliability engineering on-call team",
    ...APPROVER,
  }),
  event({
    kind: AccessAuditEventKind.LeaseRevoked,
    occurredAt: fromNow(-30 * MINUTE),
    leaseId: "lease-3",
    ...APPROVER,
    detail:
      "Revoked ahead of the scheduled expiry after the on-call engineer confirmed the primary replica had recovered and the failover procedure completed without needing the elevated credential.",
  }),
  event({
    kind: AccessAuditEventKind.RequestDenied,
    occurredAt: fromNow(-90 * MINUTE),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-3",
    ruleName:
      "https://runbooks.internal.example.com/database/emergency-credential-rotation-procedure-v4-approved-2026",
    ...APPROVER,
    detail:
      "correlationid=AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNNOOOOPPPPQQQQRRRRSSSSTTTT",
  }),
];

function audit(options: { events?: AccessAuditEventResponse[]; fails?: boolean } = {}) {
  const { events = EVENTS, fails = false } = options;
  return moduleMetadata({
    imports: [AccessAuditComponent],
    providers: [
      {
        provide: AuditApiService,
        useValue: {
          listAccessAuditTrail: () =>
            fails ? Promise.reject(new Error("audit read failed")) : Promise.resolve(events),
        },
      },
      {
        provide: AccessNameResolverService,
        useValue: { resolveNames: () => Promise.resolve(names) },
      },
      {
        provide: FileDownloadService,
        useValue: { download: (): void => undefined },
      },
      {
        provide: ActivatedRoute,
        useValue: { params: of({ organizationId: "org-1" }), data: of({}) },
      },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: OrganizationService,
        useValue: { organizations$: () => of([{ id: "org-1", canManageAccessRules: true }]) },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Access Audit",
  component: AccessAuditComponent,
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
  render: () => ({ template: `<app-pam-access-audit />` }),
} as Meta<AccessAuditComponent>;

type Story = StoryObj<AccessAuditComponent>;

/** The populated trail, with the kind chips limited to the kinds actually present. */
export const Default: Story = {
  decorators: [audit()],
};

/** An organization with no PAM activity recorded yet. */
export const Empty: Story = {
  decorators: [audit({ events: [] })],
};

/**
 * The read failed. A caller without the AccessEventLogs permission gets a 404 rather than an empty
 * list, so this is also what insufficient permission looks like.
 */
export const LoadError: Story = {
  decorators: [audit({ fails: true })],
};

/** A single event — the trail right after an organization's first request. */
export const SingleEvent: Story = {
  decorators: [audit({ events: [EVENTS[EVENTS.length - 2]] })],
};

/**
 * The width check. Time and Event hold on one line beside Item and Detail values long enough to
 * wrap, and the over-long token breaks inside its column — so the table stays within the page
 * instead of dragging a horizontal scrollbar onto it.
 */
export const LongValues: Story = {
  decorators: [audit({ events: [...LONG_TEXT_EVENTS, ...EVENTS] })],
};

/**
 * A filter that matches nothing — a From bound later than every event in the trail. Export is disabled
 * alongside the no-matches callout: the file follows the filtered table, so with nothing on screen there is
 * nothing to download.
 */
export const NoMatches: Story = {
  decorators: [audit()],
  play: async ({ canvasElement }) => {
    const from = canvasElement.querySelector<HTMLInputElement>("#access-audit_input_from")!;
    await fireEvent.input(from, { target: { value: "2999-01-01T00:00" } });
  },
};
