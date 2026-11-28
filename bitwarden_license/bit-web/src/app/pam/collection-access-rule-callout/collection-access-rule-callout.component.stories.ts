import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import type { AccessRuleView } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { GovernedCollectionsService } from "../services/governed-collections.service";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const COLLECTION_ID = "col-1" as CollectionId;

function rule(overrides: Record<string, unknown> = {}): AccessRuleView {
  return {
    id: "rule-1",
    name: "Production access",
    enabled: true,
    conditions: [],
    singleActiveLease: false,
    collections: [COLLECTION_ID],
    ...overrides,
  } as unknown as AccessRuleView;
}

/**
 * Stubbed rather than run over a stubbed SDK, since the real per-org cache would carry one story's
 * rules into the next.
 */
function withRules(rules: AccessRuleView[], { canManageAccessRules = true } = {}) {
  return moduleMetadata({
    imports: [CollectionAccessRuleCalloutComponent],
    providers: [
      { provide: GovernedCollectionsService, useValue: { rules$: () => of(rules) } },
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: OrganizationService,
        useValue: { organizations$: () => of([{ id: ORG_ID, canManageAccessRules }]) },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Collection Access Rule Callout",
  component: CollectionAccessRuleCalloutComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        // The link's target, so the routerLink resolves instead of erroring on an unmatched route.
        importProvidersFrom(
          RouterModule.forRoot([
            { path: "organizations/:organizationId/pam/access-rules", children: [] },
          ]),
        ),
      ],
    }),
  ],
  args: {
    collection: { id: COLLECTION_ID, organizationId: ORG_ID, hasEnabledAccessRule: true },
  },
} as Meta<CollectionAccessRuleCalloutComponent>;

type Story = StoryObj<CollectionAccessRuleCalloutComponent>;

/** One auto-approved rule, the common case. */
export const SingleRule: Story = {
  decorators: [withRules([rule()])],
};

/** Every rule the read returns is named; only a stale read can list two for one collection. */
export const MultipleRules: Story = {
  decorators: [
    withRules([
      rule({ conditions: [{ kind: "human_approval" }] }),
      rule({
        id: "rule-2",
        name: "Break-glass emergency",
        conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
      }),
    ]),
  ],
};

/** Every condition at once, joined with " + " in the summary. */
export const AllConditions: Story = {
  decorators: [
    withRules([
      rule({
        name: "Production database",
        conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
        singleActiveLease: true,
      }),
    ]),
  ],
};

/** A user who can't manage access rules learns the collection is gated, but not by which rule. */
export const CannotManageAccessRules: Story = {
  decorators: [withRules([rule()], { canManageAccessRules: false })],
};

/** The server says the collection is gated, but the rule read names nothing for it. */
export const NoRuleInRead: Story = {
  decorators: [withRules([rule({ collections: ["col-other"] })])],
};

/** No enabled rule governs the collection, so the callout doesn't render. */
export const NotGoverned: Story = {
  decorators: [withRules([rule()])],
  args: {
    collection: { id: COLLECTION_ID, organizationId: ORG_ID, hasEnabledAccessRule: false },
  },
};
