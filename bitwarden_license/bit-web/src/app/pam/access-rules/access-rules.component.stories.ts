import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessRuleSdkService, AccessRuleView } from "..";

import { AccessRulesComponent } from "./access-rules.component";

const ORG_COLLECTIONS = [
  { id: "col-1", name: "Engineering" },
  { id: "col-2", name: "Finance" },
  { id: "col-3", name: "Marketing" },
  { id: "col-4", name: "Legal" },
  { id: "col-5", name: "Operations" },
];

/** Builds an AccessRuleView with sensible defaults; overrides fill in per-rule specifics. */
function rule(overrides: Record<string, unknown>): AccessRuleView {
  return {
    id: "rule",
    organizationId: "org-1",
    name: "Access rule",
    description: undefined,
    enabled: true,
    conditions: [],
    singleActiveLease: false,
    defaultLeaseDurationSeconds: 60 * 60,
    maxLeaseDurationSeconds: undefined,
    allowsExtensions: false,
    maxExtensionDurationSeconds: undefined,
    collections: [],
    creationDate: "2024-01-01T00:00:00.000Z",
    revisionDate: "2024-01-01T00:00:00.000Z",
    ...overrides,
  } as unknown as AccessRuleView;
}

const RULES: AccessRuleView[] = [
  rule({
    id: "rule-1",
    name: "VPN + business hours",
    description: "Elevated VPN access, human-approved.",
    conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
    collections: ["col-1"],
    maxLeaseDurationSeconds: 4 * 60 * 60,
    allowsExtensions: true,
    revisionDate: "2024-05-01T09:00:00.000Z",
  }),
  rule({
    id: "rule-2",
    name: "Production database",
    conditions: [{ kind: "human_approval" }],
    collections: ["col-2", "col-3"],
    defaultLeaseDurationSeconds: 30 * 60,
    singleActiveLease: true,
    revisionDate: "2024-04-20T14:30:00.000Z",
  }),
  rule({
    id: "rule-3",
    name: "Contractor read-only",
    enabled: false,
    collections: ["col-4"],
    defaultLeaseDurationSeconds: 8 * 60 * 60,
    revisionDate: "2024-03-15T08:00:00.000Z",
  }),
  rule({
    id: "rule-4",
    name: "Break-glass emergency",
    conditions: [{ kind: "ip_allowlist", cidrs: ["192.168.0.0/16"] }],
    defaultLeaseDurationSeconds: 15 * 60,
    revisionDate: "2024-05-10T18:45:00.000Z",
  }),
];

/** Base SDK mock; per-story decorators override `listAccessRules` for the empty/loading states. */
function pamApi(listAccessRules: () => Promise<AccessRuleView[]>): Partial<AccessRuleSdkService> {
  return {
    listAccessRules,
    updateAccessRule: (_orgId, _id, _req) => Promise.resolve(RULES[0]),
    deleteAccessRule: () => Promise.resolve(),
  };
}

export default {
  title: "Web/PAM/Access Rules",
  component: AccessRulesComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([])),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }), data: of({}) },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: AccessRuleSdkService, useValue: pamApi(() => Promise.resolve(RULES)) },
      ],
    }),
  ],
} as Meta<AccessRulesComponent>;

type Story = StoryObj<AccessRulesComponent>;

/** The populated table: a mix of enabled/disabled rules, conditions, and lease windows. */
export const Default: Story = {};

/** No rules yet — the empty state with starter templates is shown. */
export const Empty: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: AccessRuleSdkService, useValue: pamApi(() => Promise.resolve([])) }],
    }),
  ],
};

/** The initial load, before rules resolve — a spinner. */
export const Loading: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: AccessRuleSdkService,
          useValue: pamApi(() => new Promise<AccessRuleView[]>(() => {})),
        },
      ],
    }),
  ],
};
