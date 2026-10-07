import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogService, ToastModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AuditRow } from "../access-audit-row";

import { AuditEventDrawerComponent, AuditEventDrawerParams } from "./audit-event-drawer.component";

const OCCURRED_AT = new Date("2026-08-18T09:00:00.000Z");

/** A lease activation carrying every field, the widest the pane gets. */
const POPULATED: AuditRow = {
  occurredAt: OCCURRED_AT,
  kindLabelKey: "pamAuditKindAccessActivated",
  actor: "Ada Lovelace",
  actorId: "user-2",
  actorEmail: "ada@example.com",
  requester: "Grace Hopper",
  requesterId: "user-1",
  requesterEmail: "grace@example.com",
  cipherName: "Production database credential",
  cipherId: "cipher-1",
  collectionName: "Production infrastructure",
  collectionId: "5c4b3a29-1d8e-4f60-b2a7-3e9c8d1f0a64",
  ruleName: "Approval required",
  ruleId: "8f1c0f2e-9b4a-4d1e-8a77-6c2f9d3b4a51",
  targetSystemName: null,
  accessConnectorName: null,
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

/** An unconfirmed system freeze, so every field but the actor ("System") shows a dash. */
const BARE: AuditRow = {
  occurredAt: OCCURRED_AT,
  kindLabelKey: "pamAuditKindAccessFreezeEnabled",
  actor: null,
  actorId: null,
  actorEmail: null,
  requester: null,
  requesterId: null,
  requesterEmail: null,
  cipherName: null,
  cipherId: null,
  collectionName: null,
  collectionId: null,
  ruleName: null,
  ruleId: null,
  targetSystemName: null,
  accessConnectorName: null,
  detail: null,
  automated: true,
  inDoubt: true,
  requestId: null,
  leaseId: null,
  duration: null,
  exactWindow: null,
  extendedUntil: null,
};

const RULE_DELETED: AuditRow = {
  ...POPULATED,
  kindLabelKey: "pamAuditKindRuleDeleted",
  cipherName: null,
  cipherId: null,
  collectionName: null,
  collectionId: null,
  requestId: null,
  leaseId: null,
  duration: null,
  exactWindow: null,
  detail: null,
};

const CONNECTOR_ASSIGNED: AuditRow = {
  ...POPULATED,
  kindLabelKey: "pamAuditKindAccessConnectorAssigned",
  requester: null,
  requesterId: null,
  requesterEmail: null,
  cipherName: null,
  cipherId: null,
  collectionName: null,
  collectionId: null,
  ruleName: null,
  ruleId: null,
  targetSystemName: "prod-postgres-01",
  accessConnectorName: "eu-west-rotator",
  requestId: null,
  leaseId: null,
  duration: null,
  exactWindow: null,
  detail: null,
};

function params(row: AuditRow, linked: boolean, permitted = linked): AuditEventDrawerParams {
  return {
    row,
    organizationId: "org-1",
    actor: linked
      ? { name: "Ada Lovelace", email: "ada@example.com", organizationUserId: "org-user-2" }
      : null,
    requester: linked
      ? { name: "Grace Hopper", email: "grace@example.com", organizationUserId: "org-user-1" }
      : null,
    canManageAccessRules: permitted,
    canViewCollections: permitted,
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
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter([]),
        provideNoopAnimations(),
        ToastModule.forRoot().providers!,
        {
          provide: PlatformUtilsService,
          useValue: {
            copyToClipboard: (): void => undefined,
          },
        },
      ],
    }),
  ],
} as Meta<AuditEventDrawerComponent>;

type Story = StoryObj<AuditEventDrawerComponent>;

/** A lease activation with every field populated and linked. */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(POPULATED, true) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

export const EmptyFields: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(BARE, false) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

/** The rule is gone, so its name renders without a link even for a rule administrator. */
export const DeletedRule: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(RULE_DELETED, true) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

/** Names no cipher or rule, so Item falls through to the access connector. */
export const FleetEvent: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(CONNECTOR_ASSIGNED, true) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

/** An auditor holding only AccessEventLogs sees the rule and collection as plain text. */
export const WithoutLinkPermissions: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [{ provide: DIALOG_DATA, useValue: params(POPULATED, true, false) }],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};

/** A pasted token with no break opportunity wraps, since the dialog's size fixes the width. */
export const LongUnbrokenReason: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: params(
            { ...POPULATED, detail: "Xk9Qw2Zr7Lm4Vb8Ns3Ty6Hj1Pd5Gf0Cx".repeat(13) },
            true,
          ),
        },
      ],
    },
    template: `<pam-audit-event-drawer />`,
  }),
};
