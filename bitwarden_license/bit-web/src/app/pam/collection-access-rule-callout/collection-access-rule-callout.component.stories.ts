import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessRuleView } from "../abstractions/access-rule";
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
 * `GovernedCollectionsService` is stubbed rather than provided over a stubbed SDK: the story is
 * about which rules the callout names, and the real service's per-org cache would otherwise carry
 * one story's rules into the next. The component still runs the real `rulesGoverningCollection`
 * filter over whatever this returns, so the enabled/targeting rules below are honest.
 */
function withRules(rules: AccessRuleView[]) {
  return moduleMetadata({
    imports: [CollectionAccessRuleCalloutComponent],
    providers: [
      { provide: GovernedCollectionsService, useValue: { rules$: () => of(rules) } },
      { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
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
    organizationId: ORG_ID,
    collectionId: COLLECTION_ID,
  },
} as Meta<CollectionAccessRuleCalloutComponent>;

type Story = StoryObj<CollectionAccessRuleCalloutComponent>;

/** One governing rule, auto-approved — the common case inside the collection edit dialog. */
export const SingleRule: Story = {
  decorators: [withRules([rule()])],
};

/**
 * A collection can be governed by more than one rule, and all of them are named: listing only the
 * first would understate the gating the administrator is about to change access to.
 */
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

/** Every condition at once, to check the summary joins its keys with " + " rather than wrapping oddly. */
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

/**
 * A disabled rule gates nothing, so it is filtered out and the callout does not render — saying the
 * collection is governed when it is not would be worse than saying nothing.
 */
export const DisabledRuleHidden: Story = {
  decorators: [withRules([rule({ enabled: false })])],
};

/** Rules exist in the org but none target this collection, so nothing renders. */
export const NotGoverned: Story = {
  decorators: [withRules([rule({ collections: ["col-other"] })])],
};
