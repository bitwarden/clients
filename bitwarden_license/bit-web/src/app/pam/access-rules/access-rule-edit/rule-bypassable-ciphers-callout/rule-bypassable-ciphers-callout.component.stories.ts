import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of, throwError } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessRuleId, AccessRuleSdkService } from "../../..";

import { RuleBypassableCiphersCalloutComponent } from "./rule-bypassable-ciphers-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const RULE_ID = "rule-1" as unknown as AccessRuleId;
const ENG = "col-eng" as CollectionId;
const CONTRACTORS = "col-contractors" as CollectionId;

/**
 * Wires the two reads the callout composes: the server's determination (which collections let this
 * rule's ciphers through) and the admin collection read that names them.
 *
 * The component declares no providers of its own, so these module-level stubs are what it resolves —
 * a component-level provider would win over the module injector and pull in the real service.
 */
function withGaps(ungatedCollectionIds: CollectionId[], namesResolve = true) {
  return moduleMetadata({
    imports: [RuleBypassableCiphersCalloutComponent],
    providers: [
      {
        provide: AccessRuleSdkService,
        useValue: { listBypassGaps: () => Promise.resolve(ungatedCollectionIds) },
      },
      { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
      {
        provide: CollectionAdminService,
        useValue: {
          collectionAdminViews$: () =>
            namesResolve
              ? of([
                  { id: ENG, name: "Engineering" },
                  { id: CONTRACTORS, name: "Contractors" },
                ])
              : throwError(() => new Error("collection read failed")),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Rule Bypassable Ciphers Callout",
  component: RuleBypassableCiphersCalloutComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        // The remediation links' target, so routerLink resolves instead of erroring.
        importProvidersFrom(
          RouterModule.forRoot([{ path: "organizations/:organizationId/vault", children: [] }]),
        ),
      ],
    }),
  ],
  args: {
    organizationId: ORG_ID,
    accessRuleId: RULE_ID,
  },
} as Meta<RuleBypassableCiphersCalloutComponent>;

type Story = StoryObj<RuleBypassableCiphersCalloutComponent>;

/** The common case: one ordinary collection is letting this rule's credentials through. */
export const SingleGap: Story = {
  decorators: [withGaps([ENG])],
};

/** More than one way in — every gap is listed, since closing only one fixes nothing. */
export const SeveralGaps: Story = {
  decorators: [withGaps([ENG, CONTRACTORS])],
};

/**
 * A gap this admin's collection read did not name still renders as a link — the link is the
 * actionable part, and following it lands on the collection's own page.
 */
export const UnnamedGap: Story = {
  decorators: [withGaps(["col-invisible" as CollectionId])],
};

/** Names are a nicety: a failed collection read still leaves a usable warning. */
export const NameReadFailed: Story = {
  decorators: [withGaps([ENG], false)],
};

/** Nothing bypasses the rule — the normal answer, and the callout stays out of the way entirely. */
export const Protected: Story = {
  decorators: [withGaps([])],
};

/** The create page: no saved rule to assess yet, so the callout never reads or renders. */
export const UnsavedRule: Story = {
  decorators: [withGaps([])],
  args: { accessRuleId: undefined },
};

/**
 * Informational, never a gate: a failed read hides the callout rather than surfacing an error over
 * the form the admin is trying to fill in.
 */
export const ReadFailed: Story = {
  decorators: [
    moduleMetadata({
      imports: [RuleBypassableCiphersCalloutComponent],
      providers: [
        {
          provide: AccessRuleSdkService,
          useValue: { listBypassGaps: () => Promise.reject(new Error("unreachable")) },
        },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: { collectionAdminViews$: () => of([]) } },
      ],
    }),
  ],
};
