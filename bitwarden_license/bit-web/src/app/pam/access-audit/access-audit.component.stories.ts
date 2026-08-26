import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
    ...overrides,
  } as unknown as AccessAuditEventResponse;
}

/** One of each kind the trail actually emits today, newest first as the server returns them. */
const EVENTS: AccessAuditEventResponse[] = [
  event({
    kind: AccessAuditEventKind.LeaseExpired,
    occurredAt: fromNow(-5 * MINUTE),
    leaseId: "lease-1",
  }),
  event({
    kind: AccessAuditEventKind.LeaseRevoked,
    occurredAt: fromNow(-20 * MINUTE),
    leaseId: "lease-2",
    actorName: "Ada Lovelace",
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
    actorName: "Ada Lovelace",
    actorEmail: "ada@example.com",
    detail: "Approved for the incident window.",
  }),
  // No actor: the rule auto-approved it, which the row renders as an automated action.
  event({
    kind: AccessAuditEventKind.RequestApproved,
    occurredAt: fromNow(-4 * HOUR),
    cipherId: "cipher-2",
    collectionId: "col-2",
    actorId: null,
    actorName: null,
    actorEmail: null,
  }),
  event({
    kind: AccessAuditEventKind.RequestDenied,
    occurredAt: fromNow(-DAY),
    cipherId: "cipher-3",
    actorName: "Ada Lovelace",
    detail: "Use the read replica instead.",
  }),
  event({ kind: AccessAuditEventKind.RequestCancelled, occurredAt: fromNow(-2 * DAY) }),
  // A rule change: no cipher, so the subject column falls back to the rule name.
  event({
    kind: AccessAuditEventKind.RuleUpdated,
    occurredAt: fromNow(-3 * DAY),
    cipherId: null,
    collectionId: null,
    requestId: null,
    ruleId: "rule-1",
    ruleName: "Production access",
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
