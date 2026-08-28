import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA, DialogService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AuditRow } from "../access-audit-row";

import { AuditEventDrawerComponent, AuditEventDrawerParams } from "./audit-event-drawer.component";

const OCCURRED_AT = new Date("2026-08-18T09:00:00.000Z");

/** A lease activation with every field the trail can carry — the widest the pane ever gets. */
const POPULATED: AuditRow = {
  occurredAt: OCCURRED_AT,
  kindLabelKey: "pamAuditKindLeaseActivated",
  actor: "Ada Lovelace",
  actorId: "user-2",
  actorEmail: "ada@example.com",
  requester: "Grace Hopper",
  requesterId: "user-1",
  requesterEmail: "grace@example.com",
  cipherName: "Production database credential",
  cipherId: "cipher-1",
  collectionName: "Production infrastructure",
  ruleName: null,
  ruleId: "8f1c0f2e-9b4a-4d1e-8a77-6c2f9d3b4a51",
  detail:
    "Approved ahead of the scheduled window after the on-call engineer confirmed the primary replica had not recovered, on the understanding that the credential would be surrendered as soon as failover completed.",
  automated: false,
  inDoubt: false,
  requestId: "3a9d5f74-2c18-4c6b-9f0d-71b8e4a2c6d5",
  leaseId: "b27e4c91-5d3a-4f88-a1c6-90e7d5f2b834",
  duration: { key: "pamInboxDurationHours", value: 4 },
  exactWindow: "18/08/2026, 09:00 – 18/08/2026, 13:00",
  extendedUntil: null,
};

/**
 * The absence check: a freeze the system recorded against nothing, whose outcome was never confirmed.
 * Every field the pane can render carries no value, so the muted em dash lines up down the whole pane
 * — beside the one absence that is not one, the automated event's actor, which reads "System".
 */
const BARE: AuditRow = {
  occurredAt: OCCURRED_AT,
  kindLabelKey: "pamAuditKindLeasingFreezeEnabled",
  actor: null,
  actorId: null,
  actorEmail: null,
  requester: null,
  requesterId: null,
  requesterEmail: null,
  cipherName: null,
  cipherId: null,
  collectionName: null,
  ruleName: null,
  ruleId: null,
  detail: null,
  automated: true,
  inDoubt: true,
  requestId: null,
  leaseId: null,
  duration: null,
  exactWindow: null,
  extendedUntil: null,
};

function params(row: AuditRow, linked: boolean): AuditEventDrawerParams {
  return {
    row,
    organizationId: "org-1",
    actor: linked
      ? { name: "Ada Lovelace", email: "ada@example.com", organizationUserId: "org-user-2" }
      : null,
    requester: linked
      ? { name: "Grace Hopper", email: "grace@example.com", organizationUserId: "org-user-1" }
      : null,
  };
}

export default {
  title: "Web/PAM/Access Audit/Event Drawer",
  component: AuditEventDrawerComponent,
  decorators: [
    moduleMetadata({
      imports: [AuditEventDrawerComponent],
      providers: [{ provide: DialogService, useValue: { open: (): undefined => undefined } }],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<AuditEventDrawerComponent>;

type Story = StoryObj<AuditEventDrawerComponent>;

/**
 * Everything an auditor needs about one event, in the order they read it: when, who, what, the window
 * granted, the free text the table's Detail column gave up, and the ids support asks for.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(POPULATED, true) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

/**
 * An event that names almost nothing. Every field still renders, absence showing as the muted em dash
 * the table uses, so a reader can tell "we hold no value for this" from a pane that failed to draw it.
 */
export const EmptyFields: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(BARE, false) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};
